import express from 'express';
import jwt from 'jsonwebtoken';
import { getRound1Window, getRound2Window, nowISO } from '../utils/helpers.js';
import Schedule from '../models/Schedule.js';
import Team from '../models/Team.js';
import AttemptRound1 from '../models/AttemptRound1.js';
import EventSetting from "../models/EventSetting.js";
const router = express.Router();

router.get('/server-time', (req, res) => res.json({ now_iso: nowISO() }));

rrouter.get('/event-settings', async (req, res) => {
  try {
    const rows = await EventSetting.find();
    const obj = {};

    rows.forEach(r => obj[r.key] = r.value);

    res.json(obj);
  } catch (err) {
    console.error("Public event-settings error:", err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});



router.get('/schedule', async (req, res) => {
  const rows = await Schedule.find().sort({ date: 1, _id: 1 });
  res.json(rows);
});

router.get('/leaderboard', async (req, res) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'devjwt';
  
  let isAdmin = false;
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (token) {
      const data = jwt.verify(token, JWT_SECRET);
      isAdmin = data.role === 'admin';
    }
  } catch (_) {}

  const { end } = await getRound1Window();
  const now = new Date();
  if (!isAdmin && end && now < end) {
    return res.status(403).json({
      error: 'LEADERBOARD_LOCKED',
      message: 'Leaderboard unlocks after Round 1 ends.',
      unlock_at_iso: end.toISOString(),
      server_now_iso: now.toISOString()
    });
  }

  // Get latest attempt for each team
  const attempts = await AttemptRound1.aggregate([
    { $sort: { created_at: -1 } },
    { $group: { _id: '$team_id', latest: { $first: '$$ROOT' } } }
  ]);

  // Get team details and format
  const results = [];
  for (const attempt of attempts) {
    const team = await Team.findById(attempt._id);
    if (team) {
      results.push({
        team_name: team.team_name,
        score: attempt.latest.score,
        total: attempt.latest.total,
        created_at: attempt.latest.created_at
      });
    }
  }

  // Calculate percentage and sort (by percentage, then by created_at)
  const sorted = results.sort((a, b) => {
    const aPct = a.total ? a.score / a.total : 0;
    const bPct = b.total ? b.score / b.total : 0;
    if (bPct !== aPct) return bPct - aPct;
    return new Date(a.created_at) - new Date(b.created_at);
  }).slice(0, 100);

  res.json(sorted);
});

router.get('/event-info', (req, res) => {
  res.json({
    prizes: {
      first: { amount: 50000, desc: 'Certificate of Achievement' },
      second: { amount: 40000, desc: 'Certificate of Achievement' },
      third: { amount: 30000, desc: 'Certificate of Achievement' },
    },
    certificates: [
      { type: 'Participation', desc: 'All registered participants.' },
      { type: 'Appreciation', desc: 'Participants securing ≥50% marks or ranking in top 75%.' },
      { type: 'Outstanding Performance', desc: 'Top 10% (≥80% score).' },
    ],
    registration: {
      deadline: '30 December 2025',
      fee: 2000,
      account: {
        number: 'XXX',
        holder: 'YYYY',
        bank: 'SBI, NIT Silchar Branch',
        ifsc: 'SBIN0007061',
        micr: '788002004',
      },
    },
    accommodation: 'Free accommodation for finalists.',
    local_visit: 'Participants will have the opportunity to explore local attractions.',
    gala_dinner: 'Meet experts and enjoy a gala dinner!',
    registration_link: '[Google Form Link Here]',
    organizing_team: 'Faculty & 3rd year B.Tech Students of CSE Department, NIT Silchar',
    contact: { name: 'CR, Sec A & B, B.Tech (CSE), 3rd year, NIT Silchar', email: 'hackathon@nits.ac.in' },
    conclusion: `This Hackathon aims to build a culture of innovation and coding excellence among students and professionals.`
  });
});

export default router;

