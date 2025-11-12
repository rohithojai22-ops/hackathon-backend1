import express from 'express';
import { auth } from '../middleware/auth.js';
import Team from '../models/Team.js';
import AttemptRound1 from '../models/AttemptRound1.js';
import Shortlist from '../models/Shortlist.js';

const router = express.Router();

router.get('/certificate-data', auth('team'), async (req, res) => {
  const team = await Team.findById(req.user.team_id);
  const att = await AttemptRound1.findOne({ team_id: req.user.team_id }).sort({ created_at: -1 });
  const short = await Shortlist.findOne({ team_id: req.user.team_id });
  res.json({
    teamName: team?.team_name || 'Team',
    score: att?.score ?? 0,
    total: att?.total ?? 15,
    qualified: short?.round1_qualified ? true : false,
    date: (att?.created_at) ? new Date(att.created_at).toISOString() : new Date().toISOString()
  });
});

export default router;

