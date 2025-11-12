import express from 'express';
import { auth } from '../middleware/auth.js';
import Team from '../models/Team.js';

const router = express.Router();

router.get('/', auth(), async (req, res) => {
  if (req.user.role === 'team') {
    const team = await Team.findById(req.user.team_id);
    return res.json({ role: 'team', team });
  } else {
    return res.json({ role: 'admin', email: req.user.email });
  }
});

export default router;

