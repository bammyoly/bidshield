import { classNames } from '../lib/format';

type State = 'COMMIT' | 'REVEAL' | 'AWARDED' | 'UNKNOWN';

const STYLES: Record<State, string> = {
  COMMIT: 'bg-sky-500/15 text-sky-300 ring-sky-500/20',
  REVEAL: 'bg-amber-500/15 text-amber-300 ring-amber-500/20',
  AWARDED: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20',
  UNKNOWN: 'bg-slate-500/15 text-slate-400 ring-slate-500/20',
};

const LABELS: Record<State, string> = {
  COMMIT: 'Accepting Bids',
  REVEAL: 'Reveal Phase',
  AWARDED: 'Awarded',
  UNKNOWN: 'Loading…',
};

export function StatusBadge({ state }: { state: State }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
        STYLES[state],
      )}
    >
      <span
        className={classNames(
          'h-1.5 w-1.5 rounded-full',
          state === 'COMMIT' && 'animate-pulse bg-sky-400',
          state === 'REVEAL' && 'animate-pulse bg-amber-400',
          state === 'AWARDED' && 'bg-emerald-400',
          state === 'UNKNOWN' && 'bg-slate-500',
        )}
      />
      {LABELS[state]}
    </span>
  );
}