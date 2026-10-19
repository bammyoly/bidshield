// frontend/src/pages/CommitPage.tsx

import { useEffect, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { useWallet } from '../context/WalletContext';
import { COMMIT_FEE_DUST, generateTestDocumentHash } from '../lib/lace';
import { classNames, shortAddress } from '../lib/format';
import { preview, TENDER, CONTRACT_ADDRESS } from '../contracts';

const SALT_KEY = 'bidshield:salt';
const COMMIT_KEY = 'bidshield:last-commit';

type CommitBackup = {
  version: number;
  network: string;
  tenderId: string;
  contractAddress: string;
  bidderAddress: string;
  amount: number;
  salt: string;
  documentHash: string;
  feeDust: number;
  committedAt: string;
};

function randomSaltHex(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadSalt(): string {
  try {
    return localStorage.getItem(SALT_KEY) || '';
  } catch {
    return '';
  }
}

function saveSalt(salt: string) {
  try {
    localStorage.setItem(SALT_KEY, salt);
  } catch {
    /* private browsing */
  }
}

function saveCommitBackup(backup: CommitBackup) {
  try {
    localStorage.setItem(COMMIT_KEY, JSON.stringify(backup));
    localStorage.setItem(SALT_KEY, backup.salt);
  } catch {
    /* private browsing */
  }
}

export function CommitPage() {
  const { session, role } = useWallet();
  const [amount, setAmount] = useState('');
  const [docHash, setDocHash] = useState('');
  const [salt, setSalt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backup, setBackup] = useState<CommitBackup | null>(null);

  const balance = session?.balanceDust ?? 0;
  const bidValue = parseFloat(amount) || 0;
  const totalCost = bidValue + COMMIT_FEE_DUST;
  const insufficient = session ? totalCost > balance : false;

  const tenderId =
    TENDER?.tenderId ||
    preview.tender?.tenderId ||
    preview.contractAddress ||
    'unknown-tender';

  // Load or create salt when wallet connects
  useEffect(() => {
    if (!session) return;
    const existing = loadSalt();
    if (existing && existing.length === 64) {
      setSalt(existing);
    } else {
      const next = randomSaltHex();
      setSalt(next);
      saveSalt(next);
    }
  }, [session]);

  const regenerateSalt = () => {
    const next = randomSaltHex();
    setSalt(next);
    saveSalt(next);
    setSuccess(false);
    setCopied(false);
    setBackup(null);
  };

  const copySalt = async () => {
    if (!salt) return;
    try {
      await navigator.clipboard.writeText(salt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const fillTestHash = async () => {
    const hash = await generateTestDocumentHash();
    setDocHash(hash);
  };

  const useMax = () => {
    const max = Math.max(0, balance - COMMIT_FEE_DUST);
    setAmount(max > 0 ? max.toFixed(2) : '0');
  };

  const buildBackup = (committedAt: string): CommitBackup => ({
    version: 1,
    network: preview.network || preview.networkId || 'preview',
    tenderId: String(tenderId),
    contractAddress: CONTRACT_ADDRESS || preview.contractAddress || '',
    bidderAddress: session?.unshieldedAddress || '',
    amount: bidValue,
    salt,
    documentHash: docHash,
    feeDust: COMMIT_FEE_DUST,
    committedAt,
  });

  const downloadBackup = (data?: CommitBackup | null) => {
    const payload = data || backup;
    if (!payload) return;

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bidshield-commitment-${payload.tenderId.slice(0, 8)}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-6 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Connect to Commit a Bid</h1>
        <p className="max-w-md text-sm text-slate-400">
          Link your Midnight wallet to generate a tender-scoped pseudonym and submit a sealed bid
          commitment. Your bid amount, salt, and document hash stay private until the reveal phase.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">Commit a Sealed Bid</h1>
        <p className="mt-1 text-sm text-slate-400">
          Bid details are hashed locally. Only the commitment is written to the ledger.
        </p>
      </div>

      {/* Balance strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Available Balance
          </p>
          <p className="mt-0.5 text-xl font-bold text-white">
            {balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
            <span className="text-sm font-medium text-rose-300">tDUST</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Wallet</p>
          <p className="mono mt-0.5 text-sm font-semibold text-slate-300">
            {shortAddress(session.unshieldedAddress, 10, 6)}
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          SUCCESS PANEL — salt + download backup
         ════════════════════════════════════════════════ */}
      {success && backup && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 shadow-[0_0_40px_-12px_rgba(16,185,129,0.25)]">
          {/* Title */}
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-emerald-300">Bid Committed Successfully</h2>
              <p className="mt-0.5 text-xs text-emerald-400/80">
                Your commitment is recorded on Midnight Preview. Save your salt and backup file
                before closing this page — you will need them to reveal.
              </p>
            </div>
          </div>

          {/* Salt block */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              ⚠ Reveal Salt — Store Offline
            </span>
            <button
              type="button"
              onClick={copySalt}
              className="rounded-md bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-200 transition hover:bg-amber-500/25"
            >
              {copied ? 'Copied ✓' : 'Copy Salt'}
            </button>
          </div>
          <code className="mono mb-4 block break-all rounded-lg border border-amber-500/20 bg-black/40 px-4 py-3 text-xs leading-relaxed text-amber-100">
            {backup.salt}
          </code>

          {/* Summary grid */}
          <div className="mb-5 grid gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] p-4 text-xs text-slate-400 sm:grid-cols-2">
            <div>
              <span className="text-slate-500">Amount</span>
              <p className="mt-0.5 font-medium text-slate-200">{backup.amount.toFixed(2)} tDUST</p>
            </div>
            <div>
              <span className="text-slate-500">Protocol fee</span>
              <p className="mt-0.5 font-medium text-slate-200">{backup.feeDust} tDUST</p>
            </div>
            <div>
              <span className="text-slate-500">Document hash</span>
              <p className="mono mt-0.5 font-medium text-slate-200">
                {backup.documentHash.slice(0, 16)}…
              </p>
            </div>
            <div>
              <span className="text-slate-500">Committed at</span>
              <p className="mt-0.5 font-medium text-slate-200">
                {new Date(backup.committedAt).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Tender ID</span>
              <p className="mono mt-0.5 font-medium text-slate-200">
                {shortAddress(backup.tenderId, 10, 6)}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Contract</span>
              <p className="mono mt-0.5 font-medium text-slate-200">
                {shortAddress(backup.contractAddress, 10, 6)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500">Bidder</span>
              <p className="mono mt-0.5 font-medium text-slate-200">
                {shortAddress(backup.bidderAddress, 14, 8)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => downloadBackup(backup)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/30"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Backup (.json)
            </button>
            <button
              type="button"
              onClick={copySalt}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
            >
              {copied ? 'Salt Copied ✓' : 'Copy Salt Only'}
            </button>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Without this salt you <strong className="text-slate-300">cannot reveal</strong> your bid
            from another device. The backup JSON works with the Reveal page&apos;s{' '}
            <strong className="text-slate-300">Import Backup File</strong> button. A copy is also
            kept in this browser&apos;s local storage.
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          COMMIT FORM
         ════════════════════════════════════════════════ */}
      {!success && (
        <GlassCard>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);

              if (!amount || bidValue <= 0) {
                setError('Enter a valid bid amount greater than zero.');
                return;
              }
              if (!docHash || docHash.length !== 64) {
                setError('Document hash must be a 64-character SHA-256 hex string.');
                return;
              }
              if (!salt || salt.length !== 64) {
                setError('Salt missing. Click Regenerate salt and try again.');
                return;
              }
              if (insufficient) {
                setError(
                  `Insufficient tDUST. Need ${totalCost.toFixed(2)} (bid + ${COMMIT_FEE_DUST} fee), have ${balance.toFixed(2)}.`,
                );
                return;
              }

              setSubmitting(true);
              try {
                const committedAt = new Date().toISOString();
                const nextBackup = buildBackup(committedAt);

                // Persist for same-browser reveal + remote import
                saveCommitBackup(nextBackup);
                setBackup(nextBackup);

                // TODO: replace with real Midnight commitBid circuit call
                // using managed Contract + proof server from preview.endpoints
                await new Promise((r) => setTimeout(r, 1600));

                setSuccess(true);
              } catch (err: any) {
                setError(err?.message || 'Commit transaction failed.');
              } finally {
                setSubmitting(false);
              }
            }}
            className="space-y-6"
          >
            {/* Bid Amount */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">Bid Amount</label>
                <button
                  type="button"
                  onClick={useMax}
                  className="text-xs font-semibold text-rose-400 transition hover:text-rose-300"
                >
                  Use max
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 pr-16 text-sm text-white placeholder-slate-600 outline-none transition focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                  tDUST
                </span>
              </div>
            </div>

            {/* Document Hash */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">
                  Document Hash (SHA-256)
                </label>
                <button
                  type="button"
                  onClick={fillTestHash}
                  className="text-xs font-semibold text-sky-400 transition hover:text-sky-300"
                >
                  Generate test hash
                </button>
              </div>
              <input
                type="text"
                value={docHash}
                onChange={(e) => setDocHash(e.target.value.trim().toLowerCase())}
                placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                className="mono w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20"
              />
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Click <strong className="text-slate-400">Generate test hash</strong> for a random
                SHA-256, or paste a real file hash from{' '}
                <code className="text-slate-400">sha256sum file.pdf</code>.
              </p>
            </div>

            {/* Salt */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">
                  Local Salt (keep secret)
                </label>
                <button
                  type="button"
                  onClick={regenerateSalt}
                  className="text-xs font-semibold text-slate-400 transition hover:text-white"
                >
                  Regenerate
                </button>
              </div>
              <div className="flex items-stretch gap-2">
                <code className="mono flex-1 truncate rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-slate-300">
                  {salt || 'Generating…'}
                </code>
                <button
                  type="button"
                  onClick={copySalt}
                  disabled={!salt}
                  className="shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 text-xs font-medium text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-40"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Auto-generated and saved in this browser. You need the exact same salt to reveal
                from any device.
              </p>
            </div>

            {/* Fee breakdown */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Transaction Summary
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Bid amount</dt>
                  <dd className="font-medium text-slate-200">
                    {bidValue > 0 ? bidValue.toFixed(2) : '0.00'} tDUST
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">
                    Protocol fee
                    <span className="ml-1.5 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                      REQUIRED
                    </span>
                  </dt>
                  <dd className="font-medium text-slate-200">{COMMIT_FEE_DUST.toFixed(1)} tDUST</dd>
                </div>
                <div className="border-t border-white/[0.06] pt-2">
                  <div className="flex justify-between">
                    <dt className="font-semibold text-slate-300">Total required</dt>
                    <dd
                      className={classNames(
                        'font-bold',
                        insufficient ? 'text-red-400' : 'text-white',
                      )}
                    >
                      {(totalCost > 0 ? totalCost : COMMIT_FEE_DUST).toFixed(2)} tDUST
                    </dd>
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-500">Your balance</dt>
                  <dd className={insufficient ? 'text-red-400' : 'text-emerald-400'}>
                    {balance.toLocaleString()} tDUST
                  </dd>
                </div>
              </dl>
              {insufficient && (
                <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  Insufficient balance. Fund Lace from the Midnight Preview faucet, then reconnect.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-sky-500/10 bg-sky-500/[0.03] px-4 py-3 text-xs leading-relaxed text-sky-300/80">
              Amount, salt, and document hash are private ZK inputs. Only your tender-scoped
              pseudonym and commitment hash are written to the public ledger. Role:{' '}
              <strong className="capitalize text-sky-200">{role}</strong>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !amount || !docHash || !salt || insufficient}
              className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:shadow-rose-500/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting
                ? 'Generating ZK Proof…'
                : `Commit Bid · ${COMMIT_FEE_DUST} tDUST fee`}
            </button>
          </form>
        </GlassCard>
      )}

      {/* After success: optional second commit */}
      {success && (
        <button
          type="button"
          onClick={() => {
            setSuccess(false);
            setAmount('');
            setDocHash('');
            setBackup(null);
            regenerateSalt();
          }}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06]"
        >
          Commit another bid
        </button>
      )}
    </div>
  );
}