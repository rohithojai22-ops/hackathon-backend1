import express from 'express';
import User from '../models/User.js';

const router = express.Router();

router.get('/debug-users', async (req, res) => {
  try {
    const users = await User.find().select('_id email role team_id');
    res.json(users);
  } catch (err) {
    console.error('debug-users error', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;

