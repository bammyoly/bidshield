import * as fs from 'node:fs';
import * as path from 'node:path';
import { Buffer } from 'node:buffer';
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export type NetworkId = 'undeployed' | 'preview' | 'preprod';

export const NETWORK_IDS: readonly NetworkId[] = ['undeployed', 'preview', 'preprod'] as const;

export interface NetworkConfig {
  networkId: NetworkId;
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
  faucet: string | null;
  explorerContract: (address: string) => string;
}

export interface DeploymentRecord {
  address: string;
  deployedAt: string;
  deployer: string;
}

export interface WalletRecord {
  seed: string;
  mnemonic?: string;
  createdAt: string;
}

export interface NetworkState {
  version: 1;
  activeNetwork: NetworkId;
  wallets: Partial<Record<NetworkId, WalletRecord>>;
  deployments: Partial<Record<NetworkId, DeploymentRecord>>;
}

export const STATE_FILE_NAME = '.midnight-state.json';
export const STATE_VERSION = 1 as const;

export const NETWORK_CONFIGS: Record<NetworkId, NetworkConfig> = {
  undeployed: {
    networkId: 'undeployed',
    indexer: 'http://127.0.0.1:8088/api/v4/graphql',
    indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
    node: 'ws://127.0.0.1:9944',
    proofServer: 'http://127.0.0.1:6300',
    faucet: null,
    explorerContract: () => '',
  },
  preview: {
    networkId: 'preview',
    indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    node: 'https://rpc.preview.midnight.network',
    proofServer: 'http://127.0.0.1:6300',
    faucet: 'https://midnight-tmnight-preview.nethermind.dev/',
    explorerContract: (address) => `https://preview.midnightexplorer.com/contract/${address}`,
  },
  preprod: {
    networkId: 'preprod',
    indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
    proofServer: 'http://127.0.0.1:6300',
    faucet: 'https://midnight-tmnight-preprod.nethermind.dev/',
    explorerContract: (address) => `https://preprod.midnightexplorer.com/contract/${address}`,
  },
};

export function isNetworkId(v: unknown): v is NetworkId {
  return typeof v === 'string' && (NETWORK_IDS as readonly string[]).includes(v);
}

export interface FsOptions {
  cwd?: string;
}

function statePath(opts: FsOptions = {}): string {
  return path.join(opts.cwd ?? process.cwd(), STATE_FILE_NAME);
}

export function loadState(opts: FsOptions = {}): NetworkState | null {
  const p = statePath(opts);
  if (!fs.existsSync(p)) return null;
  const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as NetworkState;
  return parsed;
}

export function saveState(state: NetworkState, opts: FsOptions = {}): void {
  const p = statePath(opts);
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, p);
}

export function parseNetworkFlag(argv: string[]): NetworkId | null {
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--network') {
      const v = argv[i + 1];
      if (!isNetworkId(v)) throw new Error(`Unknown network: ${v}`);
      return v;
    }
    if (arg.startsWith('--network=')) {
      const v = arg.slice('--network='.length);
      if (!isNetworkId(v)) throw new Error(`Unknown network: ${v}`);
      return v;
    }
  }
  return null;
}

const ENV_OVERRIDES: Array<[keyof NetworkConfig, string]> = [
  ['indexer', 'MIDNIGHT_INDEXER_URL'],
  ['indexerWS', 'MIDNIGHT_INDEXER_WS_URL'],
  ['node', 'MIDNIGHT_NODE_URL'],
  ['faucet', 'MIDNIGHT_FAUCET_URL'],
  ['proofServer', 'MIDNIGHT_PROOF_SERVER_URL'],
];

function applyEnvOverrides(base: NetworkConfig, env: NodeJS.ProcessEnv): NetworkConfig {
  const out: NetworkConfig = { ...base };
  for (const [field, varName] of ENV_OVERRIDES) {
    const v = env[varName];
    if (v) (out as unknown as Record<string, unknown>)[field] = v;
  }
  return out;
}

export function resolveNetwork(argv = process.argv, env = process.env, cwd = process.cwd()) {
  const flag = parseNetworkFlag(argv);
  const network: NetworkId = flag ?? (env.MIDNIGHT_NETWORK as NetworkId) ?? 'preview';
  if (!isNetworkId(network)) throw new Error(`Unknown network: ${network}`);
  return { network, config: applyEnvOverrides(NETWORK_CONFIGS[network], env), cwd };
}

export function normalizeMnemonic(mnemonic: string): string {
  return mnemonic.trim().toLowerCase().split(/\s+/).join(' ');
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(normalizeMnemonic(mnemonic), wordlist);
}

export function mnemonicToSeedHex(mnemonic: string): string {
  return Buffer.from(mnemonicToSeedSync(normalizeMnemonic(mnemonic))).toString('hex');
}

const SEED_HEX_RE = /^(?:[0-9a-fA-F]{2}){16,64}$/;

export interface WalletCredentials {
  seed: string;
  mnemonic: string | null;
}

export function getWalletFromEnv(env = process.env): WalletCredentials {
  const envSeed = env.MIDNIGHT_WALLET_SEED?.trim();
  const rawPhrase = (env.WALLET_SEED ?? env.MIDNIGHT_WALLET_MNEMONIC ?? '').trim();

  if (envSeed && rawPhrase) {
    throw new Error('Set only one of MIDNIGHT_WALLET_SEED or WALLET_SEED / MIDNIGHT_WALLET_MNEMONIC.');
  }

  if (envSeed) {
    const hex = envSeed.startsWith('0x') || envSeed.startsWith('0X') ? envSeed.slice(2) : envSeed;
    if (!SEED_HEX_RE.test(hex)) {
      throw new Error('MIDNIGHT_WALLET_SEED must be 32-128 even hex characters.');
    }
    return { seed: hex, mnemonic: null };
  }

  if (!rawPhrase) {
    throw new Error('Missing WALLET_SEED (24-word phrase) in .env');
  }

  if (rawPhrase.includes(' ')) {
    if (!isValidMnemonic(rawPhrase)) {
      throw new Error('WALLET_SEED is not a valid BIP-39 recovery phrase.');
    }
    return { seed: mnemonicToSeedHex(rawPhrase), mnemonic: normalizeMnemonic(rawPhrase) };
  }

  const hex = rawPhrase.startsWith('0x') ? rawPhrase.slice(2) : rawPhrase;
  if (!SEED_HEX_RE.test(hex)) {
    throw new Error('WALLET_SEED must be a BIP-39 phrase or 32-128 even hex characters.');
  }
  return { seed: hex, mnemonic: null };
}

export function recordDeployment(
  network: NetworkId,
  address: string,
  deployer: string,
  opts: FsOptions = {},
): void {
  const cwd = opts.cwd ?? process.cwd();
  const existing = loadState({ cwd });
  const next: NetworkState = existing ?? {
    version: STATE_VERSION,
    activeNetwork: network,
    wallets: {},
    deployments: {},
  };
  next.activeNetwork = network;
  next.deployments = {
    ...next.deployments,
    [network]: { address, deployer, deployedAt: new Date().toISOString() },
  };
  saveState(next, { cwd });
}
