// frontend/src/pages/TendersPage.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { createTender, listTenders, type ApiTender } from '../lib/api';
import { deployTenderContract } from '../lib/midnight';
import { classNames } from '../lib/format';
import { preview, CONTRACT_ADDRESS } from '../contracts';
import { Search, Plus, RefreshCw, Calendar, MapPin, Tag, Shield, Loader2, AlertCircle } from 'lucide-react';

const CATEGORIES = [
  'Technology',
  'Software',
  'Hardware & Devices',
  'Medicine & Healthcare',
  'Construction',
  'Art & Design',
  'Energy & Infrastructure',
  'General Services',
];

function phaseOf(t: ApiTender) {
  if (t.status === 'awarded') return 'award';
  const now = Math.floor(Date.now() / 1000);
  if (now < t.commitEnd) return 'commit';
  return 'reveal';
}

function dateToUnix(dateStr: string) {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

function unixToDate(unix: number) {
  return new Date((unix || Math.floor(Date.now() / 1000)) * 1000).toISOString().slice(0, 16);
}

const defaultForm = () => {
  const now = Math.floor(Date.now() / 1000);
  return {
    title: '',
    description: '',
    category: 'Technology',
    location: '',
    minPrice: '',
    maxPrice: '',
    imageUrl: '',
    requirementsText: '',
    contact: '',
    commitStart: unixToDate(now),
    commitEnd: unixToDate(now + 86400 * 7),
  };
};

export function TendersPage() {
  const navigate = useNavigate();
  const { session, isConnected, walletAddress } = useWallet();
  const currentAddress = session?.signingAddress || session?.unshieldedAddress || '';

  const [tenders, setTenders] = useState<ApiTender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [creating, setCreating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'commit' | 'reveal' | 'award'>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTenders(await listTenders());
    } catch (err: any) {
      setError(err?.message || 'Could not load tenders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    setStatusMsg('Prompting Lace Wallet to sign contract deployment...');

    const startUnix = dateToUnix(form.commitStart);
    const endUnix = dateToUnix(form.commitEnd);
    if (startUnix >= endUnix) {
      setCreateError('Bidding close time must be after open time.');
      setCreating(false);
      setStatusMsg(null);
      return;
    }

    if (!session || !session.signingAddress) {
      setCreateError('Wallet session invalid. Please disconnect and reconnect Lace.');
      setCreating(false);
      setStatusMsg(null);
      return;
    }

    try {
      const { tenderIdHex, policyHash, contractAddress } = await deployTenderContract(
        form.title.trim(),
        session,
        startUnix,
        endUnix,
        endUnix + 30 * 24 * 60 * 60
      );

      setStatusMsg('Transaction authorized! Saving tender package to Midnight...');

      const tender = await createTender({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        location: form.location.trim(),
        minPrice: Number(form.minPrice) || 0,
        maxPrice: Number(form.maxPrice) || 0,
        imageUrl: form.imageUrl.trim(),
        contact: form.contact.trim(),
        requirements: form.requirementsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        commitStart: startUnix,
        commitEnd: endUnix,
        revealEnd: endUnix + 30 * 24 * 60 * 60,
        tenderIdHex,
        policyHash,
        contractAddress: contractAddress || CONTRACT_ADDRESS || preview.contractAddress || '',
        organizerAddress: session.signingAddress,
      });

      setModalOpen(false);
      setForm(defaultForm());
      navigate(`/tender/${tender.id || tender.tenderIdHex}`);
    } catch (err: any) {
      console.error('[CreateTender Error]:', err);
      setCreateError(err?.message || 'Failed to create tender.');
    } finally {
      setCreating(false);
      setStatusMsg(null);
    }
  };

  const filtered = useMemo(() => {
    return tenders.filter((t) => {
      const phase = phaseOf(t);
      if (phaseFilter !== 'all' && phase !== phaseFilter) return false;
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
      if (
        query &&
        !`${t.title} ${t.description} ${t.location}`.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      return true;
    });
  }, [tenders, query, categoryFilter, phaseFilter]);

  const counts = useMemo(() => {
    const c = { total: tenders.length, commit: 0, reveal: 0, award: 0 };
    tenders.forEach((t) => {
      const p = phaseOf(t);
      if (p === 'commit') c.commit++;
      else if (p === 'reveal') c.reveal++;
      else c.award++;
    });
    return c;
  }, [tenders]);

  const isUserConnected = isConnected || !!session || !!currentAddress;

  return (
    <div className="relative min-h-screen pb-24 overflow-hidden">
      {/* ── Global Styles & Animations ─────────────────────── */}
      <style>{`
        @keyframes float-slow { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.05); } }
        @keyframes float-slower { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,30px) scale(1.08); } }
        @keyframes grid-drift { 0% { transform: translate(0,0); } 100% { transform: translate(40px,40px); } }
        @keyframes fadeUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.5s ease-out both; }
        .glass-card { background: rgba(0,0,0,0.3); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.08); }
      `}</style>

      {/* ── Animated Background ────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0a0a12]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          animation: 'grid-drift 20s linear infinite',
        }} />
        <div className="absolute -top-40 right-1/4 h-[520px] w-[520px] rounded-full bg-rose-500/[0.12] blur-[140px]" style={{ animation: 'float-slow 14s ease-in-out infinite' }} />
        <div className="absolute top-1/3 -left-20 h-[420px] w-[420px] rounded-full bg-pink-500/[0.08] blur-[130px]" style={{ animation: 'float-slower 18s ease-in-out infinite' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Glass Card */}
        <div className="relative overflow-hidden rounded-3xl glass-card p-8 md:p-10 shadow-2xl">
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between z-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 mb-4 tracking-wide uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                Midnight Preview Network
              </div>
              <h1 className="text-3xl font-extrabold text-white md:text-5xl tracking-tight">Active Tenders</h1>
              <p className="mt-3 max-w-xl text-base text-slate-400 leading-relaxed">
                Browse open RFPs, commit sealed bids to the Midnight ZK ledger, and securely track reveals and awards.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {isUserConnected && (
                <button
                  onClick={() => {
                    setCreateError(null);
                    setForm(defaultForm());
                    setModalOpen(true);
                  }}
                  className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/25 transition-all hover:shadow-rose-500/40 hover:-translate-y-0.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Publish Tender
                </button>
              )}
              <button
                onClick={refresh}
                className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-200 backdrop-blur transition hover:bg-white/[0.08] hover:-translate-y-0.5 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="relative mt-10 grid grid-cols-2 gap-4 md:grid-cols-4 z-10">
            {[
              { label: 'Total Tenders', value: counts.total, color: 'text-white' },
              { label: 'Commit Phase', value: counts.commit, color: 'text-rose-400' },
              { label: 'Reveal Phase', value: counts.reveal, color: 'text-amber-400' },
              { label: 'Awarded', value: counts.award, color: 'text-emerald-400' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-5"
              >
                <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-sm font-medium text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center glass-card p-2 rounded-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tenders by title, description, or location…"
              className="w-full rounded-xl bg-transparent pl-11 pr-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-all placeholder-slate-500"
            />
          </div>
          <div className="h-8 w-px bg-white/[0.08] hidden md:block"></div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl bg-transparent px-4 py-3 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-rose-500/50 transition-all cursor-pointer min-w-[200px]"
          >
            <option value="All" className="text-slate-900 bg-white">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="text-slate-900 bg-white">
                {c}
              </option>
            ))}
          </select>
          <div className="h-8 w-px bg-white/[0.08] hidden md:block"></div>
          <div className="flex gap-1 p-1">
            {(['all', 'commit', 'reveal', 'award'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPhaseFilter(p)}
                className={classNames(
                  'rounded-lg px-4 py-2 text-sm font-semibold transition-all cursor-pointer',
                  phaseFilter === p
                    ? 'bg-rose-500/20 text-rose-300 shadow-inner border border-rose-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                )}
              >
                {p === 'all' ? 'All Phases' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="rounded-2xl glass-card overflow-hidden animate-pulse"
              >
                <div className="h-40 bg-white/[0.02]" />
                <div className="p-6 space-y-4">
                  <div className="h-4 w-24 rounded bg-white/[0.05]" />
                  <div className="h-6 w-3/4 rounded bg-white/[0.05]" />
                  <div className="h-4 w-1/2 rounded bg-white/[0.05]" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center rounded-3xl border border-dashed border-white/[0.1] bg-black/20 backdrop-blur">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04] text-slate-500">
              <Search className="h-8 w-8" />
            </div>
            <p className="text-slate-300 font-bold text-lg">No tenders found</p>
            <p className="mt-2 text-sm text-slate-500">
              Try adjusting your search criteria or create a new procurement tender.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t, i) => {
              const phase = phaseOf(t);
              const tenderId = t.id || t.tenderIdHex;
              return (
                <button
                  key={tenderId}
                  onClick={() => navigate(`/tender/${tenderId}`)}
                  className="group fade-up flex flex-col items-start overflow-hidden rounded-2xl glass-card text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-rose-500/50 hover:shadow-xl hover:shadow-rose-500/10 cursor-pointer"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="relative h-44 w-full overflow-hidden bg-[#1a1016]">
                    {t.imageUrl ? (
                      <img
                        src={t.imageUrl}
                        alt=""
                        className="h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-110 group-hover:opacity-100"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-900/40 to-pink-900/20">
                        <Shield className="w-12 h-12 text-rose-500/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a12] via-[#0a0a12]/40 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-slate-300 backdrop-blur-md border border-white/[0.08]">
                        <Tag className="w-3 h-3 text-rose-400" /> {t.category}
                      </span>
                      <span className={`px-3 py-1 text-xs font-bold rounded-full border backdrop-blur-md ${
                        phase === 'commit' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                        phase === 'reveal' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {phase.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="p-6 flex-1 w-full flex flex-col bg-black/20">
                    <h2 className="text-lg font-bold text-slate-100 group-hover:text-rose-400 transition-colors line-clamp-2">
                      {t.title}
                    </h2>
                    {t.description && (
                      <p className="mt-2 text-sm text-slate-400 line-clamp-2 flex-1">{t.description}</p>
                    )}
                    <div className="mt-5 pt-5 border-t border-white/[0.06] space-y-2 text-sm text-slate-400">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-slate-500" /> {t.committedCount ?? 0} Sealed Bids
                        </span>
                        <span className="font-mono text-xs font-medium text-emerald-400">
                          {t.minPrice} - {t.maxPrice} tDUST
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-4 h-4 text-slate-500" /> Closes: {unixToDate(t.commitEnd).split('T')[0]}
                        </span>
                        {t.location && (
                          <span className="flex items-center gap-1.5 text-xs truncate max-w-[120px]">
                            <MapPin className="w-4 h-4 text-slate-500 shrink-0" /> <span className="truncate">{t.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div
              className="absolute inset-0 bg-[#0a0a12]/80 backdrop-blur-sm transition-opacity"
              onClick={() => !creating && setModalOpen(false)}
            />
            <div className="relative z-[101] w-full max-w-3xl overflow-hidden rounded-3xl glass-card shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex-none border-b border-white/[0.08] bg-black/40 px-6 py-5 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-xl font-bold text-white">Publish Procurement Tender</h2>
                  <p className="text-sm text-slate-400 mt-1">Configure limits, requirements, and deployment parameters.</p>
                </div>
                <button
                  onClick={() => !creating && setModalOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-[#0a0a12]/80 custom-scrollbar">
                <form id="tender-form" onSubmit={submitCreate} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-300">Unique Project Title <span className="text-rose-400">*</span></label>
                    <input
                      required
                      value={form.title}
                      onChange={(e) => setField('title', e.target.value)}
                      placeholder="e.g. City Solar Grid Expansion"
                      className="w-full rounded-xl border border-white/[0.1] bg-black/50 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-300">Detailed Description <span className="text-rose-400">*</span></label>
                    <textarea
                      required
                      rows={4}
                      value={form.description}
                      onChange={(e) => setField('description', e.target.value)}
                      placeholder="Provide an overview of the procurement scope..."
                      className="w-full rounded-xl border border-white/[0.1] bg-black/50 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all resize-none"
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-300">Category <span className="text-rose-400">*</span></label>
                      <select
                        value={form.category}
                        onChange={(e) => setField('category', e.target.value)}
                        className="w-full rounded-xl border border-white/[0.1] bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 cursor-pointer"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c} className="text-slate-900 bg-white">
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-300">Location <span className="text-rose-400">*</span></label>
                      <input
                        required
                        value={form.location}
                        onChange={(e) => setField('location', e.target.value)}
                        placeholder="e.g. Global or City, Country"
                        className="w-full rounded-xl border border-white/[0.1] bg-black/50 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-300">Min Price Limit (tDUST) <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={form.minPrice}
                        onChange={(e) => setField('minPrice', e.target.value)}
                        className="w-full rounded-xl border border-white/[0.1] bg-black/50 px-4 py-3 text-sm font-mono text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-300">Max Price Limit (tDUST) <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        required
                        min={form.minPrice || "0"}
                        value={form.maxPrice}
                        onChange={(e) => setField('maxPrice', e.target.value)}
                        className="w-full rounded-xl border border-white/[0.1] bg-black/50 px-4 py-3 text-sm font-mono text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-300">Technical Requirements (One per line)</label>
                    <textarea
                      rows={4}
                      value={form.requirementsText}
                      onChange={(e) => setField('requirementsText', e.target.value)}
                      placeholder="- ISO 9001 Certification&#10;- Minimum 5 years experience..."
                      className="w-full rounded-xl border border-white/[0.1] bg-black/50 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all resize-none"
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-300">Bidding Opens <span className="text-rose-400">*</span></label>
                      <input
                        type="datetime-local"
                        required
                        value={form.commitStart}
                        onChange={(e) => setField('commitStart', e.target.value)}
                        className="w-full rounded-xl border border-white/[0.1] bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-300">Bidding Closes (Commit Deadline) <span className="text-rose-400">*</span></label>
                      <input
                        type="datetime-local"
                        required
                        value={form.commitEnd}
                        onChange={(e) => setField('commitEnd', e.target.value)}
                        className="w-full rounded-xl border border-white/[0.1] bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-300">Header Image URL (Optional)</label>
                    <input
                      value={form.imageUrl}
                      onChange={(e) => setField('imageUrl', e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full rounded-xl border border-white/[0.1] bg-black/50 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                    />
                  </div>
                </form>
              </div>

              <div className="flex-none border-t border-white/[0.08] bg-black/60 p-6 z-10 space-y-4">
                {statusMsg && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-300 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> {statusMsg}
                  </div>
                )}

                {createError && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300 flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {createError}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] py-3.5 text-sm font-bold text-slate-300 hover:bg-white/[0.08] transition-colors cursor-pointer backdrop-blur"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="tender-form"
                    disabled={creating}
                    className="flex-[2] rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/25 disabled:opacity-50 transition-all hover:shadow-rose-500/40 cursor-pointer"
                  >
                    {creating ? 'Processing on Midnight...' : 'Sign & Deploy Tender'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}