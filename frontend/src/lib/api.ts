// frontend/src/lib/api.ts

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

// Dynamically format API_BASE_URL to guarantee it points to '/api' without duplicate slashes
const normalizedRaw = rawApiUrl.replace(/\/+$/, '');
export const API_BASE_URL = normalizedRaw.endsWith('/api')
  ? normalizedRaw
  : `${normalizedRaw}/api`;

export interface ApiTender {
  _id?: string;
  id: string;
  tenderIdHex: string;
  title: string;
  category: string;
  location: string;
  imageUrl?: string;
  description: string;
  requirements: string[];
  minPrice: number;
  maxPrice: number;
  minPriceTDust?: number;
  maxPriceTDust?: number;
  commitStart: number;
  commitEnd: number;
  revealEnd?: number;
  organizerAddress: string;
  policyHash: string;
  contractAddress: string;
  status: 'open' | 'published' | 'reveal' | 'awarded';
  awardWinnerAddress?: string;
  awardWinnerOrg?: string;
  awardNote?: string;
  awardedAt?: string | null;
  committedCount?: number;
  contact?: string;
  createdAt?: string;
  /** Only present on the response to createTender. Shown once, never returned again. */
  organizerToken?: string;
}

export type Tender = ApiTender;

export interface Bid {
  _id?: string;
  tenderPublicId: string;
  bidderAddress: string;
  orgName: string;
  email: string;
  commitmentHex: string;
  status: 'committed' | 'revealed';
  amountTDust?: number;
  saltHex?: string;
  documentHash?: string;
  isWinner?: boolean;
  createdAt?: string;
}

// ── Organizer key (kept on this device, sent as a header) ──────────────────

const organizerKeyStorage = (tenderId: string) => `bidshield:organizerKey:${tenderId}`;

export function getOrganizerToken(tenderId: string): string {
  try {
    return localStorage.getItem(organizerKeyStorage(tenderId)) || '';
  } catch {
    return '';
  }
}

export function setOrganizerToken(tenderId: string, token: string): void {
  try {
    localStorage.setItem(organizerKeyStorage(tenderId), token);
  } catch {
    // Storage unavailable, the organizer can still download the key file
  }
}

/** Explicit token wins, otherwise fall back to the one saved on this device. */
function resolveToken(tenderId: string, token?: string): string {
  return (token && token.trim()) || getOrganizerToken(tenderId);
}

function organizerHeaders(token: string): Record<string, string> {
  return token ? { 'x-organizer-token': token } : {};
}

export function downloadOrganizerKey(tenderId: string, tenderTitle: string, token: string): void {
  const payload = {
    app: 'BidShield',
    version: 1,
    note: 'Keep this file private. Anyone with this key can award this tender and read supplier contact details.',
    tenderId,
    tenderTitle,
    organizerKey: token,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bidshield-organizer-key-${tenderId.slice(0, 8)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Normalizes raw backend database records for UI component compatibility
 */
export function normalizeTender(raw: any): ApiTender {
  // The backend routes are keyed on publicId, so every API call must use that value
  const tenderId = raw.publicId || raw.id || raw.tenderIdHex || raw._id || '';
  const now = Math.floor(Date.now() / 1000);
  const commitStart =
    raw.commitStart ||
    (raw.biddingOpenAt ? Math.floor(new Date(raw.biddingOpenAt).getTime() / 1000) : now);
  const commitEnd =
    raw.commitEnd ||
    (raw.biddingCloseAt
      ? Math.floor(new Date(raw.biddingCloseAt).getTime() / 1000)
      : now + 86400 * 7);

  return {
    ...raw,
    id: tenderId,
    tenderIdHex: tenderId,
    _id: raw._id || tenderId,
    title: raw.title || '',
    description: raw.description || '',
    category: raw.category || 'Technology',
    location: raw.location || '',
    minPrice: raw.minPrice ?? raw.minPriceTDust ?? 0,
    maxPrice: raw.maxPrice ?? raw.maxPriceTDust ?? 0,
    minPriceTDust: raw.minPriceTDust ?? raw.minPrice ?? 0,
    maxPriceTDust: raw.maxPriceTDust ?? raw.maxPrice ?? 0,
    imageUrl: raw.imageUrl || '',
    requirements: Array.isArray(raw.requirements)
      ? raw.requirements
      : raw.requirements
      ? [raw.requirements]
      : [],
    commitStart,
    commitEnd,
    revealEnd: raw.revealEnd || commitEnd + 30 * 24 * 60 * 60,
    organizerAddress: raw.organizerAddress || '',
    contractAddress: raw.contractAddress || '',
    policyHash: raw.policyHash || '',
    status: raw.status || 'open',
    committedCount: raw.committedCount ?? raw.bidsCount ?? 0,
  };
}

/**
 * Maps a backend bid record to the shape the UI reads
 */
export function normalizeBid(raw: any): Bid {
  return {
    ...raw,
    _id: raw._id || raw.id,
    tenderPublicId: raw.tenderPublicId || '',
    bidderAddress: raw.bidderAddress || '',
    orgName: raw.orgName || raw.organizationName || '',
    email: raw.email || '',
    commitmentHex: raw.commitmentHex || '',
    status: raw.status === 'revealed' || raw.status === 'awarded' ? 'revealed' : 'committed',
    amountTDust: raw.amountTDust ?? raw.revealedAmount,
    saltHex: raw.saltHex ?? raw.revealedSalt,
    documentHash: raw.documentHash ?? raw.revealedDocumentHash,
    isWinner: raw.status === 'awarded' || !!raw.isWinner,
  };
}

/**
 * Fetch all published procurement tenders
 */
export async function listTenders(): Promise<ApiTender[]> {
  const res = await fetch(`${API_BASE_URL}/tenders`);
  if (!res.ok) {
    throw new Error('Failed to fetch tenders from database');
  }
  const data = await res.json();
  return Array.isArray(data) ? data.map(normalizeTender) : [];
}

export const fetchTenders = listTenders;

/**
 * Fetch tender detail and associated sealed bids.
 * With the organizer key the backend also returns supplier emails.
 */
export async function fetchTenderById(
  tenderIdHex: string,
  organizerToken?: string
): Promise<{ tender: ApiTender; bids: Bid[] }> {
  const token = resolveToken(tenderIdHex, organizerToken);

  const [tenderRes, bidsRes] = await Promise.all([
    fetch(`${API_BASE_URL}/tenders/${tenderIdHex}`),
    fetch(`${API_BASE_URL}/tenders/${tenderIdHex}/bids`, {
      headers: organizerHeaders(token),
    }).catch(() => null),
  ]);

  if (!tenderRes.ok) {
    throw new Error('Failed to fetch tender details');
  }
  const data = await tenderRes.json();

  let rawBids: any[] = Array.isArray(data.bids) ? data.bids : [];
  if (bidsRes && bidsRes.ok) {
    const bidsData = await bidsRes.json().catch(() => null);
    if (Array.isArray(bidsData?.bids)) rawBids = bidsData.bids;
    else if (Array.isArray(bidsData)) rawBids = bidsData;
  }

  return {
    tender: normalizeTender(data.tender || data),
    bids: rawBids.map(normalizeBid),
  };
}

/**
 * Register a new procurement tender on MongoDB read-model.
 * The backend returns the organizer key once. It is saved on this device
 * and also returned as `organizerToken` so the page can offer a download.
 */
export async function createTender(tenderData: Partial<ApiTender>): Promise<ApiTender> {
  const res = await fetch(`${API_BASE_URL}/tenders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tenderData),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create tender package');
  }

  const result = await res.json();
  const raw = result.tender || result;
  const created = normalizeTender(raw);

  if (raw.organizerToken) {
    setOrganizerToken(created.id, raw.organizerToken);
    created.organizerToken = raw.organizerToken;
  }
  return created;
}

/**
 * Submit sealed bid commitment.
 * The saved organizer key is attached when this device holds one, so the
 * backend can reject a bid coming from the organizer's own browser.
 */
export async function submitBid(
  tenderIdHex: string,
  payload: { bidderAddress: string; orgName: string; email: string; commitmentHex: string },
  organizerToken?: string
): Promise<Bid> {
  const res = await fetch(`${API_BASE_URL}/tenders/${tenderIdHex}/bids/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...organizerHeaders(resolveToken(tenderIdHex, organizerToken)),
    },
    body: JSON.stringify({
      bidderAddress: payload.bidderAddress,
      organizationName: payload.orgName,
      email: payload.email,
      commitmentHex: payload.commitmentHex,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to submit bid commitment');
  }

  const data = await res.json();
  return normalizeBid(data.bid || data);
}

/**
 * Reveal secret bid details
 */
export async function revealBid(
  tenderIdHex: string,
  payload: { bidderAddress: string; amountTDust: number; saltHex: string; documentHash: string }
): Promise<Bid> {
  const res = await fetch(`${API_BASE_URL}/tenders/${tenderIdHex}/bids/reveal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to reveal bid');
  }

  const data = await res.json();
  return normalizeBid(data.bid || data);
}

/**
 * Finalize procurement award. Requires the organizer key.
 */
export interface AwardResult {
  id: string;
  status: string;
  awardWinnerAddress: string;
  awardWinnerOrg: string;
  awardNote: string;
  email?: unknown;
}

export async function recordAward(
  tenderIdHex: string,
  payload: { winnerAddress: string; winningAmountTDust: number },
  organizerToken?: string
): Promise<AwardResult> {
  const res = await fetch(`${API_BASE_URL}/tenders/${tenderIdHex}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...organizerHeaders(resolveToken(tenderIdHex, organizerToken)),
    },
    body: JSON.stringify({
      status: 'awarded',
      awardWinnerAddress: payload.winnerAddress,
      awardNote: `Winning bid: ${payload.winningAmountTDust} tDUST`,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to record award');
  }

  return res.json();
}

/**
 * Fetch wallet history. The backend answers with myBids and myAwards.
 */
export async function getWalletHistory(
  address: string
): Promise<{ bids: Bid[]; awards: ApiTender[] }> {
  const res = await fetch(`${API_BASE_URL}/bids/wallet/${encodeURIComponent(address)}`);
  if (!res.ok) {
    throw new Error('Failed to fetch wallet history');
  }
  const data = await res.json();
  const rawBids = data.bids || data.myBids || [];
  const rawAwards = data.awards || data.myAwards || [];
  return {
    bids: Array.isArray(rawBids) ? rawBids.map(normalizeBid) : [],
    awards: Array.isArray(rawAwards) ? rawAwards.map(normalizeTender) : [],
  };
}