// frontend/src/pages/TenderDetail.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import {
  fetchTenderById,
  submitBid,
  revealBid,
  recordAward,
  getOrganizerToken,
  setOrganizerToken,
  downloadOrganizerKey,
  Tender,
  Bid,
} from '../lib/api';
import {
  commitBidOnChain,
  revealBidOnChain,
  recordAwardOnChain,
  makeCommitment,
  generateSampleHash,
  hashFile,
  isValidHash,
  normalizeHash,
} from '../lib/midnight';
import {
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Lock,
  Eye,
  Loader2,
  ArrowLeft,
  Shield,
  Tag,
  Building2,
  Trophy,
  Download,
  Upload,
  Hash,
  KeyRound,
} from 'lucide-react';

interface SavedBid {
  tenderId: string;
  tenderTitle: string;
  bidderAddress: string;
  orgName: string;
  email: string;
  amountTDust: number;
  saltHex: string;
  documentHash: string;
  commitmentHex: string;
  timestamp: string;
}

const storageKeyFor = (tenderId: string, address: string) =>
  `bidshield:bid:${tenderId}:${address}`;

function downloadBackup(bid: SavedBid) {
  const payload = {
    app: 'BidShield',
    version: 1,
    note: 'Keep this file private. You need the amount, salt and document hash to reveal your bid.',
    ...bid,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bidshield-bid-${bid.tenderId.slice(0, 8)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const inputBase =
  'w-full bg-black/50 border border-white/[0.1] rounded-xl px-4 py-3 text-white outline-none transition-all';

export const TenderDetail: React.FC = () => {
  const params = useParams<{ id?: string; tenderId?: string }>();
  const targetId = params.id || params.tenderId || '';
  const navigate = useNavigate();
  const { isConnected, session, walletAddress } = useWallet();
  const currentWalletAddress = session?.signingAddress || session?.unshieldedAddress || walletAddress || '';

  // Every address this wallet could be known by, lowercased for comparison
  const myAddresses = [session?.signingAddress, session?.unshieldedAddress, walletAddress]
    .filter(Boolean)
    .map((a) => (a as string).toLowerCase());

  const [tender, setTender] = useState<Tender | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Organizer key saved on this device (empty when this browser did not publish the tender)
  const [organizerToken, setOrganizerTokenState] = useState<string>(() => getOrganizerToken(targetId));
  const [keyInput, setKeyInput] = useState('');

  // Form states
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [bidInput, setBidInput] = useState('');
  const bidAmount = Number(bidInput) || 0;
  const [saltHex, setSaltHex] = useState('');
  const [docHash, setDocHash] = useState('');
  const [hashing, setHashing] = useState(false);
  const [savedBid, setSavedBid] = useState<SavedBid | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [txMessage, setTxMessage] = useState('');

  // silent reloads keep the page on screen instead of flashing the loading state
  const loadTenderDetail = useCallback(
    async (silent = false) => {
      if (!targetId) {
        setLoading(false);
        return;
      }
      try {
        if (!silent) setLoading(true);
        setError(null);
        const data = await fetchTenderById(targetId, organizerToken || undefined);
        setTender(data.tender);
        setBids(data.bids || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load tender details.');
      } finally {
        setLoading(false);
      }
    },
    [targetId, organizerToken]
  );

  useEffect(() => {
    loadTenderDetail();
  }, [loadTenderDetail]);

  // Countdown Timer Logic
  useEffect(() => {
    if (!tender) return;
    const updateTimer = () => {
      if (tender.status === 'awarded') {
        setTimeLeft('Procurement Awarded');
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const diff = tender.commitEnd - now;

      if (diff <= 0) {
        setTimeLeft('Reveal Phase Open');
      } else {
        const d = Math.floor(diff / 86400);
        const h = Math.floor((diff % 86400) / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [tender]);

  // Load the bid secrets saved on this device when this wallet committed
  useEffect(() => {
    if (!tender || !currentWalletAddress) return;
    try {
      const raw = localStorage.getItem(
        storageKeyFor(tender.tenderIdHex || targetId, currentWalletAddress)
      );
      if (!raw) {
        setSavedBid(null);
        return;
      }
      const saved = JSON.parse(raw) as SavedBid;
      if (!saved?.saltHex) return;
      setSavedBid(saved);
      setSaltHex((s) => s || saved.saltHex);
      setBidInput((a) => a || String(saved.amountTDust));
      setDocHash((h) => h || saved.documentHash || '');
    } catch {
      // Storage unavailable or corrupted, the user can load the backup file instead
    }
  }, [tender, currentWalletAddress, targetId]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen pb-32 text-slate-400 gap-4 bg-[#0a0a12]">
        <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
        <span className="font-semibold tracking-wide">Syncing from Midnight Network...</span>
      </div>
    );
  }

  if (!tender) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-start pt-32 justify-center">
        <div className="max-w-xl mx-auto px-4 text-center">
          <Shield className="w-16 h-16 mx-auto text-slate-700 mb-6" />
          <h2 className="text-2xl font-bold text-slate-300">Tender Record Not Found</h2>
          <p className="text-slate-500 mt-2">This package may not exist on the current network.</p>
          <button
            onClick={() => navigate('/tenders')}
            className="mt-8 px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:shadow-rose-500/25 text-white font-bold rounded-xl transition-all shadow-lg cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const tenderKey = tender.tenderIdHex || targetId;

  // The organizer is whoever uses the organizer wallet OR holds the organizer key on this device.
  // The key check catches a second wallet used from the organizer's own browser.
  const isOrganizerWallet =
    !!tender.organizerAddress && myAddresses.includes(tender.organizerAddress.toLowerCase());
  const holdsOrganizerKey = !!organizerToken;
  const isOrganizer = isOrganizerWallet || holdsOrganizerKey;

  // Organizers can never bid on their own tender, in simulation or on the network
  const organizerBlocked = isOrganizer;

  const existingUserBid = (bids || []).find(
    (b) =>
      currentWalletAddress &&
      b.bidderAddress.toLowerCase() === currentWalletAddress.toLowerCase()
  );

  const minLimit = tender.minPriceTDust ?? tender.minPrice ?? 0;
  const maxLimit = tender.maxPriceTDust ?? tender.maxPrice ?? 0;

  const requirementsList = Array.isArray(tender.requirements)
    ? tender.requirements
    : tender.requirements ? (tender.requirements as string).split('\n') : [];

  // The phase follows the clock, so it never depends on the backend flipping a status
  const nowSec = Math.floor(Date.now() / 1000);
  const phase: 'commit' | 'reveal' | 'award' =
    tender.status === 'awarded' ? 'award' : nowSec < tender.commitEnd ? 'commit' : 'reveal';
  const isBiddingClosed = phase !== 'commit';

  // Winner details, present when the backend returns them on the tender record
  const winnerAddress: string = (tender as any).awardWinnerAddress || '';
  const winnerOrg: string = (tender as any).awardWinnerOrg || '';
  const isWinnerBid = (b: Bid) =>
    !!b.isWinner ||
    (!!winnerAddress && b.bidderAddress.toLowerCase() === winnerAddress.toLowerCase());
  const iAmWinner =
    !!winnerAddress &&
    !!currentWalletAddress &&
    winnerAddress.toLowerCase() === currentWalletAddress.toLowerCase();

  const handleSaveOrganizerKey = () => {
    const key = keyInput.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(key)) {
      setError('The organizer key must be 64 hexadecimal characters.');
      return;
    }
    setOrganizerToken(tender.id, key);
    setOrganizerTokenState(key);
    setKeyInput('');
    setError(null);
  };

  const handleOrganizerKeyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const key = String(parsed?.organizerKey || '').trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('This file does not contain a valid organizer key.');
      if (parsed.tenderId && parsed.tenderId !== tender.id) {
        throw new Error('This organizer key belongs to a different tender.');
      }
      setOrganizerToken(tender.id, key);
      setOrganizerTokenState(key);
      setError(null);
    } catch (err: any) {
      setError(
        err instanceof SyntaxError ? 'That file is not a valid BidShield organizer key.' : err?.message || 'Could not read the key file.'
      );
    }
  };

  const handleDocFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setHashing(true);
      setError(null);
      setDocHash(await hashFile(file));
    } catch (err: any) {
      setError(
        err?.message || 'Could not hash this file. Open the app on localhost or https and try again.'
      );
    } finally {
      setHashing(false);
    }
  };

  const handleBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed?.saltHex || parsed.amountTDust == null || !parsed?.documentHash) {
        throw new Error('This backup file is missing bid details.');
      }
      if (parsed.tenderId && parsed.tenderId !== tenderKey) {
        throw new Error('This backup file belongs to a different tender.');
      }
      setBidInput(String(parsed.amountTDust));
      setSaltHex(String(parsed.saltHex));
      setDocHash(String(parsed.documentHash));
      setError(null);
    } catch (err: any) {
      setError(
        err instanceof SyntaxError ? 'That file is not a valid BidShield backup.' : err?.message || 'Could not read the backup file.'
      );
    }
  };

  const handleCommitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected && !currentWalletAddress) {
      setError('Please connect your Lace Wallet to commit a bid.');
      return;
    }
    if (organizerBlocked) {
      setError('Tender organizers cannot bid on their own tenders.');
      return;
    }
    if (phase !== 'commit') {
      setError('The commit window for this tender has closed.');
      return;
    }
    if (!(bidAmount > 0)) {
      setError('Enter a valid bid amount.');
      return;
    }
    if (!isValidHash(docHash)) {
      setError('Enter a valid document hash (0x followed by 64 hex characters), or generate a sample hash.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setTxMessage('Prompting Lace Wallet to sign ZK commitment transaction...');

      if (!session) throw new Error('No session active.');

      const documentHash = normalizeHash(docHash);
      const salt = `0x${Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`;
      const commitmentHex = await makeCommitment(bidAmount, salt, currentWalletAddress, documentHash);

      await commitBidOnChain(tender.contractAddress, commitmentHex, session, bidAmount, salt, documentHash);
      setTxMessage('Transaction authorized! Storing commitment record...');

      const record: SavedBid = {
        tenderId: tenderKey,
        tenderTitle: tender.title,
        bidderAddress: currentWalletAddress,
        orgName,
        email,
        amountTDust: bidAmount,
        saltHex: salt,
        documentHash,
        commitmentHex,
        timestamp: new Date().toISOString(),
      };

      // Keep the secrets on this device before talking to the server
      try {
        localStorage.setItem(storageKeyFor(tenderKey, currentWalletAddress), JSON.stringify(record));
      } catch {
        // Storage unavailable, the user can still download the backup file below
      }

      await submitBid(tenderKey, {
        bidderAddress: currentWalletAddress,
        orgName,
        email,
        commitmentHex,
      });

      setSavedBid(record);
      setTxMessage('');
      await loadTenderDetail(true);
    } catch (err: any) {
      setTxMessage('');
      setError(err.message || 'Failed to submit commitment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevealBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWalletAddress || !session) {
      setError('Please connect your Lace Wallet to reveal a bid.');
      return;
    }
    if (!isValidHash(docHash)) {
      setError('Enter the document hash from your backup file (0x followed by 64 hex characters).');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setTxMessage('Prompting Lace Wallet to authorize bid reveal verification...');

      const documentHash = normalizeHash(docHash);
      const salt = saltHex.trim();

      // Check the opening against the sealed commitment before sending anything
      const expected = (existingUserBid as any)?.commitmentHex;
      const actual = await makeCommitment(bidAmount, salt, currentWalletAddress, documentHash);
      if (expected && expected !== actual) {
        throw new Error('Amount, salt or document hash does not match your sealed commitment.');
      }

      await revealBidOnChain(tender.contractAddress, session, bidAmount, salt, documentHash);

      setTxMessage('Authorized! Verifying on-chain commitment match...');

      await revealBid(tenderKey, {
        bidderAddress: currentWalletAddress,
        amountTDust: bidAmount,
        saltHex: salt,
        documentHash,
      });

      setTxMessage('');
      await loadTenderDetail(true);
    } catch (err: any) {
      setTxMessage('');
      setError(err.message || 'Failed to reveal bid.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordAward = async (winningBidderAddress: string, amount: number) => {
    // Awarding needs the organizer key, so stop before asking the wallet to sign anything
    if (!organizerToken) {
      setError('Organizer key not found on this device. Load your organizer key below to select a winner.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setTxMessage('Prompting Lace Wallet for final procurement award transaction signature...');

      if (!session) throw new Error('No session active');

      await recordAwardOnChain(tender.contractAddress, winningBidderAddress, '0x00', '0x00', session);
      setTxMessage('Award transaction authorized! Notifying winning supplier...');

      await recordAward(
        tenderKey,
        {
          winnerAddress: winningBidderAddress,
          winningAmountTDust: amount,
        },
        organizerToken
      );

      setTxMessage('');
      await loadTenderDetail(true);
    } catch (err: any) {
      setTxMessage('');
      setError(err.message || 'Failed to record award.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen pb-24 overflow-hidden">
      {/* ── Global Styles & Animations ─────────────────────── */}
      <style>{`
        @keyframes float-slow { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.05); } }
        @keyframes float-slower { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,30px) scale(1.08); } }
        @keyframes grid-drift { 0% { transform: translate(0,0); } 100% { transform: translate(40px,40px); } }
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
        <div className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full bg-rose-500/[0.08] blur-[140px]" style={{ animation: 'float-slow 14s ease-in-out infinite' }} />
        <div className="absolute top-1/2 left-0 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-pink-500/[0.06] blur-[130px]" style={{ animation: 'float-slower 18s ease-in-out infinite' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Nav */}
        <button
          onClick={() => navigate('/tenders')}
          className="group inline-flex items-center gap-2 text-slate-400 hover:text-rose-400 text-sm font-semibold transition-colors cursor-pointer"
        >
          <div className="p-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] group-hover:bg-rose-500/20 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Back to Dashboard
        </button>

        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-3xl glass-card shadow-2xl">
          <div className="flex flex-col lg:flex-row">
            {tender.imageUrl && (
              <div className="lg:w-1/3 h-64 lg:h-auto relative">
                <img
                  src={tender.imageUrl}
                  alt={tender.title}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0a0a12] hidden lg:block" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a12] to-transparent lg:hidden" />
              </div>
            )}

            <div className="flex-1 p-8 lg:p-10 relative z-10 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold uppercase tracking-wider">
                    <Tag className="w-3.5 h-3.5" /> {tender.category}
                  </span>
                  <span className={`px-3 py-1 border rounded-lg text-xs font-bold uppercase tracking-wider ${
                    phase === 'commit' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    phase === 'reveal' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-pink-500/10 text-pink-400 border-pink-500/20'
                  }`}>
                    Phase: {phase}
                  </span>
                </div>

                <h1 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-6">
                  {tender.title}
                </h1>

                <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-medium">
                  {tender.location && (
                    <div className="flex items-center gap-2 text-slate-300 bg-black/40 px-4 py-2 rounded-xl border border-white/[0.08]">
                      <MapPin className="w-4 h-4 text-slate-400" /> {tender.location}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-300 bg-black/40 px-4 py-2 rounded-xl border border-white/[0.08]">
                    <Shield className="w-4 h-4 text-slate-400" /> Limits: <span className="font-mono text-rose-400 ml-1">{minLimit} - {maxLimit} tDUST</span>
                  </div>
                </div>
              </div>

              {/* Countdown Highlight */}
              <div className="mt-8 inline-flex items-center gap-4 bg-black/50 border border-white/[0.08] p-4 rounded-2xl w-max backdrop-blur-md">
                <Clock className={`w-8 h-8 ${isBiddingClosed ? 'text-amber-500' : 'text-emerald-500 animate-pulse'}`} />
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    {phase === 'award' ? 'Procurement Status' : phase === 'reveal' ? 'Commit Window Closed' : 'Time Remaining to Commit'}
                  </p>
                  <p className={`text-2xl font-black font-mono tracking-tight ${
                    phase === 'award' ? 'text-pink-400' :
                    phase === 'reveal' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {timeLeft}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
          </div>
        )}

        {txMessage && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-sm font-medium flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" /> {txMessage}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Brief & Requirements */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-3xl p-8 space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Project Description
              </h2>
              <p className="text-slate-300 whitespace-pre-line text-sm leading-relaxed">
                {tender.description}
              </p>
            </div>

            <div className="glass-card rounded-3xl p-8 space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Technical Requirements
              </h2>
              {requirementsList.length > 0 ? (
                <ul className="space-y-3 mt-4">
                  {requirementsList.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-3 bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
                      <CheckCircle2 className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300 text-sm">{req}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 text-sm italic">No specific technical requirements documented.</p>
              )}
            </div>

            {/* Organizer Evaluation / Public Bids View */}
            <div className="glass-card rounded-3xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Submitted Bids
                  <span className="bg-white/[0.06] text-slate-300 py-1 px-3 rounded-full text-sm ml-2">
                    {(bids || []).length} Total
                  </span>
                </h2>
              </div>

              {(bids || []).length === 0 ? (
                <div className="py-10 text-center border border-dashed border-white/[0.1] rounded-2xl bg-black/20">
                  <p className="text-slate-500 text-sm">No encrypted commitments received yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(bids || []).map((bid) => (
                    <div
                      key={bid._id || bid.bidderAddress}
                      className="p-5 bg-black/40 border border-white/[0.06] hover:border-white/[0.1] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${bid.status === 'revealed' ? 'bg-pink-500/10 text-pink-400' : 'bg-white/[0.04] text-slate-500'}`}>
                          {bid.status === 'revealed' ? <Eye className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                        </div>
                        <div>
                          <span className="font-bold text-slate-200 flex items-center gap-2 text-base">
                            {bid.orgName || bid.bidderAddress.slice(0, 10) + '...'}
                            {isWinnerBid(bid) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                                <Trophy className="w-3 h-3" /> Winner
                              </span>
                            )}
                          </span>
                          {/* Supplier email is only sent by the backend to the organizer */}
                          {bid.email && (
                            <span className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                              <Building2 className="w-3 h-3" /> {bid.email}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                        {bid.status === 'revealed' ? (
                          <div className="text-right">
                            <span className="block text-xs text-slate-500 font-semibold uppercase mb-0.5">Bid Amount</span>
                            <span className="font-mono text-rose-400 font-bold text-lg">
                              {bid.amountTDust} tDUST
                            </span>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
                            <Lock className="w-3.5 h-3.5" /> ZK Sealed
                          </span>
                        )}

                        {/* Organizer Award Button */}
                        {isOrganizer && phase === 'reveal' && bid.status === 'revealed' && (
                          <button
                            onClick={() => handleRecordAward(bid.bidderAddress, bid.amountTDust!)}
                            disabled={submitting}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Trophy className="w-4 h-4" /> Select Winner
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Interactive Action Panels */}
          <div className="space-y-6">

            {/* Organizer key */}
            {isOrganizer && (
              <div className="glass-card rounded-3xl p-6 lg:p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-rose-500/20 rounded-lg"><KeyRound className="w-5 h-5 text-rose-400" /></div>
                  <h2 className="text-xl font-bold text-white">Organizer Key</h2>
                </div>

                {organizerToken ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400 leading-relaxed">
                      The organizer key is saved on this device. It is needed to select the winner and to see supplier contact details. Organizers cannot bid on their own tender.
                    </p>
                    <button
                      type="button"
                      onClick={() => downloadOrganizerKey(tender.id, tender.title, organizerToken)}
                      className="w-full py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.12] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" /> Download organizer key (JSON)
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400 leading-relaxed">
                      This wallet published the tender, but no organizer key is saved on this device. Load the key file you downloaded when you created the tender, or paste the key.
                    </p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.12] text-slate-200 text-xs font-bold rounded-lg cursor-pointer transition-all">
                      <Upload className="w-3.5 h-3.5" /> Load key file
                      <input type="file" accept="application/json,.json" className="hidden" onChange={handleOrganizerKeyFile} />
                    </label>
                    <input
                      type="password"
                      placeholder="Paste organizer key (64 hex characters)"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      className={`${inputBase} font-mono text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500`}
                    />
                    <button
                      type="button"
                      onClick={handleSaveOrganizerKey}
                      disabled={!keyInput.trim()}
                      className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold text-sm rounded-xl disabled:opacity-50 cursor-pointer transition-all"
                    >
                      Save key on this device
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Award result */}
            {phase === 'award' && (
              <div className="glass-card rounded-3xl p-6 lg:p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-500/20 rounded-lg"><Trophy className="w-5 h-5 text-emerald-400" /></div>
                  <h2 className="text-xl font-bold text-white">Tender Awarded</h2>
                </div>
                {iAmWinner ? (
                  <p className="text-sm text-emerald-400 font-semibold leading-relaxed">
                    Congratulations, your bid won this tender.
                  </p>
                ) : (
                  <p className="text-sm text-slate-400 leading-relaxed">
                    This procurement has been awarded.
                  </p>
                )}
                {(winnerOrg || winnerAddress) && (
                  <div className="mt-4 bg-black/50 border border-white/[0.08] p-3 rounded-xl">
                    <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Winning Supplier</span>
                    {winnerOrg && <span className="block text-sm text-slate-200 font-semibold">{winnerOrg}</span>}
                    {winnerAddress && <span className="block font-mono text-xs text-slate-400 break-all mt-1">{winnerAddress}</span>}
                  </div>
                )}
              </div>
            )}

            {/* Phase 1: Commit Bid Form */}
            {phase === 'commit' && (
              <div className="glass-card rounded-3xl p-6 lg:p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-rose-500/20 rounded-lg"><Lock className="w-5 h-5 text-rose-400" /></div>
                  <h2 className="text-xl font-bold text-white">Commit Sealed Bid</h2>
                </div>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                  Your bid remains fully encrypted and hidden on the Midnight blockchain until the reveal phase.
                </p>

                {organizerBlocked ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 text-sm font-medium">
                    Organizers cannot submit bids on their own tenders.
                  </div>
                ) : existingUserBid ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-emerald-400 text-sm font-bold">Bid committed successfully</p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Your sealed commitment is recorded. Keep your backup file safe, because you need it to reveal your bid after the commit deadline.
                        </p>
                      </div>
                    </div>

                    {(savedBid?.commitmentHex || existingUserBid.commitmentHex) && (
                      <div className="bg-black/50 border border-white/[0.08] p-3 rounded-xl">
                        <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Your Commitment</span>
                        <span className="font-mono text-xs text-slate-300 break-all">
                          {savedBid?.commitmentHex || existingUserBid.commitmentHex}
                        </span>
                      </div>
                    )}

                    {savedBid ? (
                      <button
                        type="button"
                        onClick={() => downloadBackup(savedBid)}
                        className="w-full py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.12] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Download className="w-4 h-4" /> Download backup file (JSON)
                      </button>
                    ) : (
                      <p className="text-xs text-amber-400 leading-relaxed">
                        No backup was found on this device. If you committed from another browser, use the backup file you downloaded there.
                      </p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleCommitBid} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Organization Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Acme Corp"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className={`${inputBase} text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Contact Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="bids@acme.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`${inputBase} text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Private Bid Amount (tDUST) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        min={minLimit}
                        max={maxLimit > 0 ? maxLimit : undefined}
                        value={bidInput}
                        onChange={(e) => setBidInput(e.target.value)}
                        className={`${inputBase} font-mono text-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-500`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Document Hash (SHA 256) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="0x followed by 64 hex characters"
                        value={docHash}
                        onChange={(e) => setDocHash(e.target.value)}
                        pattern="^0[xX][0-9a-fA-F]{64}$"
                        title="0x followed by 64 hexadecimal characters"
                        className={`${inputBase} font-mono text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500`}
                      />
                      <div className="flex flex-wrap gap-2 mt-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.12] text-slate-200 text-xs font-bold rounded-lg cursor-pointer transition-all">
                          {hashing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          Hash a file
                          <input type="file" className="hidden" onChange={handleDocFile} disabled={hashing} />
                        </label>
                        <button
                          type="button"
                          onClick={() => setDocHash(generateSampleHash())}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.12] text-slate-200 text-xs font-bold rounded-lg cursor-pointer transition-all"
                        >
                          <Hash className="w-3.5 h-3.5" /> Generate sample hash
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                        Your document is hashed in the browser and never uploaded. Only the hash is bound to your sealed bid. Use a sample hash to try the flow without a real document.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || hashing || (!isConnected && !currentWalletAddress)}
                      className="w-full mt-2 py-3.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-rose-500/25 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 transition-all"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                      <span>{submitting ? 'Awaiting Lace Signature...' : 'Encrypt & Submit Bid'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Phase 2: Reveal Bid Form */}
            {phase === 'reveal' && (
              <div className="glass-card rounded-3xl p-6 lg:p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-amber-500/20 rounded-lg"><Eye className="w-5 h-5 text-amber-400" /></div>
                  <h2 className="text-xl font-bold text-white">Reveal Sealed Bid</h2>
                </div>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                  Provide your original bid amount, secret salt and document hash to verify your ZK commitment. You can load them from your backup file.
                </p>

                {!existingUserBid ? (
                  <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-slate-400 text-sm font-medium">
                    This wallet has no sealed bid on this tender.
                  </div>
                ) : existingUserBid.status === 'revealed' ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm font-medium flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5" /> Bid verified and revealed successfully!
                  </div>
                ) : (
                  <form onSubmit={handleRevealBid} className="space-y-4">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.12] text-slate-200 text-xs font-bold rounded-lg cursor-pointer transition-all">
                      <Upload className="w-3.5 h-3.5" /> Load from backup file
                      <input type="file" accept="application/json,.json" className="hidden" onChange={handleBackupFile} />
                    </label>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Original Bid Amount (tDUST)
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={bidInput}
                        onChange={(e) => setBidInput(e.target.value)}
                        className={`${inputBase} font-mono text-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Secret Salt (0x...)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="0x..."
                        value={saltHex}
                        onChange={(e) => setSaltHex(e.target.value)}
                        className={`${inputBase} font-mono text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Document Hash (0x...)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="0x followed by 64 hex characters"
                        value={docHash}
                        onChange={(e) => setDocHash(e.target.value)}
                        pattern="^0[xX][0-9a-fA-F]{64}$"
                        title="0x followed by 64 hexadecimal characters"
                        className={`${inputBase} font-mono text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500`}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || (!isConnected && !currentWalletAddress)}
                      className="w-full mt-2 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/25 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 transition-all"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
                      <span>{submitting ? 'Verifying Proof...' : 'Authorize & Reveal Bid'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Organizer Info Card (Only shown to bidders) */}
            {!isOrganizer && (
              <div className="glass-card rounded-3xl p-6">
                <h3 className="text-slate-200 font-bold mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" /> Organizer Info
                </h3>
                <div className="space-y-3">
                  <div className="bg-black/50 border border-white/[0.08] p-3 rounded-xl overflow-hidden text-ellipsis">
                    <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Public Key</span>
                    <span className="font-mono text-xs text-slate-300 break-all">{tender.organizerAddress}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Network Metadata Card */}
            <div className="glass-card rounded-3xl p-6">
              <h3 className="text-slate-200 font-bold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-400" /> Contract Binding
              </h3>
              <div className="space-y-3">
                <div className="bg-black/50 border border-white/[0.08] p-3 rounded-xl overflow-hidden text-ellipsis">
                  <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Policy Hash</span>
                  <span className="font-mono text-xs text-rose-400 break-all">{tender.policyHash || 'Pending'}</span>
                </div>
                <div className="bg-black/50 border border-white/[0.08] p-3 rounded-xl overflow-hidden text-ellipsis">
                  <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Contract Address</span>
                  <span className="font-mono text-xs text-slate-400 break-all">{tender.contractAddress || 'Pending'}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};