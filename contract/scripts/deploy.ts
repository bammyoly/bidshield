import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';

import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';

import { loadDotEnv } from './env.ts';
import { getWalletFromEnv, recordDeployment, resolveNetwork } from './network.ts';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from './wallet.ts';
import { witnesses, type BidShieldPrivateState } from '../src/witnesses.ts';
import { copyDeployedOutputs } from './copy-to-frontend.ts';

(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'bidshieldPrivateState';
const DUST_WAIT_TIMEOUT_MS = 8 * 60 * 1000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(CONTRACT_ROOT, '..');
const zkConfigPath = path.resolve(CONTRACT_ROOT, 'managed', 'bidshield');
const deployedDir = path.resolve(CONTRACT_ROOT, 'deployed');
const privateDir = path.join(deployedDir, 'private');

loadDotEnv(CONTRACT_ROOT);
loadDotEnv(REPO_ROOT);
process.chdir(CONTRACT_ROOT);

const { network, config: networkConfig } = resolveNetwork();
const WALLET = getWalletFromEnv();

function sha256(data: string | Uint8Array): Uint8Array {
  return createHash('sha256').update(data).digest();
}

function bytes32FromEnvOrHash(envName: string, fallbackLabel: string): Uint8Array {
  const raw = process.env[envName]?.trim();
  if (!raw) return sha256(fallbackLabel);
  const hex = raw.startsWith('0x') ? raw.slice(2) : raw;
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex');
  return sha256(raw);
}

function unixSecondsNow(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

async function waitForProofServer(url: string, maxAttempts = 60, delayMs = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3000) });
      return true;
    } catch (err: any) {
      const code = err?.cause?.code || err?.code || '';
      if (code !== 'ECONNREFUSED' && code !== 'UND_ERR_CONNECT_TIMEOUT' && code !== 'UND_ERR_SOCKET') {
        return true;
      }
    }
    if (attempt < maxAttempts) {
      process.stdout.write(`\r  Waiting for proof server... (${attempt}/${maxAttempts})   `);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

function copyZkAssets(): void {
  const dest = path.join(deployedDir, 'zk-assets');
  fs.mkdirSync(dest, { recursive: true });
  for (const name of ['keys', 'zkir', 'compiler']) {
    const src = path.join(zkConfigPath, name);
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(dest, name), { recursive: true });
    }
  }
  const contractSrc = path.join(zkConfigPath, 'contract');
  if (fs.existsSync(contractSrc)) {
    fs.cpSync(contractSrc, path.join(dest, 'contract'), { recursive: true });
  }
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function createProviders(walletCtx: WalletContext) {
  const privateStatePassword =
    process.env.PRIVATE_STATE_PASSWORD?.trim() || 'BidShield-Preview-2026!';

  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'bidshield-private-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

async function main() {
  console.log('\n=== BidShield deploy → Midnight Preview ===\n');

  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractPath)) {
    console.error('Contract not compiled. Run: npm run compile');
    process.exit(1);
  }

  const ContractModule = await import(pathToFileURL(contractPath).href);
  const compiledContract = CompiledContract.make('bidshield', ContractModule.Contract).pipe(
    CompiledContract.withWitnesses(witnesses as never),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  console.log('Wallet setup');
  const walletCtx = await createWallet({
    network,
    networkConfig,
    seed: WALLET.seed,
  });

  console.log('Syncing wallet with preview (this can take several minutes on a fresh seed)...');
  const syncStart = Date.now();
  let latestState: any;
  let rejectSync!: (error: Error) => void;
  const syncFailure = new Promise<never>((_, reject) => {
    rejectSync = reject;
  });
  const stateSubscription = walletCtx.wallet.state().subscribe({
    next: (value) => {
      latestState = value;
    },
    error: (error) => {
      rejectSync(error instanceof Error ? error : new Error(String(error)));
    },
  });
  let previousProgress = '';
  let lastProgressAt = Date.now();
  const syncStallMs = Number(process.env.MIDNIGHT_SYNC_STALL_MS) || 240_000;
  const syncInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - syncStart) / 1000);
    const positions = latestState
      ? ([
          ['shielded', latestState.shielded.progress.appliedIndex, latestState.shielded.progress.highestRelevantWalletIndex],
          ['unshielded', latestState.unshielded.progress.appliedId, latestState.unshielded.progress.highestTransactionId],
          ['dust', latestState.dust.progress.appliedIndex, latestState.dust.progress.highestRelevantWalletIndex],
        ] as const)
      : [];
    const progress = positions
      .map(([name, applied, highest]) => `${name} ${String(applied)}/${String(highest)}`)
      .join(' | ');
    console.log(`  sync ${elapsed}s: ${progress || 'waiting for first state'}`);
    if (progress && progress !== previousProgress) {
      previousProgress = progress;
      lastProgressAt = Date.now();
    } else if (Date.now() - lastProgressAt > syncStallMs) {
      rejectSync(
        new Error(`Wallet sync made no progress for ${Math.round(syncStallMs / 1000)}s. Last: ${progress || 'none'}`),
      );
    }
  }, 15_000);

  let state: Awaited<ReturnType<typeof walletCtx.wallet.waitForSyncedState>>;
  try {
    state = await Promise.race([walletCtx.wallet.waitForSyncedState(), syncFailure]);
  } catch (error) {
    await persistWalletState(network, walletCtx);
    await walletCtx.wallet.stop();
    throw error;
  } finally {
    clearInterval(syncInterval);
    stateSubscription.unsubscribe();
  }
  console.log('  wallet synced\n');
  await persistWalletState(network, walletCtx);

  const address = walletCtx.unshieldedKeystore.getBech32Address();
  let balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  console.log(`  Address: ${address}`);
  console.log(`  tNIGHT:  ${balance.toLocaleString()}\n`);

  if (networkConfig.faucet) {
    const initialBalance = await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
    );
    const initialTNight = initialBalance.unshielded.balances[unshieldedToken().raw] ?? 0n;
    if (initialTNight === 0n) {
      console.log('Fund this Preview address, then wait:');
      console.log(`  ${address}`);
      console.log(`  Faucet: ${networkConfig.faucet}\n`);
      const timeoutMs = Number(process.env.MIDNIGHT_FAUCET_TIMEOUT_MS) || 15 * 60_000;
      const start = Date.now();
      while (true) {
        await new Promise((r) => setTimeout(r, 10_000));
        const s = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((x) => x.isSynced)));
        const tn = s.unshielded.balances[unshieldedToken().raw] ?? 0n;
        if (tn > 0n) {
          console.log(`  Funded. tNIGHT: ${tn.toLocaleString()}\n`);
          balance = tn;
          break;
        }
        if (Date.now() - start > timeoutMs) {
          console.error('No tNIGHT received. Fund the address and re-run npm run deploy:preview.');
          writeJson(path.join(deployedDir, 'pending-funding.json'), {
            network,
            address: address.toString(),
            faucet: networkConfig.faucet,
            status: 'waiting_for_tnight',
            updatedAt: new Date().toISOString(),
          });
          await walletCtx.wallet.stop();
          process.exit(1);
        }
        process.stdout.write(`\r  waiting for faucet (${Math.round((Date.now() - start) / 1000)}s)`);
      }
    }
  }

  console.log('DUST registration');
  const dustState = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const unregisteredUtxos = dustState.unshielded.availableCoins.filter(
    (c: any) => !c.meta?.registeredForDustGeneration,
  );
  if (unregisteredUtxos.length > 0) {
    console.log(`  Registering ${unregisteredUtxos.length} NIGHT UTXO(s)...`);
    const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
      unregisteredUtxos,
      walletCtx.unshieldedKeystore.getPublicKey(),
      (payload) => walletCtx.unshieldedKeystore.signData(payload),
    );
    const finalized = await walletCtx.wallet.finalizeRecipe(recipe);
    const txId = await walletCtx.wallet.submitTransaction(finalized);
    console.log(`  registration tx: ${txId}`);
  }

  if (dustState.dust.balance(new Date()) === 0n) {
    console.log('  Waiting for DUST...');
    try {
      await Rx.firstValueFrom(
        walletCtx.wallet.state().pipe(
          Rx.throttleTime(5000),
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => s.dust.balance(new Date()) > 0n),
          Rx.timeout({ first: DUST_WAIT_TIMEOUT_MS }),
        ),
      );
    } catch {
      console.error('No DUST after waiting. Re-run deploy once registered NIGHT has generated fees.');
      await walletCtx.wallet.stop();
      process.exit(1);
    }
  }
  console.log('  DUST ready\n');

  console.log('Proof server');
  const proofServerReady = await waitForProofServer(networkConfig.proofServer);
  if (!proofServerReady) {
    console.error('Proof server not responding on', networkConfig.proofServer);
    await walletCtx.wallet.stop();
    process.exit(1);
  }
  console.log('  ready\n');

  const providers = await createProviders(walletCtx);

  const now = unixSecondsNow();
  const commitStart = process.env.COMMIT_START ? BigInt(process.env.COMMIT_START) : now - 60n;
  const commitEnd = process.env.COMMIT_END ? BigInt(process.env.COMMIT_END) : now + 7n * 24n * 3600n;
  const revealEnd = process.env.REVEAL_END ? BigInt(process.env.REVEAL_END) : now + 14n * 24n * 3600n;

  const organizerSecret = randomBytes(32);
  const bidderSecret = randomBytes(32);
  const tenderId = bytes32FromEnvOrHash('TENDER_ID', `bidshield:preview:tender:${Date.now()}`);
  const policyHash = bytes32FromEnvOrHash('POLICY_HASH', 'bidshield:preview:policy:v1');

  const initialPrivateState: BidShieldPrivateState = { organizerSecret, bidderSecret };

  console.log('Deploying contract (constructor + ZK proof)...');
  await new Promise((r) => setTimeout(r, 6000));

  const MAX_RETRIES = 20;
  const RETRY_DELAY_MS = 5000;
  let deployed: Awaited<ReturnType<typeof deployContract>> | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      deployed = await deployContract(providers, {
        compiledContract: compiledContract as any,
        args: [organizerSecret, tenderId, policyHash, commitStart, commitEnd, revealEnd],
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState,
      });
      break;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const errCause = err?.cause?.message || String(err?.cause ?? '');
      const fullError = `${errMsg} ${errCause}`;
      const isDustShortage =
        fullError.includes('Not enough Dust') ||
        fullError.includes('Insufficient Funds') ||
        fullError.includes('could not balance dust');

      if (!(isDustShortage && attempt === 1)) {
        console.error(`\n  Attempt ${attempt} error: ${errMsg}`);
        if (errCause && errCause !== errMsg) console.error(`  Cause: ${errCause}`);
      }

      if (
        !isDustShortage &&
        (fullError.includes('Failed to connect to Proof Server') ||
          fullError.includes('connect ECONNREFUSED 127.0.0.1:6300'))
      ) {
        console.error('Proof server unreachable.');
        await walletCtx.wallet.stop();
        process.exit(1);
      }

      if (isDustShortage) {
        if (attempt < MAX_RETRIES) {
          console.log(`  Still generating DUST, retrying in ${RETRY_DELAY_MS / 1000}s...`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        } else {
          console.error('Not enough DUST after retries.');
          await walletCtx.wallet.stop();
          process.exit(1);
        }
      } else {
        throw err;
      }
    }
  }

  if (!deployed) throw new Error('Deployment failed after all retries');

  const contractAddress = deployed.deployTxData.public.contractAddress;
  const txHash =
    (deployed.deployTxData.public as { txId?: string; txHash?: string }).txId ??
    (deployed.deployTxData.public as { txHash?: string }).txHash ??
    null;

  console.log('\n  Deployed');
  console.log(`  Contract: ${contractAddress}`);
  if (txHash) console.log(`  Tx:       ${txHash}`);

  copyZkAssets();
  fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });

  const publicTender = {
    tenderId: toHex(tenderId),
    policyHash: toHex(policyHash),
    commitStart: commitStart.toString(),
    commitEnd: commitEnd.toString(),
    revealEnd: revealEnd.toString(),
    timeUnit: 'unix-seconds',
  };

  const preview = {
    name: 'BidShield',
    network,
    networkId: networkConfig.networkId,
    contractAddress,
    deploymentTxHash: txHash,
    deployer: address.toString(),
    deployedAt: new Date().toISOString(),
    explorer: networkConfig.explorerContract(contractAddress),
    endpoints: {
      indexer: networkConfig.indexer,
      indexerWS: networkConfig.indexerWS,
      node: networkConfig.node,
      proofServer: networkConfig.proofServer,
    },
    circuits: ['commitBid', 'revealBid', 'recordAward'],
    witnesses: ['localBidderSecret', 'localOrganizerSecret'],
    privateStateId: PRIVATE_STATE_ID,
    zkAssetsPath: 'contract/deployed/zk-assets',
    tender: publicTender,
  };

  const frontendConfig = {
    VITE_MIDNIGHT_NETWORK: network,
    VITE_CONTRACT_ADDRESS: contractAddress,
    VITE_INDEXER_HTTP: networkConfig.indexer,
    VITE_INDEXER_WS: networkConfig.indexerWS,
    VITE_NODE_URL: networkConfig.node,
    VITE_PROOF_SERVER: networkConfig.proofServer,
    VITE_TENDER_ID: publicTender.tenderId,
    VITE_POLICY_HASH: publicTender.policyHash,
    VITE_COMMIT_START: publicTender.commitStart,
    VITE_COMMIT_END: publicTender.commitEnd,
    VITE_REVEAL_END: publicTender.revealEnd,
    VITE_PRIVATE_STATE_ID: PRIVATE_STATE_ID,
    VITE_ZK_ASSETS_BASE: '/zk/bidshield',
  };

  writeJson(path.join(deployedDir, 'preview.json'), preview);
  writeJson(path.join(deployedDir, 'frontend-config.json'), frontendConfig);
  writeJson(path.join(deployedDir, 'circuits.json'), {
    contract: 'bidshield',
    exportedCircuits: [
      { name: 'commitBid', args: ['amount: Uint<64>', 'salt: Bytes<32>', 'documentHash: Bytes<32>'] },
      { name: 'revealBid', args: ['amount: Uint<64>', 'salt: Bytes<32>', 'documentHash: Bytes<32>'] },
      { name: 'recordAward', args: ['winner: Bytes<32>', 'memoHash: Bytes<32>'] },
    ],
    constructor: {
      args: [
        'organizerSecret: Bytes<32> (private)',
        'newTenderId: Bytes<32>',
        'newPolicyHash: Bytes<32>',
        'newCommitStart: Uint<64>',
        'newCommitEnd: Uint<64>',
        'newRevealEnd: Uint<64>',
      ],
    },
  });
  writeJson(path.join(privateDir, 'organizer-secret.json'), {
    warning: 'Keep this file off the frontend bundle. Required to call recordAward.',
    organizerSecret: toHex(organizerSecret),
    bidderSecretHint: 'A random bidderSecret was generated for the deployer wallet only.',
    bidderSecret: toHex(bidderSecret),
    tenderId: publicTender.tenderId,
    contractAddress,
  });

  recordDeployment(network, contractAddress, address.toString());
  await persistWalletState(network, walletCtx);
  await walletCtx.wallet.stop();

  const copied = copyDeployedOutputs();

  console.log('\nWrote contract outputs:');
  console.log('  contract/deployed/preview.json');
  console.log('  contract/deployed/frontend-config.json');
  console.log('  contract/deployed/circuits.json');
  console.log('  contract/deployed/zk-assets/');
  console.log('  contract/deployed/private/organizer-secret.json (gitignored)');
  console.log('\nCopied into the React app:');
  for (const name of copied.copied) console.log(`  frontend/src/contracts ← ${name}`);
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
