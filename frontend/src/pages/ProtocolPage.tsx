import { GlassCard } from '../components/GlassCard';

const SECTIONS = [
  {
    title: 'Commit Phase',
    accent: 'rose',
    items: [
      'The bidder generates a random 32-byte salt locally.',
      'A commitment hash is computed: H(tenderId ‖ bidder ‖ amount ‖ salt ‖ docHash).',
      'Only the bidder pseudonym and commitment hash are written to the ledger.',
      'The ZK proof verifies time-window and uniqueness constraints.',
    ],
  },
  {
    title: 'Reveal Phase',
    accent: 'amber',
    items: [
      'The bidder submits the original amount, salt, and document hash.',
      'The contract recomputes the commitment and checks it against the stored hash.',
      'On match, the amount and document hash become public ledger state.',
      'The salt is never written to the ledger.',
    ],
  },
  {
    title: 'Award Phase',
    accent: 'emerald',
    items: [
      'Only the organizer (verified by secret-derived pseudonym) can record the award.',
      'The winner must be a bidder with a successfully revealed bid.',
      'The award rationale hash is stored for off-chain audit.',
      'The contract transitions to the AWARDED terminal state.',
    ],
  },
];

const FLOW = [
  { label: 'Connect', desc: 'Wallet linked', color: 'rose' },
  { label: 'Commit', desc: 'Sealed hash on-chain', color: 'rose' },
  { label: 'Reveal', desc: 'Amount published', color: 'amber' },
  { label: 'Award', desc: 'Winner recorded', color: 'emerald' },
];

export function ProtocolPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.5s ease-out both; }
      `}</style>

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-8 md:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-rose-500/[0.12] blur-[80px]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
            Protocol
          </div>
          <h1 className="text-3xl font-bold text-white md:text-4xl">Protocol Details</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Technical overview of the BidShield commit-reveal-award workflow on Midnight.
          </p>
        </div>
      </div>

      {/* Flow strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {FLOW.map((f, i) => (
          <GlassCard key={f.label} className="p-4 text-center fade-up" style={{ animationDelay: `${i * 80}ms` } as any}>
            <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
              f.color === 'rose' ? 'bg-rose-500/15 text-rose-300' :
              f.color === 'amber' ? 'bg-amber-500/15 text-amber-300' :
              'bg-emerald-500/15 text-emerald-300'
            }`}>
              {i + 1}
            </div>
            <div className="text-sm font-semibold text-white">{f.label}</div>
            <div className="text-[10px] text-slate-500">{f.desc}</div>
            {i < FLOW.length - 1 && (
              <div className="hidden md:block absolute" />
            )}
          </GlassCard>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {SECTIONS.map((s, si) => (
          <GlassCard key={s.title} className="p-6 md:p-8 fade-up" style={{ animationDelay: `${si * 100 + 200}ms` } as any}>
            <div className="mb-5 flex items-center gap-3 border-b border-white/[0.05] pb-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                s.accent === 'rose' ? 'bg-rose-500/15 text-rose-300' :
                s.accent === 'amber' ? 'bg-amber-500/15 text-amber-300' :
                'bg-emerald-500/15 text-emerald-300'
              }`}>
                {si + 1}
              </div>
              <h2 className="text-lg font-semibold text-white">{s.title}</h2>
            </div>
            <ul className="space-y-3 text-sm leading-relaxed text-slate-400">
              {s.items.map((item, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    s.accent === 'rose' ? 'bg-rose-500/10 text-rose-400' :
                    s.accent === 'amber' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {i + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        ))}
      </div>

      {/* Commitment formula */}
      <GlassCard className="p-6 md:p-8">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Commitment Formula</h2>
        <div className="rounded-xl border border-white/[0.06] bg-black/30 p-5 font-mono text-sm text-rose-200">
          commitment = H(tenderId ‖ bidderPseudonym ‖ amount ‖ salt ‖ documentHash)
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Only the commitment hash and pseudonym are written to the ledger at commit time. The salt never leaves the bidder's local state. At reveal, the contract recomputes the hash and verifies equality.
        </p>
      </GlassCard>
    </div>
  );
}
