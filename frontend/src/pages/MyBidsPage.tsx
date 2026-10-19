import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { useWallet } from '../context/WalletContext';
import { getWalletHistory, type WalletHistory } from '../lib/api';
import { shortAddress } from '../lib/format';

function bidBadge(status: string) {
  if (status === 'awarded') return 'AWARDED' as const;
  if (status === 'revealed') return 'REVEAL' as const;
  return 'COMMIT' as const;
}

export function MyBidsPage() {
  const { session } = useWallet();
  const [history, setHistory] = useState<WalletHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.unshieldedAddress) {
      setHistory(null);
      return;
    }
    setLoading(true);
    setError(null);
    getWalletHistory(session.unshieldedAddress)
      .then(setHistory)
      .catch((e) => setError(e.message || 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [session?.unshieldedAddress]);

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-white">My Bids &amp; Awards</h1>
        <p className="text-sm text-slate-400">Connect a wallet to see commitments and wins.</p>
      </div>
    );
  }

  const commits = history?.myBids || [];
  const awards = history?.myAwards || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">My Bids &amp; Awards</h1>
        <p className="mt-1 text-sm text-slate-400">
          Wallet <span className="mono text-slate-300">{shortAddress(session.unshieldedAddress, 12, 8)}</span>
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
          <p className="mt-1 text-xs text-red-200/70">
            Check API is running and <code className="mono">GET /api/bids/wallet/…</code> works.
          </p>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-slate-500">Loading history…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard className="p-6">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-slate-400">
              My commitments ({commits.length})
            </h2>
            <p className="mb-4 text-xs text-slate-500">Every tender you sealed a bid on.</p>

            {commits.length === 0 ? (
              <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-8 text-center text-sm text-slate-500">
                No commitments yet.{' '}
                <Link to="/tenders" className="text-rose-300 hover:underline">
                  Browse tenders
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {commits.map((bid) => (
                  <Link
                    key={bid.id}
                    to={`/tender/${bid.tenderPublicId}`}
                    className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-rose-500/30 hover:bg-white/[0.04]"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-white">
                        {bid.tender?.title || 'Unknown tender'}
                      </h3>
                      <StatusBadge state={bidBadge(bid.status)} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{bid.organizationName}</span>
                      {bid.status !== 'committed' && bid.revealedAmount != null && (
                        <span className="text-emerald-400/90">{bid.revealedAmount} tDUST revealed</span>
                      )}
                      {bid.status === 'committed' && <span>Awaiting reveal window</span>}
                      {bid.status === 'awarded' && <span className="text-emerald-300">You won</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-slate-400">
              Awarded to me ({awards.length})
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Tenders where the organizer selected your wallet. Email is sent to the address you used at commit.
            </p>

            {awards.length === 0 ? (
              <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-8 text-center text-sm text-slate-500">
                No awards yet. Win after reveal + organizer decision.
              </div>
            ) : (
              <div className="space-y-3">
                {awards.map((a) => (
                  <Link
                    key={a.id}
                    to={`/tender/${a.id}`}
                    className="block rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 transition hover:bg-emerald-500/15"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-emerald-100">{a.title}</h3>
                      <StatusBadge state="AWARDED" />
                    </div>
                    {a.awardNote && (
                      <p className="mt-2 text-xs text-emerald-200/70 line-clamp-2">{a.awardNote}</p>
                    )}
                    {a.awardedAt && (
                      <p className="mt-2 text-[11px] text-slate-500">
                        {new Date(a.awardedAt).toLocaleString()}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}