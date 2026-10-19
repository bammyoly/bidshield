import { classNames } from '../lib/format';

type Phase = 'commit' | 'reveal' | 'award';

const STEPS: { key: Phase; label: string; desc: string }[] = [
  { key: 'commit', label: 'Commit', desc: 'Suppliers submit sealed bids' },
  { key: 'reveal', label: 'Reveal', desc: 'Bids are opened and verified' },
  { key: 'award', label: 'Award', desc: 'Organizer records the winner' },
];

export function Timeline({ active }: { active: Phase }) {
  const activeIdx = STEPS.findIndex((s) => s.key === active);

  return (
    <div className="flex items-center gap-2 md:gap-4">
      {STEPS.map((step, i) => {
        const done = i < activeIdx;
        const current = i === activeIdx;
        return (
          <div key={step.key} className="flex items-center gap-2 md:gap-4">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={classNames(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-all md:h-10 md:w-10 md:text-sm',
                  done && 'border-emerald-500 bg-emerald-500/20 text-emerald-300',
                  current && 'border-rose-400 bg-rose-500/20 text-rose-300 shadow-lg shadow-rose-500/20',
                  !done && !current && 'border-slate-700 bg-slate-800/50 text-slate-500',
                )}
              >
                {done ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={classNames(
                  'text-[10px] font-medium md:text-xs',
                  current ? 'text-rose-300' : done ? 'text-emerald-400' : 'text-slate-600',
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={classNames(
                  'h-px w-8 md:w-16',
                  done ? 'bg-emerald-500/40' : 'bg-slate-700/50',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}