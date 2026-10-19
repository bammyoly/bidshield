import { GlassCard } from '../components/GlassCard';
import { useWallet } from '../context/WalletContext'

export function AwardPage() {
  const { role } = useWallet();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">Award Record</h1>
        <p className="mt-1 text-sm text-slate-400">
          After the reveal window closes, the organizer may record the winning bid and a rationale
          hash on-chain.
        </p>
      </div>

      {role === 'organizer' ? (
        <GlassCard glow>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-rose-400">
            Organizer Actions
          </h2>
          <p className="mb-6 text-sm text-slate-400">
            Select the winning bidder pseudonym and provide a SHA-256 hash of your award rationale
            document. This action is irreversible.
          </p>
          <button
            disabled
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-3 text-sm font-semibold text-slate-500"
          >
            Record Award (available after reveal window)
          </button>
        </GlassCard>
      ) : (
        <GlassCard>
          <div className="py-8 text-center text-sm text-slate-500">
            The award has not yet been recorded. Check back after the reveal window closes.
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Current Award State
        </h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Winner</dt>
            <dd className="mono text-slate-400">No award recorded</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Rationale Hash</dt>
            <dd className="mono text-slate-400">—</dd>
          </div>
        </dl>
      </GlassCard>
    </div>
  );
}