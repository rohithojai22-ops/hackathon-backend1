// server.js — MongoDB version, modular structure
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/database.js';
import { seedDatabase } from './utils/seed.js';

// Routes
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import meRoutes from './routes/me.js';
import statusRoutes from './routes/status.js';
import round1Routes from './routes/round1.js';
import round2Routes from './routes/round2.js';
import certificateRoutes from './routes/certificate.js';
import adminRoutes from './routes/admin.js';
import debugRoutes from './routes/debug.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- CONFIG --------------------
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://hackathon-frontend.vercel.app',
    'https://hackathon-frontend-sage.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/datasets', express.static(path.join(__dirname, '..', 'public', 'datasets')));

// -------------------- ROUTES --------------------
app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/me', meRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/round1', round1Routes);
app.use('/api/round2', round2Routes);
app.use('/api', certificateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/', debugRoutes);

// -------------------- START --------------------
async function startServer() {
  try {
    await connectDB();
    await seedDatabase();
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
