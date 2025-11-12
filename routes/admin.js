import express from 'express';
import { auth } from '../middleware/auth.js';
import { getRound1Window, getRound2Window, nowISO, parseISO, setSettings } from '../utils/helpers.js';
import Team from '../models/Team.js';
import SubmissionRound2 from '../models/SubmissionRound2.js';
import McqQuestion from '../models/McqQuestion.js';
import ProblemRound2 from '../models/ProblemRound2.js';
import Schedule from '../models/Schedule.js';
import EventSetting from '../models/EventSetting.js';
import AttemptRound1 from '../models/AttemptRound1.js';
import Shortlist from '../models/Shortlist.js';

const router = express.Router();

// Teams
router.get('/teams', auth('admin'), async (req, res) => {
  const teams = await Team.find().sort({ _id: -1 });
  res.json(teams);
});

router.delete('/teams/:id', auth('admin'), async (req, res) => {
  await Team.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// Submissions
router.get('/submissions', auth('admin'), async (req, res) => {
  const subs = await SubmissionRound2.find().sort({ created_at: -1 });
  res.json(subs);
});

// MCQ Questions
router.get('/mcqs', auth('admin'), async (req, res) => {
  const qs = await McqQuestion.find().sort({ _id: -1 });
  res.json(qs);
});

router.post('/mcqs', auth('admin'), async (req, res) => {
  const { question, opt_a, opt_b, opt_c, opt_d, correct } = req.body || {};
  await McqQuestion.create({ question, opt_a, opt_b, opt_c, opt_d, correct });
  res.json({ ok: true });
});

router.put('/mcqs/:id', auth('admin'), async (req, res) => {
  const { question, opt_a, opt_b, opt_c, opt_d, correct } = req.body || {};
  await McqQuestion.findByIdAndUpdate(req.params.id, { question, opt_a, opt_b, opt_c, opt_d, correct });
  res.json({ ok: true });
});

router.delete('/mcqs/:id', auth('admin'), async (req, res) => {
  await McqQuestion.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// Problems
router.get('/problems', auth('admin'), async (req, res) => {
  const ps = await ProblemRound2.find().sort({ _id: -1 });
  res.json(ps);
});

router.post('/problems', auth('admin'), async (req, res) => {
  const { title, statement } = req.body || {};
  await ProblemRound2.create({ title, statement });
  res.json({ ok: true });
});

router.put('/problems/:id', auth('admin'), async (req, res) => {
  const { title, statement } = req.body || {};
  await ProblemRound2.findByIdAndUpdate(req.params.id, { title, statement });
  res.json({ ok: true });
});

router.delete('/problems/:id', auth('admin'), async (req, res) => {
  await ProblemRound2.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// Compute shortlist
router.post('/compute-shortlist', auth('admin'), async (req, res) => {
  const attempts = await AttemptRound1.aggregate([
    { $sort: { created_at: -1 } },
    { $group: { _id: '$team_id', latest: { $first: '$$ROOT' } } }
  ]);

  const withPct = attempts.map(a => ({
    team_id: a._id,
    score: a.latest.score,
    total: a.latest.total,
    pct: a.latest.total ? a.latest.score / a.latest.total : 0
  })).sort((a, b) => b.pct - a.pct);

  const n = withPct.length;
  const cutoffIndex = Math.floor(n * 0.75) - 1;
  const cutoffPct = cutoffIndex >= 0 && n > 0 ? withPct[cutoffIndex].pct : 0;

  for (const row of withPct) {
    const qualifies = row.pct >= 0.5 || row.pct >= cutoffPct;
    await Shortlist.findOneAndUpdate(
      { team_id: row.team_id },
      { round1_qualified: qualifies ? 1 : 0 },
      { upsert: true }
    );
  }

  const subs = await SubmissionRound2.find().distinct('team_id');
  for (const teamId of subs) {
    const st = await Shortlist.findOne({ team_id: teamId });
    if (st && st.round1_qualified) {
      await Shortlist.findByIdAndUpdate(st._id, { round2_shortlisted: 1 });
    }
  }
  res.json({ ok: true, message: 'Shortlist computed' });
});

// Event Settings
router.get('/event-settings', auth('admin'), async (req, res) => {
  const rows = await EventSetting.find();
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});

router.put('/event-settings', auth('admin'), async (req, res) => {
  const allowedKeys = ['round1_start_iso', 'round1_end_iso', 'round2_start_iso', 'round2_end_iso'];
  const payload = {};
  for (const k of allowedKeys) if (req.body[k] !== undefined) payload[k] = req.body[k];
  if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No valid settings provided' });
  
  try {
    if (payload.round1_start_iso && !parseISO(payload.round1_start_iso)) return res.status(400).json({ error: 'Invalid round1_start_iso' });
    if (payload.round1_end_iso && !parseISO(payload.round1_end_iso)) return res.status(400).json({ error: 'Invalid round1_end_iso' });
    if (payload.round1_start_iso && payload.round1_end_iso && new Date(payload.round1_start_iso) >= new Date(payload.round1_end_iso)) return res.status(400).json({ error: 'R1 start must be before end' });
    if (payload.round2_start_iso && !parseISO(payload.round2_start_iso)) return res.status(400).json({ error: 'Invalid round2_start_iso' });
    await setSettings(payload);
    const r1 = await getRound1Window();
    const r2 = await getRound2Window();
    res.json({ ok: true, round1: { start_iso: r1.startISO, end_iso: r1.endISO }, round2: { start_iso: r2.startISO, end_iso: r2.endISO }, server_now_iso: nowISO() });
  } catch (err) {
    console.error('Save settings error:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Schedule
router.post('/schedule', auth('admin'), async (req, res) => {
  const { round, title, description, date } = req.body || {};
  await Schedule.create({ round: round || '', title: title || '', description: description || '', date: date || '' });
  res.json({ ok: true });
});

router.put('/schedule/:id', auth('admin'), async (req, res) => {
  const { round, title, description, date } = req.body || {};
  await Schedule.findByIdAndUpdate(req.params.id, { round: round || '', title: title || '', description: description || '', date: date || '' });
  res.json({ ok: true });
});

router.delete('/schedule/:id', auth('admin'), async (req, res) => {
  await Schedule.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;

