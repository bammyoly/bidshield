// frontend/src/components/Layout.tsx

import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { classNames, shortAddress } from '../lib/format';
import { preview } from '../contracts';
import { WalletMenu } from './WalletMenu';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/tenders', label: 'Tenders' }, // <-- Updated path
  { to: '/my-bids', label: 'My Bids' },
  { to: '/protocol', label: 'Protocol' },
  { to: '/privacy', label: 'Privacy' },
];

export function Layout() {
  const { session } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);

  const targetNetwork = preview.networkId || preview.network || 'preview';
  const networkMismatch =
    session?.networkId &&
    session.networkId.toLowerCase() !== targetNetwork.toLowerCase();

  return (
    <div className="sky-grid flex min-h-screen flex-col">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0105]/80 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 md:px-8">
          {/* Logo */}
          <NavLink to="/" className="flex shrink-0 items-center gap-3" onClick={() => setMobileOpen(false)}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg shadow-rose-500/20">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="hidden leading-tight sm:block">
              <span className="block text-base font-bold tracking-tight text-white">BidShield</span>
              <span className="block text-[9px] font-medium uppercase tracking-[0.18em] text-rose-400/70">
                Midnight Preview
              </span>
            </div>
          </NavLink>

          {/* Desktop Nav */}
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  classNames(
                    'rounded-lg px-4 py-2 text-[13px] font-medium transition-all duration-200',
                    isActive
                      ? 'bg-rose-500/15 text-rose-300 shadow-inner'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right section */}
          <div className="ml-auto flex items-center gap-3">
            <WalletMenu />

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileOpen && (
          <div className="border-t border-white/[0.06] bg-[#0a0105]/95 backdrop-blur-2xl lg:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    classNames(
                      'rounded-lg px-4 py-3 text-sm font-medium transition',
                      isActive
                        ? 'bg-rose-500/15 text-rose-300'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* ── Network Mismatch Banner ─────────────────── */}
      {networkMismatch && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-200">
          Wallet network is <span className="mono font-semibold">{session?.networkId}</span>; this tender contract is on{' '}
          <span className="mono font-semibold">{targetNetwork}</span>. Switch Lace to Midnight Preview before executing ZK proofs.
        </div>
      )}

      {/* ── Main Content ────────────────────────────── */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-8 md:py-12">
        <Outlet />
      </main>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] bg-[#0a0105]/60">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-xs leading-relaxed text-slate-500 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="max-w-xl">
            Revealed prices are public in this MVP. Documents stay off-chain in encrypted storage.
            A commitment match proves data integrity — not fairness of evaluation.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {preview.network || 'Midnight Preview'}
            </span>
            {preview.contractAddress && (
              <a
                href={preview.explorer || `https://explorer.preview.midnight.network/contract/${preview.contractAddress}`}
                target="_blank"
                rel="noreferrer"
                className="mono rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-slate-400 transition hover:border-rose-500/30 hover:text-rose-300"
                title="View contract on Midnight Explorer"
              >
                Contract: {shortAddress(preview.contractAddress, 8, 6)}
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}