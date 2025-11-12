import express from 'express';
import { auth } from '../middleware/auth.js';
import { getRound1Window, getRound2Window, nowISO } from '../utils/helpers.js';
import AttemptRound1 from '../models/AttemptRound1.js';
import Shortlist from '../models/Shortlist.js';

const router = express.Router();

router.get('/', auth(), async (req, res) => {
  const attempt = await AttemptRound1.findOne({ team_id: req.user.team_id }).sort({ created_at: -1 });
  const short = await Shortlist.findOne({ team_id: req.user.team_id });
  const r1 = await getRound1Window();
  const r2 = await getRound2Window();
  res.json({
    round1: attempt ? { score: attempt.score, total: attempt.total } : null,
    shortlist: short || { round1_qualified: 0, round2_shortlisted: 0 },
    round1_window: { start_iso: r1.startISO, end_iso: r1.endISO, server_now_iso: nowISO() },
    round2_window: { start_iso: r2.startISO, end_iso: r2.endISO, server_now_iso: nowISO() },
    round1_attempted: !!attempt
  });
});

export default router;

