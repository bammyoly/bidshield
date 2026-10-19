import { GlassCard } from '../components/GlassCard';

const ON_CHAIN = [
  'Bidder pseudonym (tender-scoped hash)',
  'Commitment hash',
  'Revealed bid amount',
  'Revealed document hash',
  'Award winner pseudonym and rationale hash',
  'Tender configuration and timestamps',
];

const OFF_CHAIN = [
  'Bid document contents (encrypted storage)',
  'Bidder salt (local private state only)',
  'Bidder real-world identity',
  'Organizer secret',
  'Evaluation criteria and scoring',
];

const LIMITATIONS = [
  'Revealed prices are public after the reveal phase.',
  'A commitment match does not prove the bid is truthful or the document is authentic.',
  'The contract does not enforce fair evaluation or lowest-bid selection.',
  'Chain metadata and user disclosures may create linkability despite pseudonyms.',
  'This MVP has not undergone a security audit.',
];

const GUARANTEES = [
  { title: 'Commit-time privacy', desc: 'Bid amounts and document hashes never touch the ledger until reveal.', icon: 'lock' },
  { title: 'Commitment integrity', desc: 'ZK proofs verify revealed data matches the original commitment.', icon: 'shield' },
  { title: 'Auditable trail', desc: 'Every commitment, reveal, and award is publicly verifiable.', icon: 'ledger' },
  { title: 'Pseudonymity', desc: 'Bidders appear under tender-scoped pseudonyms.', icon: 'user' },
];

export function PrivacyPage() {
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
            Privacy Model
          </div>
          <h1 className="text-3xl font-bold text-white md:text-4xl">What BidShield Protects</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            What stays private, what becomes public, and what the protocol cannot guarantee. Transparency about limits is part of the design.
          </p>
        </div>
      </div>

      {/* Guarantees */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GUARANTEES.map((g, i) => (
          <GlassCard key={g.title} className="p-5 fade-up" style={{ animationDelay: `${i * 80}ms` } as any}>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
              {g.icon === 'lock' && (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              )}
              {g.icon === 'shield' && (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              )}
              {g.icon === 'ledger' && (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              )}
              {g.icon === 'user' && (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              )}
            </div>
            <h3 className="text-sm font-semibold text-white">{g.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{g.desc}</p>
          </GlassCard>
        ))}
      </div>

      {/* On-chain / Off-chain */}
      <div className="grid gap-6 md:grid-cols-2">
        <GlassCard className="border-emerald-500/10 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            On-Chain (Public)
          </h2>
          <ul className="space-y-2.5 text-sm text-slate-400">
            {ON_CHAIN.map((item) => (
              <li key={item} className="flex gap-3 items-start">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard className="border-sky-500/10 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-sky-400">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
            Off-Chain (Private)
          </h2>
          <ul className="space-y-2.5 text-sm text-slate-400">
            {OFF_CHAIN.map((item) => (
              <li key={item} className="flex gap-3 items-start">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75" />
                  </svg>
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      {/* Limitations */}
      <GlassCard className="border-amber-500/10 bg-amber-500/[0.02] p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          Known Limitations
        </h2>
        <ul className="space-y-3 text-sm leading-relaxed text-slate-400">
          {LIMITATIONS.map((item) => (
            <li key={item} className="flex gap-3 items-start">
              <span className="mt-0.5 text-amber-500">⚠</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
