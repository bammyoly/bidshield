import { useEffect, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { useWallet } from '../context/WalletContext';
import { shortAddress } from '../lib/format';
import { preview, TENDER } from '../contracts';

const COMMIT_KEY = 'bidshield:last-commit';
const SALT_KEY = 'bidshield:salt';

type SavedCommitment = {
  amount: number;
  salt: string;
  documentHash: string;
  committedAt: string;
  tenderId: string;
};

export function RevealPage() {
  const { session } = useWallet();
  const [amount, setAmount] = useState('');
  const [salt, setSalt] = useState('');
  const [docHash, setDocHash] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  // Auto-detect from local storage if available on this browser
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COMMIT_KEY);
      const savedSalt = localStorage.getItem(SALT_KEY);

      if (raw) {
        const parsed: SavedCommitment = JSON.parse(raw);
        if (parsed.amount) setAmount(String(parsed.amount));
        if (parsed.documentHash) setDocHash(parsed.documentHash);
        if (parsed.salt) setSalt(parsed.salt);
        setAutoLoaded(true);
      } else if (savedSalt) {
        setSalt(savedSalt);
        setAutoLoaded(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Handle backup JSON file drop / upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.amount) setAmount(String(data.amount));
        if (data.salt) setSalt(data.salt);
        if (data.documentHash) setDocHash(data.documentHash);
        setError(null);
        setAutoLoaded(true);
      } catch {
        setError('Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-6 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Connect Wallet to Reveal Bid</h1>
        <p className="max-w-md text-sm text-slate-400">
          Connect the wallet you used during the commit window. You will need your exact bid amount,
          salt, and document hash to prove your commitment.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">Reveal Your Bid</h1>
        <p className="mt-1 text-sm text-slate-400">
          Re-enter or upload your committed bid details to verify the zero-knowledge proof against the public ledger.
        </p>
      </div>

      {/* Auto-detected notification */}
      {autoLoaded && (
        <div className="flex items-center justify-between rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs text-sky-300">
          <span>✓ Auto-filled commitment data from this browser's local storage.</span>
          <button
            type="button"
            onClick={() => {
              setAmount('');
              setSalt('');
              setDocHash('');
              setAutoLoaded(false);
            }}
            className="font-semibold underline hover:text-white"
          >
            Clear
          </button>
        </div>
      )}

      {/* File backup loader */}
      <GlassCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Revealing from another computer?</h3>
            <p className="text-xs text-slate-400">
              Upload your <code className="text-rose-300">bidshield-commitment.json</code> backup file.
            </p>
          </div>
          <label className="cursor-pointer shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]">
            Import Backup File
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </GlassCard>

      {/* Reveal Form */}
      <GlassCard>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setSuccess(false);

            if (!amount || parseFloat(amount) <= 0) {
              setError('Enter your exact committed bid amount.');
              return;
            }
            if (!salt || salt.length !== 64) {
              setError('Enter your 64-character salt.');
              return;
            }
            if (!docHash || docHash.length !== 64) {
              setError('Enter your 64-character SHA-256 document hash.');
              return;
            }

            setSubmitting(true);
            try {
              // TODO: execute revealBid circuit transaction
              await new Promise((r) => setTimeout(r, 2000));
              setSuccess(true);
            } catch (err: any) {
              setError(err?.message || 'Reveal failed. Commitment does not match provided inputs.');
            } finally {
              setSubmitting(false);
            }
          }}
          className="space-y-6"
        >
          {/* Bid Amount */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Committed Bid Amount (tDUST)
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 150000"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20"
            />
          </div>

          {/* Salt */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Secret Salt (64 hex characters)
            </label>
            <input
              type="text"
              value={salt}
              onChange={(e) => setSalt(e.target.value.trim().toLowerCase())}
              placeholder="Paste your 64-character secret salt"
              className="mono w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20"
            />
          </div>

          {/* Document Hash */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Document Hash (SHA-256)
            </label>
            <input
              type="text"
              value={docHash}
              onChange={(e) => setDocHash(e.target.value.trim().toLowerCase())}
              placeholder="Paste your 64-character SHA-256 document hash"
              className="mono w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              ✓ Bid revealed successfully! Your bid amount and document hash are now published on the Midnight ledger.
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !amount || !salt || !docHash}
            className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:shadow-rose-500/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Verifying ZK Proof & Revealing…' : 'Reveal Bid'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}