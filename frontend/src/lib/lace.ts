// frontend/src/lib/lace.ts

export interface ShieldedAddresses {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
}

export interface UnshieldedAddress {
  unshieldedAddress: string;
}

export interface SignDataOptions {
  encoding: 'text' | 'hex' | 'base64';
  keyType: 'unshielded';
}

export interface LaceWalletApi {
  getShieldedAddresses?: () => Promise<ShieldedAddresses>;
  getUnshieldedAddress?: () => Promise<UnshieldedAddress>;
  signData?: (data: string, options: SignDataOptions) => Promise<any>;
  balanceUnsealedTransaction?: (tx: any, ttl?: Date) => Promise<any>;
  submitTransaction?: (tx: any) => Promise<string>;
  enable?: () => Promise<LaceWalletApi>;
  connect?: (network: string) => Promise<LaceWalletApi>;
}

export interface InjectedWallet {
  name: string;
  icon?: string;
  apiVersion?: string;
  isLace?: boolean;
}

export interface ConnectedSession {
  address: string;                     // Truncated display address
  signingAddress: string;              // Address used as the wallet identity
  unshieldedAddress: string;           // Full unshielded address
  network: string;
  shieldedCoinPublicKey: string;       // Native Bech32m string from Lace
  shieldedEncryptionPublicKey: string; // Native Bech32m string from Lace
}

function getInjectedLace(): any {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  const mn = w.midnight;
  if (!mn) return null;

  // Known keys first
  if (mn.mnLace) return mn.mnLace;
  if (mn.lace) return mn.lace;

  // Then scan every injected wallet, since newer builds use a UUID key
  for (const wallet of Object.values<any>(mn)) {
    if (!wallet || typeof wallet !== 'object') continue;
    const name = String(wallet.name || '').toLowerCase();
    const rdns = String(wallet.rdns || '').toLowerCase();
    if (name.includes('lace') || rdns.includes('lace')) return wallet;
  }
  return null;
}

export function waitForLace(timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    if (getInjectedLace()) return resolve(true);
    const start = Date.now();
    const timer = setInterval(() => {
      if (getInjectedLace()) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 150);
  });
}

let cachedApi: LaceWalletApi | null = null;

export function listInjectedWallets(): InjectedWallet[] {
  if (typeof window === 'undefined') return [];
  const lace = getInjectedLace();
  if (lace) return [{ name: 'Lace Wallet (Midnight)', isLace: true }];
  return [];
}

export function isLaceInstalled(): boolean {
  return !!getInjectedLace();
}

export async function getLaceWallet(): Promise<LaceWalletApi | null> {
  if (cachedApi) return cachedApi;
  const lace = getInjectedLace();
  if (!lace) return null;

  try {
    if (typeof lace.connect === 'function') {
      cachedApi = await lace.connect('preview');
    } else if (typeof lace.enable === 'function') {
      cachedApi = await lace.enable();
    } else {
      cachedApi = lace;
    }
    return cachedApi;
  } catch (err) {
    console.warn('Lace wallet connection failed:', err);
    return null;
  }
}

export async function connectLace(
  _wallet?: InjectedWallet,
  network?: string,
): Promise<ConnectedSession> {
  // Clear cache on explicit reconnect
  cachedApi = null;
  const lace = await getLaceWallet();
  if (!lace) {
    throw new Error('Lace wallet extension not detected. Please install Lace.');
  }

  if (typeof lace.getShieldedAddresses !== 'function') {
    throw new Error('This Lace version does not expose getShieldedAddresses. Please update Lace.');
  }

  const shielded = await lace.getShieldedAddresses();
  const unshieldedObj = typeof lace.getUnshieldedAddress === 'function'
    ? await lace.getUnshieldedAddress()
    : null;

  const unshieldedAddress = unshieldedObj?.unshieldedAddress || shielded.shieldedAddress;
  const displayAddress = `${unshieldedAddress.slice(0, 16)}…${unshieldedAddress.slice(-6)}`;

  return {
    address: displayAddress,
    signingAddress: unshieldedAddress,
    unshieldedAddress,
    network: network || 'preview',
    shieldedCoinPublicKey: shielded.shieldedCoinPublicKey,
    shieldedEncryptionPublicKey: shielded.shieldedEncryptionPublicKey,
  };
}

export const connectWallet = connectLace;