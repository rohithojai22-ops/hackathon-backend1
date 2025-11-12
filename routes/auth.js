import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Team from '../models/Team.js';
import Shortlist from '../models/Shortlist.js';
import { signToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  const { team_name, email, password, phone, member1, member2, member3 } = req.body || {};

  if (!team_name || !email || !password || !phone || !member1 || !member2 || !member3) {
    return res.status(400).json({ error: 'All fields are required (team name, email, password, phone, 3 members).' });
  }

  const teamNameRegex = /^(?!\d+$)[A-Za-z0-9\s]+$/;
  if (!teamNameRegex.test(team_name)) return res.status(400).json({ error: 'Invalid team name. Must be alphabetical or alphanumeric, cannot be only digits.' });

  if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number. Must be exactly 10 digits.' });

  const nameRegex = /^[A-Za-z\s]+$/;
  if (![member1, member2, member3].every(m => nameRegex.test(m))) return res.status(400).json({ error: 'Member names must contain only alphabets and spaces.' });

  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already registered.' });

    const team = await Team.create({ team_name, phone, member1, member2, member3 });
    const hash = bcrypt.hashSync(password, 10);
    await User.create({ email, password_hash: hash, role: 'team', team_id: team._id });
    await Shortlist.create({ team_id: team._id });

    const token = signToken({ id: 0, role: 'team', team_id: team._id.toString(), email });
    return res.json({ token });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const u = await User.findOne({ email });
    if (!u || !bcrypt.compareSync(password, u.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ id: u._id.toString(), role: u.role, team_id: u.team_id?.toString(), email: u.email });
    res.json({ token, role: u.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;

