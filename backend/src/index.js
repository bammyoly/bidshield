import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDb, dbState } from './db.js';
import tendersRouter from './routes/tenders.js';
import bidsRouter from './routes/bids.js';


const app = express();
const PORT = process.env.PORT || 8787;
const CORS_ORIGIN = process.env.CORS_ORIGIN || true;

app.use(
  cors({
    origin: CORS_ORIGIN === 'true' ? true : CORS_ORIGIN.split(',').map((s) => s.trim()),
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'bidshield-api',
    mongo: dbState() === 1 ? 'connected' : 'not-connected',
  });
});

app.use('/api/tenders', tendersRouter);
app.use('/api/tenders/:tenderId/bids', bidsRouter);
app.use('/api/bids', bidsRouter);


app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  await connectDb(process.env.MONGODB_URI);
  app.listen(PORT, () => {
    console.log(`🚀 BidShield API on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});