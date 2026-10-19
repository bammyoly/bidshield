// backend/src/lib/organizerAuth.js
//
// Each tender gets a random organizer key when it is published. The server keeps only
// its SHA 256 hash, and the key is returned to the creator once. Awarding a tender and
// reading supplier contact details both require sending that key.

import crypto from 'crypto';

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function newOrganizerToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

export function tokenMatches(token, storedHash) {
  if (!token || !storedHash) return false;
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(String(storedHash), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function tokenFromReq(req) {
  return String(req.get('x-organizer-token') || '').trim();
}