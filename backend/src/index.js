import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDb, dbState } from './db.js';
import tendersRouter from './routes/tenders.js';
import bidsRouter from './routes/bids.js';

const app = express();
const PORT = process.env.PORT || 8787;

// --- CORS CONFIGURATION FIX ---
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);

      // Allow Vercel deployments and local development
      if (
        origin === 'https://bidshield-eta.vercel.app' ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }

      // Fallback: allow all origins for hackathon demo
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  })
);

// Respond to preflight OPTIONS requests immediately
app.options('*', cors());

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