import express from 'express';
import { auth } from '../middleware/auth.js';
import { getRound2Window, ensureAfterStart, nowISO } from '../utils/helpers.js';
import { upload } from '../utils/upload.js';
import SubmissionRound2 from '../models/SubmissionRound2.js';
import ProblemRound2 from '../models/ProblemRound2.js';

const router = express.Router();

router.get('/problems', auth('team'), async (req, res) => {
  const { start, startISO } = await getRound2Window();
  const gate = ensureAfterStart(start);
  if (!gate.ok) {
    return res.status(403).json({
      error: gate.code,
      message: 'Round 2 has not started yet.',
      server_now_iso: nowISO(),
      start_iso: startISO,
    });
  }
  const ps = await ProblemRound2.find().sort({ _id: 1 });
  res.json(ps);
});

router.get('/my-submission', auth('team'), async (req, res) => {
  const sub = await SubmissionRound2.findOne({ team_id: req.user.team_id });
  res.json(sub || null);
});

router.post('/submit', auth('team'), upload.single('file'), async (req, res) => {
  const { start, startISO } = await getRound2Window();
  const gate = ensureAfterStart(start);
  if (!gate.ok) {
    return res.status(403).json({
      error: gate.code,
      message: 'Round 2 has not started yet.',
      server_now_iso: nowISO(),
      start_iso: startISO,
    });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const prev = await SubmissionRound2.findOne({ team_id: req.user.team_id });
  if (prev) return res.status(409).json({ error: 'ALREADY_SUBMITTED' });

  await SubmissionRound2.create({ team_id: req.user.team_id, filename: req.file.filename, created_at: new Date() });
  res.json({ ok: true, filename: req.file.filename });
});

export default router;

