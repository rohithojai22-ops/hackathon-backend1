import mongoose from 'mongoose';

const attemptRound1Schema = new mongoose.Schema({
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  score: { type: Number, required: true },
  total: { type: Number, required: true },
  created_at: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('AttemptRound1', attemptRound1Schema);

