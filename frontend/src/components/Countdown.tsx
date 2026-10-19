import { useEffect, useState } from 'react';
import { classNames } from '../lib/format';

export function Countdown({ targetUnix, label }: { targetUnix: number; label: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const diff = targetUnix - now;

      if (diff <= 0) {
        setTimeLeft('Closed');
        setIsPast(true);
        clearInterval(interval);
      } else {
        const d = Math.floor(diff / 86400);
        const h = Math.floor((diff % 86400) / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        
        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0 || d > 0) parts.push(`${h}h`);
        parts.push(`${m}m`);
        parts.push(`${s}s`);
        
        setTimeLeft(parts.join(' '));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetUnix]);

  return (
    <div className={classNames(
      "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold",
      isPast ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-amber-500/20 bg-amber-500/10 text-amber-300"
    )}>
      <span className="uppercase tracking-wider opacity-80">{label}</span>
      <span className="mono text-sm">{timeLeft || 'Calculating...'}</span>
    </div>
  );
}