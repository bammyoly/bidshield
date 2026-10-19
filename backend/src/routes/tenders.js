// backend/src/routes/tenders.js

import { Router } from 'express';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { Tender } from '../models/Tender.js';
import { Bid } from '../models/Bid.js';
import { sendAwardEmail } from '../lib/mail.js';
import { newOrganizerToken, tokenFromReq, tokenMatches } from '../lib/organizerAuth.js';

const router = Router();

function canonicalPayload(body) {
  return JSON.stringify({
    title: body.title?.trim(),
    description: body.description?.trim(),
    category: body.category?.trim() || 'Technology',
    location: body.location?.trim() || '',
    minPrice: Number(body.minPrice) || 0,
    maxPrice: Number(body.maxPrice) || 0,
    requirements: body.requirements || [],
    contact: body.contact?.trim() || '',
    commitStart: Number(body.commitStart),
    commitEnd: Number(body.commitEnd),
    revealEnd: Number(body.revealEnd),
  });
}

function policyHashFrom(body) {
  return crypto.createHash('sha256').update(canonicalPayload(body)).digest('hex');
}

function tenderIdHexFrom(publicId) {
  return crypto.createHash('sha256').update(`bidshield:tender:${publicId}`).digest('hex');
}

// Whitelist serializer: organizerTokenHash is never included here
function serializeTender(t, counts = {}) {
  return {
    id: t.publicId,
    title: t.title,
    description: t.description,
    category: t.category,
    location: t.location,
    minPrice: t.minPrice,
    maxPrice: t.maxPrice,
    currency: t.currency || 'tDUST',
    imageUrl: t.imageUrl,
    requirements: t.requirements || [],
    contact: t.contact,
    policyHash: t.policyHash,
    tenderIdHex: t.tenderIdHex,
    commitStart: t.commitStart,
    commitEnd: t.commitEnd,
    revealEnd: t.revealEnd,
    contractAddress: t.contractAddress,
    network: t.network,
    organizerAddress: t.organizerAddress,
    status: t.status,
    awardWinnerAddress: t.awardWinnerAddress || '',
    awardWinnerOrg: t.awardWinnerOrg || '',
    awardNote: t.awardNote || '',
    awardedAt: t.awardedAt || null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    committedCount: counts.committedCount || 0,
    revealedCount: counts.revealedCount || 0,
  };
}

// GET /api/tenders
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.organizer) filter.organizerAddress = String(req.query.organizer);

    const tenders = await Tender.find(filter).sort({ createdAt: -1 }).lean();

    const counts = await Bid.aggregate([
      {
        $group: {
          _id: '$tenderPublicId',
          committedCount: { $sum: 1 },
          revealedCount: {
            $sum: { $cond: [{ $in: ['$status', ['revealed', 'awarded']] }, 1, 0] },
          },
        },
      },
    ]);

    const map = Object.fromEntries(
      counts.map((c) => [
        c._id,
        { committedCount: c.committedCount, revealedCount: c.revealedCount },
      ]),
    );

    res.json(tenders.map((t) => serializeTender(t, map[t.publicId] || {})));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list tenders' });
  }
});

// GET /api/tenders/:id
router.get('/:id', async (req, res) => {
  try {
    const tender = await Tender.findOne({ publicId: req.params.id }).lean();
    if (!tender) return res.status(404).json({ error: 'Tender not found' });

    const committedCount = await Bid.countDocuments({
      tenderPublicId: tender.publicId,
    });
    const revealedCount = await Bid.countDocuments({
      tenderPublicId: tender.publicId,
      status: { $in: ['revealed', 'awarded'] },
    });

    res.json(serializeTender(tender, { committedCount, revealedCount }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load tender' });
  }
});

// POST /api/tenders
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};

    if (!b.title?.trim() || !b.description?.trim()) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const commitStart = Number(b.commitStart);
    const commitEnd = Number(b.commitEnd);
    const revealEnd = Number(b.revealEnd);

    if (!(commitStart < commitEnd && commitEnd < revealEnd)) {
      return res
        .status(400)
        .json({ error: 'Invalid dates: Start < Commit End < Reveal End' });
    }

    const existing = await Tender.findOne({ title: b.title.trim() });
    if (existing) {
      return res.status(400).json({
        error: 'A tender with this title already exists. Please choose a unique title.',
      });
    }

    const publicId = nanoid(12);
    const policyHash = policyHashFrom(b);
    const tenderIdHex = tenderIdHexFrom(publicId);

    // The plain key is returned once below. Only its hash is stored.
    const { token, hash } = newOrganizerToken();

    const doc = await Tender.create({
      publicId,
      title: b.title.trim(),
      description: b.description.trim(),
      category: (b.category || 'Technology').trim(),
      location: (b.location || '').trim(),
      minPrice: Number(b.minPrice) || 0,
      maxPrice: Number(b.maxPrice) || 0,
      imageUrl: (b.imageUrl || '').trim(),
      requirements: Array.isArray(b.requirements) ? b.requirements : [],
      contact: (b.contact || '').trim(),
      policyHash,
      tenderIdHex,
      commitStart,
      commitEnd,
      revealEnd,
      contractAddress: b.contractAddress || '',
      network: b.network || 'preview',
      organizerAddress: b.organizerAddress || '',
      organizerTokenHash: hash,
      status: 'published',
    });

    res.status(201).json({
      ...serializeTender(doc.toObject(), { committedCount: 0, revealedCount: 0 }),
      organizerToken: token,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A tender with this title already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create tender' });
  }
});

// PATCH /api/tenders/:id  (record the award, organizer key required)
router.patch('/:id', async (req, res) => {
  try {
    const { status, awardWinnerAddress, awardNote } = req.body || {};

    if (status !== 'awarded') {
      return res.status(400).json({ error: 'Only status "awarded" is supported here' });
    }
    if (!awardWinnerAddress?.trim()) {
      return res.status(400).json({ error: 'awardWinnerAddress is required' });
    }

    const tender = await Tender.findOne({ publicId: req.params.id }).select('+organizerTokenHash');
    if (!tender) return res.status(404).json({ error: 'Tender not found' });

    if (!tender.organizerTokenHash) {
      return res.status(403).json({
        error: 'This tender has no organizer key (it was created before keys were introduced)',
      });
    }
    if (!tokenMatches(tokenFromReq(req), tender.organizerTokenHash)) {
      return res.status(403).json({ error: 'Only the tender organizer can record the award' });
    }

    if (tender.status === 'awarded') {
      return res.status(400).json({ error: 'Tender already awarded' });
    }

    const winnerBid = await Bid.findOne({
      tenderPublicId: tender.publicId,
      bidderAddress: {
        $regex: new RegExp(`^${awardWinnerAddress.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      },
      status: { $in: ['revealed', 'awarded'] },
    });

    if (!winnerBid) {
      return res.status(400).json({ error: 'Winner must have a revealed bid' });
    }

    tender.status = 'awarded';
    tender.awardWinnerAddress = winnerBid.bidderAddress;
    tender.awardWinnerOrg = winnerBid.organizationName || '';
    tender.awardNote = (awardNote || '').trim();
    tender.awardedAt = new Date();
    await tender.save();

    winnerBid.status = 'awarded';
    await winnerBid.save();

    // Email notification
    let emailResult = null;
    if (winnerBid.email) {
      try {
        emailResult = await sendAwardEmail({
          to: winnerBid.email,
          organizationName: winnerBid.organizationName,
          tenderTitle: tender.title,
          amount: winnerBid.revealedAmount,
          tenderId: tender.publicId,
        });
      } catch (mailErr) {
        console.error('Award email failed:', mailErr);
        emailResult = { error: mailErr.message };
      }
    }

    res.json({
      id: tender.publicId,
      status: tender.status,
      awardWinnerAddress: tender.awardWinnerAddress,
      awardWinnerOrg: tender.awardWinnerOrg,
      awardNote: tender.awardNote,
      email: emailResult,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to update tender' });
  }
});

export default router;