import type { ReactNode } from 'react';
import { classNames } from '../lib/format';

type Props = {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  hover?: boolean;
};

export function GlassCard({ children, className, glow, hover }: Props) {
  return (
    <div
      className={classNames(
        'rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl md:p-8',
        glow && 'glow-rose',
        hover && 'glass-hover cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  );
}