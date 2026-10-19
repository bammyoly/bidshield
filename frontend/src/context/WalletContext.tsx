//frontend/arc/context/WalletContext.tsx

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { preview } from '../contracts';
import { isOrganizer } from '../lib/identity';
import {
  connectWallet,
  listInjectedWallets,
  type ConnectedSession,
  type InjectedWallet,
} from '../lib/lace';

export type Role = 'observer' | 'supplier' | 'organizer';

type WalletContextValue = {
  available: InjectedWallet[];
  session: ConnectedSession | null;
  connecting: boolean;
  error: string | null;
  role: Role;
  refresh: () => void;
  connect: (wallet: InjectedWallet) => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState<InjectedWallet[]>([]);
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setAvailable(listInjectedWallets());
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2500);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const connect = useCallback(async (wallet: InjectedWallet) => {
    setConnecting(true);
    setError(null);
    try {
      const next = await connectWallet(wallet, preview.networkId || 'preview');
      setSession(next);
      (window as any).__bidshieldSession = next;
      console.log('[session]', next);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Wallet connection was rejected or failed.');
      setSession(null);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setSession(null);
    setError(null);
  }, []);

  // In WalletContext.tsx, update the role derivation to use signingAddress:

  const role: Role = useMemo(() => {
    if (!session?.signingAddress) return 'observer';
    if (isOrganizer(session.signingAddress, preview.deployer)) return 'organizer';
    return 'supplier';
  }, [session]);

  const value = useMemo(
    () => ({ available, session, connecting, error, role, refresh, connect, disconnect }),
    [available, session, connecting, error, role, refresh, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
