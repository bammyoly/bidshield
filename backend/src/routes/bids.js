// backend/src/routes/bids.js

import { Router } from 'express';
import crypto from 'node:crypto';
import { Bid } from '../models/Bid.js';
import { Tender } from '../models/Tender.js';
import { tokenFromReq, tokenMatches } from '../lib/organizerAuth.js';

const router = Router({ mergeParams: true });

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Same formula as makeCommitment in frontend/src/lib/midnight.ts
function commitmentOf(amount, salt, address, docHash) {
  return (
    '0x' +
    crypto
      .createHash('sha256')
      .update(`${amount}:${salt}:${address}:${docHash}`)
      .digest('hex')
  );
}

// GET /api/bids/wallet/:address  — MUST work when mounted at /api/bids
router.get('/wallet/:address', async (req, res) => {
  try {
    const address = decodeURIComponent(req.params.address || '').trim();
    if (!address) return res.status(400).json({ error: 'address required' });

    // Case-insensitive match for wallet strings
    const bids = await Bid.find({
      bidderAddress: { $regex: new RegExp(`^${escapeRegex(address)}$`, 'i') },
    })
      .sort({ createdAt: -1 })
      .lean();

    const tenderIds = [...new Set(bids.map((b) => b.tenderPublicId))];
    const tenders = await Tender.find({ publicId: { $in: tenderIds } }).lean();
    const tenderMap = Object.fromEntries(tenders.map((t) => [t.publicId, t]));

    const myBids = bids.map((b) => ({
      id: String(b._id),
      tenderPublicId: b.tenderPublicId,
      bidderAddress: b.bidderAddress,
      organizationName: b.organizationName || 'Anonymous Supplier',
      email: b.email || '',
      status: b.status,
      revealedAmount: b.revealedAmount,
      revealedDocumentHash: b.revealedDocumentHash,
      createdAt: b.createdAt,
      tender: tenderMap[b.tenderPublicId]
        ? {
            id: tenderMap[b.tenderPublicId].publicId,
            title: tenderMap[b.tenderPublicId].title,
            category: tenderMap[b.tenderPublicId].category,
            status: tenderMap[b.tenderPublicId].status,
            commitEnd: tenderMap[b.tenderPublicId].commitEnd,
            awardWinnerAddress: tenderMap[b.tenderPublicId].awardWinnerAddress || '',
          }
        : null,
    }));

    // Awards = tenders where this wallet is the recorded winner
    const won = await Tender.find({
      status: 'awarded',
      awardWinnerAddress: { $regex: new RegExp(`^${escapeRegex(address)}$`, 'i') },
    })
      .sort({ awardedAt: -1 })
      .lean();

    const myAwards = won.map((t) => ({
      id: t.publicId,
      title: t.title,
      category: t.category,
      status: t.status,
      awardWinnerOrg: t.awardWinnerOrg || '',
      awardNote: t.awardNote || '',
      awardedAt: t.awardedAt,
      commitEnd: t.commitEnd,
    }));

    res.json({ myBids, myAwards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load wallet history' });
  }
});

// GET /api/tenders/:tenderId/bids
// Supplier emails are only returned when the request carries the organizer key.
router.get('/', async (req, res) => {
  try {
    const tenderPublicId = req.params.tenderId;

    const tender = await Tender.findOne({ publicId: tenderPublicId })
      .select('+organizerTokenHash')
      .lean();
    if (!tender) return res.status(404).json({ error: 'Tender not found' });

    const isOrganizer = tokenMatches(tokenFromReq(req), tender.organizerTokenHash);

    const bids = await Bid.find({ tenderPublicId }).sort({ createdAt: 1 });
    const committed = await Bid.countDocuments({ tenderPublicId });
    const revealed = await Bid.countDocuments({
      tenderPublicId,
      status: { $in: ['revealed', 'awarded'] },
    });

    res.json({
      committedCount: committed,
      revealedCount: revealed,
      bids: bids.map((b) => {
        const json = b.toJSON();
        if (!isOrganizer) delete json.email;
        return json;
      }),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load bids' });
  }
});

// POST commit. Served at both POST /api/tenders/:tenderId/bids and /bids/commit
async function commitHandler(req, res) {
  try {
    const tenderPublicId = req.params.tenderId;
    const body = req.body || {};
    const bidderAddress = body.bidderAddress;
    const organizationName = body.organizationName ?? body.orgName;
    const email = body.email;
    const commitmentHex = body.commitmentHex;

    if (!bidderAddress?.trim()) {
      return res.status(400).json({ error: 'bidderAddress is required' });
    }
    if (!organizationName?.trim()) {
      return res.status(400).json({ error: 'organizationName is required' });
    }
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email is required for award notifications' });
    }
    if (!commitmentHex || !/^0x[0-9a-fA-F]{64}$/.test(String(commitmentHex))) {
      return res.status(400).json({ error: 'A valid commitmentHex is required' });
    }

    const tender = await Tender.findOne({ publicId: tenderPublicId }).select('+organizerTokenHash');
    if (!tender) return res.status(404).json({ error: 'Tender not found' });

    const now = Math.floor(Date.now() / 1000);
    if (now < tender.commitStart) return res.status(400).json({ error: 'Commit window not open' });
    if (now >= tender.commitEnd) return res.status(400).json({ error: 'Commit window closed' });

    // Organizers can never bid on their own tender. Two independent checks:
    // 1) the bidding wallet is the organizer wallet
    // 2) the request carries the organizer key (catches a second wallet used from the organizer's browser)
    const sameWallet =
      !!tender.organizerAddress &&
      tender.organizerAddress.trim().toLowerCase() === bidderAddress.trim().toLowerCase();
    const holdsOrganizerKey = tokenMatches(tokenFromReq(req), tender.organizerTokenHash);

    if (sameWallet || holdsOrganizerKey) {
      return res.status(403).json({ error: 'Organizers cannot bid on their own tender' });
    }

    try {
      const bid = await Bid.create({
        tenderPublicId,
        bidderAddress: bidderAddress.trim(),
        organizationName: organizationName.trim(),
        email: email.trim().toLowerCase(),
        commitmentHex: String(commitmentHex).toLowerCase(),
        status: 'committed',
      });
      const committedCount = await Bid.countDocuments({ tenderPublicId });
      return res.status(201).json({ bid: bid.toJSON(), committedCount });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ error: 'You have already committed on this tender' });
      }
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Commit failed' });
  }
}

router.post(['/', '/commit'], commitHandler);

// POST reveal
router.post('/reveal', async (req, res) => {
  try {
    const tenderPublicId = req.params.tenderId;
    const body = req.body || {};
    const bidderAddress = String(body.bidderAddress || '').trim();
    const revealAmount = Number(body.amountTDust ?? body.amount);
    const salt = String(body.saltHex || '').trim();
    const documentHash = String(body.documentHash || '').trim().toLowerCase();

    if (!bidderAddress) {
      return res.status(400).json({ error: 'bidderAddress is required' });
    }
    if (!Number.isFinite(revealAmount) || revealAmount <= 0) {
      return res.status(400).json({ error: 'A valid bid amount is required' });
    }
    if (!salt) {
      return res.status(400).json({ error: 'The secret salt is required' });
    }
    if (!/^0x[0-9a-f]{64}$/.test(documentHash)) {
      return res.status(400).json({ error: 'A valid document hash is required' });
    }

    const tender = await Tender.findOne({ publicId: tenderPublicId });
    if (!tender) return res.status(404).json({ error: 'Tender not found' });

    const now = Math.floor(Date.now() / 1000);
    if (now < tender.commitEnd) return res.status(400).json({ error: 'Reveal not open yet' });
    if (tender.status === 'awarded') return res.status(400).json({ error: 'Tender already awarded' });

    const existing = await Bid.findOne({
      tenderPublicId,
      bidderAddress: { $regex: new RegExp(`^${escapeRegex(bidderAddress)}$`, 'i') },
    });
    if (!existing) return res.status(404).json({ error: 'No commitment found for this wallet' });
    if (existing.status === 'revealed' || existing.status === 'awarded') {
      return res.status(400).json({ error: 'This bid has already been revealed' });
    }

    // The opening must match the sealed commitment stored at commit time
    if (existing.commitmentHex) {
      const expected = commitmentOf(revealAmount, salt, existing.bidderAddress, documentHash);
      if (expected !== String(existing.commitmentHex).toLowerCase()) {
        return res.status(400).json({ error: 'Amount or salt does not match the sealed commitment' });
      }
    }

    const min = tender.minPriceTDust ?? tender.minPrice;
    const max = tender.maxPriceTDust ?? tender.maxPrice;
    if (typeof min === 'number' && revealAmount < min) {
      return res.status(400).json({ error: 'Bid is below the minimum price limit' });
    }
    if (typeof max === 'number' && max > 0 && revealAmount > max) {
      return res.status(400).json({ error: 'Bid is above the maximum price limit' });
    }

    const set = {
      status: 'revealed',
      revealedAmount: revealAmount,
      revealedSalt: salt,
      revealedDocumentHash: documentHash,
    };

    const bid = await Bid.findOneAndUpdate({ _id: existing._id }, { $set: set }, { new: true });

    const revealedCount = await Bid.countDocuments({
      tenderPublicId,
      status: { $in: ['revealed', 'awarded'] },
    });
    res.json({ bid: bid.toJSON(), revealedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reveal failed' });
  }
});

export default router;