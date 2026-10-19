import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
console.log('URI set:', Boolean(uri));
console.log('URI prefix:', uri?.slice(0, 30) + '...');

try {
  await mongoose.connect(uri);
  console.log('SUCCESS: authenticated and connected');
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error('FAIL:', err.message);
  process.exit(1);
}