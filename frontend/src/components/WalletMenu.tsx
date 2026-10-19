import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { classNames, shortAddress } from '../lib/format';
import { isLaceInstalled } from '../lib/lace';

function WalletIcon({ icon, name }: { icon: string; name: string }) {
  if (icon.startsWith('data:') || icon.startsWith('http')) {
    return <img src={icon} alt={name} className="h-5 w-5 shrink-0 object-contain" />;
  }
  return <span className="text-base">{icon}</span>;
}

export function WalletMenu() {
  const { available, session, connecting, error, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [laceDetected, setLaceDetected] = useState(false);

  useEffect(() => {
    const check = () => setLaceDetected(isLaceInstalled());
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, []);

  const handleMainButtonClick = () => {
    if (available.length >= 1) {
      connect(available[0]);
    } else {
      setOpen(!open);
    }
  };

  // ── Connected State ────────────────────────────────
  if (session) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 sm:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-xs text-emerald-300">
            {session.address} {/* Will display cleanly as 0x00b27667…158e88 */}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          Disconnect
        </button>
      </div>
    );
  }
  // ── Disconnected State ─────────────────────────────
  return (
    <div className="relative">
      <button
        onClick={handleMainButtonClick}
        disabled={connecting}
        className={classNames(
          'rounded-lg px-4 py-2 text-sm font-semibold transition-all',
          connecting
            ? 'bg-slate-700 text-slate-400'
            : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40',
        )}
      >
        {connecting ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Connecting…
          </span>
        ) : (
          'Connect Wallet'
        )}
      </button>

      {/* Dropdown for un-autoconnected states */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-white/[0.08] bg-[#12040a]/95 shadow-2xl backdrop-blur-2xl">
          <div className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
            Connect a Wallet
          </div>

          {available.length > 0 ? (
            available.map((w) => (
              <button
                key={w.name}
                onClick={() => {
                  connect(w);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/[0.04]"
              >
                <WalletIcon icon={w.icon} name={w.name} />
                <div className="flex-1">
                  <span className="font-semibold text-white">{w.name}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="mb-3 text-sm text-slate-400">
                {laceDetected
                  ? 'Lace detected. Click Connect to authorize.'
                  : 'No Midnight-compatible wallet detected.'}
              </p>
              <a
                href="https://www.lace.io/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
              >
                Install Lace Wallet
              </a>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-red-500/20 bg-red-500/10 p-4 shadow-2xl backdrop-blur-2xl">
          <p className="text-xs font-semibold text-red-300">Connection Failed</p>
          <p className="mt-1 text-xs leading-relaxed text-red-200/70">{error}</p>
        </div>
      )}
    </div>
  );
}