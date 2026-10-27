import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/ }));
app.use(express.json());

const recordSchema = new mongoose.Schema({
  company: { type: String, required: true, trim: true },
  year: { type: Number, required: true },
  quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4', 'Annual'], default: 'Annual' },
  currency: { type: String, default: 'M' },
  cash: { type: Number, min: 0, default: 0 },
  receivables: { type: Number, min: 0, default: 0 },
  inventory: { type: Number, min: 0, default: 0 },
  equipment: { type: Number, min: 0, default: 0 },
  payables: { type: Number, min: 0, default: 0 },
  shortDebt: { type: Number, min: 0, default: 0 },
  longDebt: { type: Number, min: 0, default: 0 },
  equity: { type: Number, min: 0, default: 0 },
  notes: { type: String, default: '' }
}, { timestamps: true });

const Record = mongoose.model('FinancialRecord', recordSchema);

const samples = [
  { company: 'ABC Finance', year: 2026, quarter: 'Q1', cash: 142485, receivables: 104027, inventory: 120767, equipment: 908271, payables: 65330, shortDebt: 579455, longDebt: 100000, equity: 620765, notes: 'Illustrative first-quarter record.' },
  { company: 'ABC Finance', year: 2026, quarter: 'Q2', cash: 158000, receivables: 112000, inventory: 115000, equipment: 915000, payables: 68000, shortDebt: 550000, longDebt: 95000, equity: 587000, notes: 'Illustrative second-quarter record.' },
  { company: 'ABC Finance', year: 2025, quarter: 'Annual', cash: 127000, receivables: 98000, inventory: 109000, equipment: 880000, payables: 61000, shortDebt: 520000, longDebt: 110000, equity: 523000, notes: 'Illustrative annual record.' }
];

app.get('/api/health', (_req, res) => res.json({
  ok: true, database: mongoose.connection.name || 'not connected',
  state: mongoose.connection.readyState
}));

app.get('/api/records', async (req, res) => {
  try {
    const filter = {};
    if (req.query.year && req.query.year !== 'All') filter.year = Number(req.query.year);
    if (req.query.quarter && req.query.quarter !== 'All') filter.quarter = req.query.quarter;
    if (req.query.search) filter.company = { $regex: req.query.search, $options: 'i' };
    res.json(await Record.find(filter).sort({ year: -1, quarter: 1 }));
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/records', async (req, res) => {
  try {
    const record = await Record.create(req.body);
    res.status(201).json(record);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

app.put('/api/records/:id', async (req, res) => {
  try {
    const record = await Record.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!record) return res.status(404).json({ message: 'Record not found.' });
    res.json(record);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

app.delete('/api/records/:id', async (req, res) => {
  try {
    const record = await Record.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found.' });
    res.json({ message: 'Record deleted.' });
  } catch (error) { res.status(400).json({ message: error.message }); }
});

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fis_finance_dashboard';
let retryTimer = null;

async function connectDb() {
  clearTimeout(retryTimer);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
    if (await Record.countDocuments() === 0) {
      await Record.insertMany(samples);
      console.log('Inserted demonstration records.');
    }
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error('Check that MongoDB Community Server is running. Retrying in 5 seconds...');
    retryTimer = setTimeout(connectDb, 5000);
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Reconnecting...');
  retryTimer = setTimeout(connectDb, 5000);
});

async function start() {
  await connectDb();
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`API listening at http://localhost:${port}`));
}
start();