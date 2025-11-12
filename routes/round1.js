import express from 'express';
import { auth } from '../middleware/auth.js';
import { getRound1Window, ensureWithinWindow, nowISO } from '../utils/helpers.js';
import AttemptRound1 from '../models/AttemptRound1.js';
import McqQuestion from '../models/McqQuestion.js';

const router = express.Router();

router.get('/questions', auth('team'), async (req, res) => {
  const att = await AttemptRound1.findOne({ team_id: req.user.team_id });
  if (att) return res.status(403).json({ error: 'ALREADY_SUBMITTED' });

  const { start, end, startISO, endISO } = await getRound1Window();
  const gate = ensureWithinWindow(start, end);
  if (!gate.ok) {
    return res.status(403).json({
      error: gate.code,
      server_now_iso: nowISO(),
      start_iso: startISO,
      end_iso: endISO,
      message:
        gate.code === 'WINDOW_NOT_SET' ? 'Round 1 window not set by admin.' :
        gate.code === 'NOT_STARTED' ? 'Round 1 has not started yet.' :
        'Round 1 has ended.'
    });
  }

  const qs = await McqQuestion.find().sort({ _id: 1 }).limit(15).select('_id question opt_a opt_b opt_c opt_d');
  const formatted = qs.map(q => ({ id: q._id.toString(), question: q.question, opt_a: q.opt_a, opt_b: q.opt_b, opt_c: q.opt_c, opt_d: q.opt_d }));
  res.json(formatted);
});

router.post('/submit', auth('team'), async (req, res) => {
  const existed = await AttemptRound1.findOne({ team_id: req.user.team_id }).sort({ created_at: -1 });
  if (existed) return res.status(409).json({ error: 'ALREADY_SUBMITTED', score: existed.score, total: existed.total });

  const { start, end, startISO, endISO } = await getRound1Window();
  const gate = ensureWithinWindow(start, end);
  if (!gate.ok) {
    return res.status(403).json({
      error: gate.code,
      server_now_iso: nowISO(),
      start_iso: startISO,
      end_iso: endISO,
      message:
        gate.code === 'WINDOW_NOT_SET' ? 'Round 1 window not set by admin.' :
        gate.code === 'NOT_STARTED' ? 'Round 1 has not started yet.' :
        'Round 1 has ended.'
    });
  }

  const answers = req.body.answers || {};
  const qs = await McqQuestion.find().sort({ _id: 1 }).limit(15).select('_id correct');
  let score = 0;
  for (const q of qs) {
    const qId = q._id.toString();
    if (answers[qId] && answers[qId] === q.correct) score++;
  }
  await AttemptRound1.create({ team_id: req.user.team_id, score, total: qs.length });
  res.json({ score, total: qs.length });
});

export default router;

