// backend/scripts/clear-db.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { Tender } from '../src/models/Tender.js';

async function clearDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
  }

  try {
    console.log('⏳ Connecting to MongoDB…');
    await mongoose.connect(uri);
    
    const count = await Tender.countDocuments();
    console.log(`🗑️ Deleting ${count} tender(s)…`);
    
    await Tender.deleteMany({});
    console.log('✅ Database cleared successfully!');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to clear database:', err);
    process.exit(1);
  }
}

clearDb();