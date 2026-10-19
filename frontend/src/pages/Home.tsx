import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../components/GlassCard';
import { Timeline } from '../components/Timeline';

/* ── Data ─────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: 'lock',
    title: 'Sealed Bids',
    desc: 'Suppliers commit encrypted bids before the deadline. Amounts and documents stay private until the reveal phase.',
    accent: 'rose',
  },
  {
    icon: 'shield',
    title: 'ZK Verification',
    desc: 'Zero-knowledge proofs on Midnight verify that revealed bids match their original commitments without leaking secrets early.',
    accent: 'pink',
  },
  {
    icon: 'ledger',
    title: 'Auditable Record',
    desc: 'Every commitment, reveal, and award is recorded on the Midnight ledger. Anyone can verify the workflow after the fact.',
    accent: 'rose',
  },
  {
    icon: 'pseudonym',
    title: 'Tender-Scoped Identity',
    desc: 'Bidders appear under a pseudonym unique to each tender, limiting cross-tender linkability of on-chain activity.',
    accent: 'pink',
  },
  {
    icon: 'hash',
    title: 'Document Integrity',
    desc: 'A hash of supporting documents is committed alongside the price, so tampering after submission is detectable.',
    accent: 'rose',
  },
  {
    icon: 'clock',
    title: 'Time-Boxed Windows',
    desc: 'Commit and reveal phases are enforced by contract state, preventing late submissions or premature disclosure.',
    accent: 'pink',
  },
];

const STEPS = [
  { num: '01', title: 'Connect', desc: 'Link your Midnight wallet via Lace or another compatible provider.' },
  { num: '02', title: 'Commit', desc: 'Submit a sealed bid with your price, salt, and document hash before the deadline.' },
  { num: '03', title: 'Reveal', desc: 'After the commit window closes, reveal your bid to prove it matches your commitment.' },
  { num: '04', title: 'Award', desc: 'The organizer records the winning bid and rationale hash on-chain.' },
];

const STATS = [
  { value: '100%', label: 'Commitment match verified' },
  { value: '0', label: 'Bid details on-chain at commit' },
  { value: 'ZK', label: 'Proofs on Midnight' },
  { value: 'Open', label: 'Audit trail for all' },
];

const FAQS = [
  {
    q: 'What does BidShield actually prove?',
    a: 'It proves that a revealed bid matches the commitment made before the deadline, and that the organizer authorized the award. It does not prove bids are truthful or documents authentic.',
  },
  {
    q: 'Where are the bid documents stored?',
    a: 'Documents live in encrypted off-chain storage controlled by the application and its users. Only their hashes are committed on-chain.',
  },
  {
    q: 'Are revealed prices public?',
    a: 'Yes. In this MVP, revealed prices and document hashes become public during the reveal phase. Commit-time details remain private until then.',
  },
  {
    q: 'Can a bidder be identified across tenders?',
    a: 'Pseudonyms are tender-scoped, but chain metadata and user disclosures can still create linkability. Treat pseudonymity as a limit, not a guarantee.',
  },
  {
    q: 'Is this a legal procurement workflow?',
    a: 'No. BidShield is a prototype demonstrating privacy-preserving commit/reveal on Midnight. Legal procurement, escrow, and dispute resolution are out of scope.',
  },
];

const ICONS: Record<string, React.ReactElement> = {
  lock: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  shield: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  ledger: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  pseudonym: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  hash: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
    </svg>
  ),
  clock: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

/* ── Scroll reveal hook ──────────────────────────────── */

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────── */

export function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="relative overflow-hidden">
      {/* global keyframes */}
      <style>{`
        @keyframes float-slow { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.05); } }
        @keyframes float-slower { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,30px) scale(1.08); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes grid-drift { 0% { transform: translate(0,0); } 100% { transform: translate(40px,40px); } }
        .text-gradient { background: linear-gradient(120deg,#fb7185,#f472b6,#c084fc); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .shimmer-text { background: linear-gradient(90deg,rgba(255,255,255,0.9) 0%,rgba(244,114,182,1) 50%,rgba(255,255,255,0.9) 100%); background-size: 200% 100%; -webkit-background-clip:text; background-clip:text; color:transparent; animation: shimmer 4s linear infinite; }
      `}</style>

      {/* ── Animated background ─────────────────────── */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0a0a12]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          animation: 'grid-drift 20s linear infinite',
        }} />
        <div className="absolute -top-40 left-1/4 h-[520px] w-[520px] rounded-full bg-rose-500/[0.12] blur-[140px]" style={{ animation: 'float-slow 14s ease-in-out infinite' }} />
        <div className="absolute top-1/3 -right-20 h-[420px] w-[420px] rounded-full bg-pink-500/[0.10] blur-[130px]" style={{ animation: 'float-slower 18s ease-in-out infinite' }} />
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-purple-500/[0.08] blur-[120px]" style={{ animation: 'float-slow 22s ease-in-out infinite' }} />
      </div>

      <div className="space-y-24 md:space-y-32 pb-24">
        {/* ── Hero ──────────────────────────────────── */}
        <section className="relative flex flex-col items-center text-center pt-8 md:pt-16">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs font-medium text-rose-300 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
              </span>
              Midnight · Commit-Reveal-Award Protocol
            </div>
          </Reveal>

          <Reveal delay={100}>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl">
              Seal. Reveal. Award.
              <br />
              <span className="shimmer-text">On Midnight.</span>
            </h1>
          </Reveal>

          <Reveal delay={200}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg">
              BidShield is a privacy-preserving tender protocol on Midnight. Suppliers commit a
              sealed bid — price, salt, and document hash — before the deadline. Bid details stay
              private until the reveal window. Zero-knowledge proofs then verify that every revealed
              bid matches its earlier commitment, and the organizer records the award with a
              rationale hash. Privacy before close. Verifiable integrity after.
            </p>
          </Reveal>

          <Reveal delay={300}>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-8">
              <Link
                to="/commit"
                className="group relative rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:shadow-rose-500/40 hover:-translate-y-0.5"
              >
                <span className="relative z-10">Submit a Bid</span>
                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 opacity-0 transition group-hover:opacity-100" />
              </Link>
              <Link
                to="/tender"
                className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-8 py-3 text-sm font-semibold text-slate-200 backdrop-blur transition hover:bg-white/[0.08] hover:-translate-y-0.5"
              >
                View Tender
              </Link>
            </div>
          </Reveal>

          {/* Hero preview card */}
          <Reveal delay={400} className="mt-16 w-full max-w-3xl">
            <GlassCard className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-rose-500/30">
                    B
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-white">Tender #042 — Sealed</div>
                    <div className="text-xs text-slate-500">Commit window closes in 2h 14m</div>
                  </div>
                </div>
                <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300">
                  Live
                </span>
              </div>
              <Timeline active="commit" />
              <div className="mt-6 grid grid-cols-3 gap-3">
                {['Bidder A', 'Bidder B', 'Bidder C'].map((b, i) => (
                  <div key={b} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <div className="text-xs text-slate-500">{b}</div>
                    <div className="mt-1 font-mono text-sm text-rose-300">0x••••{i + 1}a2f</div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full"
                        style={{ width: `${40 + i * 20}%`, animation: 'shimmer 3s linear infinite', backgroundSize: '200% 100%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </Reveal>
        </section>

        {/* ── Stats ─────────────────────────────────── */}
        <section>
          <Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STATS.map((s) => (
                <GlassCard key={s.label} className="p-6 text-center">
                  <div className="text-3xl md:text-4xl font-bold text-gradient">{s.value}</div>
                  <div className="mt-2 text-xs md:text-sm text-slate-400">{s.label}</div>
                </GlassCard>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── Features ──────────────────────────────── */}
        <section>
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-white md:text-3xl">How BidShield Protects Tenders</h2>
              <p className="mt-3 mx-auto max-w-xl text-sm text-slate-400">
                Privacy before close, verifiable integrity after. Every claim is either contract-verified or clearly labeled as an attestation.
              </p>
            </div>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <GlassCard hover className="p-6 h-full">
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${f.accent === 'rose' ? 'bg-rose-500/10 text-rose-400' : 'bg-pink-500/10 text-pink-400'}`}>
                    {ICONS[f.icon]}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-white">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{f.desc}</p>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Workflow Steps ────────────────────────── */}
        <section>
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-white md:text-3xl">Four Steps to a Verified Award</h2>
              <p className="mt-3 mx-auto max-w-xl text-sm text-slate-400">
                From wallet connection to on-chain award, each step is gated by contract state.
              </p>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.num} delay={i * 100}>
                <GlassCard className="relative overflow-hidden p-6 h-full">
                  <span className="absolute -right-2 -top-4 text-7xl font-black text-white/[0.04]">
                    {s.num}
                  </span>
                  <span className="mb-3 inline-block rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-400">
                    Step {s.num}
                  </span>
                  <h3 className="mb-1 text-base font-semibold text-white">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{s.desc}</p>
                  {i < STEPS.length - 1 && (
                    <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 text-rose-500/40">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  )}
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Privacy model ─────────────────────────── */}
        <section>
          <Reveal>
            <GlassCard className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300 mb-4">
                    Privacy Model
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                    Private until close. <span className="text-gradient">Verifiable after.</span>
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-slate-400">
                    Bid amounts, salts, and document hashes are supplied as private inputs during
                    commitment. They never touch the ledger until the reveal phase. After reveal,
                    anyone can recompute the commitment and confirm the match.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {[
                      'No bid details on-chain at commit time',
                      'Documents stay in encrypted off-chain storage',
                      'Commitment match verified by ZK proof',
                      'Award rationale hash recorded by organizer',
                    ].map((t) => (
                      <li key={t} className="flex items-center gap-3 text-sm text-slate-300">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-rose-300">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative">
                  <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-5 font-mono text-xs text-slate-300 backdrop-blur">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="ml-2 text-slate-500">commitment.ts</span>
                    </div>
                    <pre className="whitespace-pre-wrap leading-relaxed">
{`commit(bid, salt, docHash) {
  // private inputs — never public
  const c = hash(bid, salt, docHash);
  ledger.store(c, pseudonym);
  // only the commitment lands on-chain
  return c;
}

reveal(bid, salt, docHash) {
  assert(hash(bid,salt,docHash) == c);
  ledger.publish(bid, docHash);
}`}
                    </pre>
                  </div>
                </div>
              </div>
            </GlassCard>
          </Reveal>
        </section>

        {/* ── Trust boundaries ──────────────────────── */}
        <section>
          <Reveal>
            <GlassCard className="border-amber-500/10 bg-amber-500/[0.02] p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-amber-200">MVP Trust Boundaries</h3>
                  <p className="text-sm leading-relaxed text-slate-400">
                    BidShield verifies that revealed data matches commitments and that the organizer
                    authorized the award. It does <strong className="text-slate-300">not</strong> prove
                    that bids are truthful, documents are authentic, or that the buyer chose fairly.
                    Those remain procurement-policy and external-review questions.
                  </p>
                </div>
              </div>
            </GlassCard>
          </Reveal>
        </section>

        {/* ── FAQ ───────────────────────────────────── */}
        <section>
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-white md:text-3xl">Frequently Asked Questions</h2>
            </div>
          </Reveal>
          <div className="max-w-3xl mx-auto space-y-3">
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <GlassCard className="overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left"
                  >
                    <span className="text-sm font-semibold text-white">{f.q}</span>
                    <svg
                      className={`h-4 w-4 shrink-0 text-rose-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-out ${openFaq === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-relaxed text-slate-400">{f.a}</p>
                    </div>
                  </div>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────── */}
        <section>
          <Reveal>
            <GlassCard className="p-10 md:p-14 text-center">
              <h2 className="text-2xl md:text-4xl font-bold text-white">
                Ready to run a <span className="text-gradient">private tender?</span>
              </h2>
              <p className="mt-4 mx-auto max-w-xl text-sm md:text-base text-slate-400">
                Connect your Midnight wallet and submit a sealed bid in minutes. Every step is
                verifiable on-chain.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/commit"
                  className="rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:shadow-rose-500/40 hover:-translate-y-0.5"
                >
                  Submit a Bid
                </Link>
                <Link
                  to="/audit"
                  className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-8 py-3 text-sm font-semibold text-slate-200 backdrop-blur transition hover:bg-white/[0.08] hover:-translate-y-0.5"
                >
                  View Audit
                </Link>
              </div>
            </GlassCard>
          </Reveal>
        </section>
      </div>
    </div>
  );
}

export default HomePage;
