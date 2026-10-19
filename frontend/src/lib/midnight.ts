// frontend/src/lib/midnight.ts

import { getLaceWallet, type ConnectedSession } from './lace';

/**
 * Single switch for the whole app. While true, nothing is sent to Midnight:
 * deploy, commit, reveal and award are simulated locally.
 */
export const SIMULATED = true;

export type PrivateSecrets = {
  bidderSecret: Uint8Array;
  organizerSecret: Uint8Array;
};

// ── Utility Helpers ────────────────────────────────────────────────────────

export function stringToHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToUint8Array(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    const byteHex = clean.slice(i * 2, i * 2 + 2);
    bytes[i] = byteHex ? parseInt(byteHex, 16) : 0;
  }
  return bytes;
}

export function generatePolicyHash(title: string, creatorAddress: string): string {
  const seed = `${title}:${creatorAddress}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `0x${hex.repeat(8).substring(0, 64)}`;
}

function randomHex(bytes = 32): string {
  return (
    '0x' +
    Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Lowercases and trims a hash so every side formats it the same way. */
export function normalizeHash(hash: string): string {
  return String(hash || '').trim().toLowerCase();
}

/** A valid hash is 0x followed by 64 hex characters (32 bytes). */
export function isValidHash(hash: string): boolean {
  return /^0x[0-9a-f]{64}$/.test(normalizeHash(hash));
}

/** Random 32 byte hash so suppliers can try the flow without a real document. */
export function generateSampleHash(): string {
  return randomHex(32);
}

/** SHA 256 of a file, computed in the browser. The file is never uploaded. */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return (
    '0x' +
    Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Sealed bid commitment: SHA 256 over amount, salt, bidder address and document hash.
 * The bid amount cannot be recovered from the commitment, and the same
 * formula is used again at reveal time to check the opening.
 * Needs a secure context (localhost or https) for crypto.subtle.
 */
export async function makeCommitment(
  amount: number,
  salt: string,
  address: string,
  docHash: string,
): Promise<string> {
  const data = new TextEncoder().encode(
    `${amount}:${salt}:${address}:${normalizeHash(docHash)}`,
  );
  const digest = await crypto.subtle.digest('SHA-256', data);
  return (
    '0x' +
    Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Simulates ZK proof computation delay so the UI behaves like a real prove and submit.
 */
async function simulateZkProvingDelay(ms = 1200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addressOf(session: ConnectedSession): string {
  const address = session?.signingAddress || session?.unshieldedAddress;
  if (!address) {
    throw new Error('Wallet session is invalid. Please disconnect and reconnect Lace.');
  }
  return address;
}

/**
 * Asks Lace for a signature. If the user rejects the prompt, the action is aborted.
 * If the connector does not support signing, the simulation carries on.
 */
async function promptLaceSignature(message: string): Promise<boolean> {
  try {
    const lace = await getLaceWallet();
    if (lace && typeof lace.signData === 'function') {
      await lace.signData(message, { encoding: 'text', keyType: 'unshielded' });
      return true;
    }
  } catch (err: any) {
    if (err?.code === 'Rejected') {
      throw new Error('Signature request was rejected in Lace.');
    }
    console.warn('[Lace Signature Notice]: signData unavailable or failed:', err);
  }
  return false;
}

// ── 1. DEPLOY TENDER CONTRACT ──────────────────────────────────────────────

export async function deployTenderContract(
  title: string,
  session: ConnectedSession,
  _commitStart?: number,
  _commitEnd?: number,
  _revealEnd?: number,
): Promise<{ tenderIdHex: string; policyHash: string; contractAddress: string }> {
  const signingAddress = addressOf(session);

  await promptLaceSignature(`Deploy BidShield Procurement Contract: "${title}"`);
  await simulateZkProvingDelay(1500);

  const policyHash = generatePolicyHash(title, signingAddress);
  const rawTenderId = stringToHex(`tender:${title}:${Date.now()}`).padEnd(64, '0').slice(0, 64);

  return {
    tenderIdHex: `0x${rawTenderId}`,
    policyHash,
    contractAddress: randomHex(32),
  };
}

// ── 2. COMMIT SEALED BID ───────────────────────────────────────────────────

export async function commitBidOnChain(
  contractAddress: string,
  commitmentHex: string,
  session: ConnectedSession,
  amountTDust: number,
  saltHex: string,
  docHashHex: string,
): Promise<{ txHash: string; status: string }> {
  addressOf(session);

  // The amount is deliberately left out of the signed message so it stays private.
  await promptLaceSignature(
    `Commit sealed bid to contract ${contractAddress.slice(0, 12)}…`
  );
  await simulateZkProvingDelay(1500);

  return {
    txHash: randomHex(32),
    status: 'committed',
  };
}

// ── 3. REVEAL BID ──────────────────────────────────────────────────────────

export async function revealBidOnChain(
  contractAddress: string,
  session: ConnectedSession,
  amountTDust: number,
  saltHex: string,
  docHashHex: string,
): Promise<{ txHash: string; status: string }> {
  addressOf(session);

  await promptLaceSignature(
    `Reveal bid of ${amountTDust} tDUST on contract ${contractAddress.slice(0, 12)}…`
  );
  await simulateZkProvingDelay(1500);

  return {
    txHash: randomHex(32),
    status: 'revealed',
  };
}

// ── 4. RECORD AWARD ────────────────────────────────────────────────────────

export async function recordAwardOnChain(
  contractAddress: string,
  winnerAddress: string,
  memoHashHex: string,
  organizerSecretHex: string,
  session: ConnectedSession,
): Promise<{ txHash: string; status: string }> {
  addressOf(session);

  await promptLaceSignature(`Record procurement award to ${winnerAddress.slice(0, 12)}…`);
  await simulateZkProvingDelay(1500);

  return {
    txHash: randomHex(32),
    status: 'awarded',
  };
}