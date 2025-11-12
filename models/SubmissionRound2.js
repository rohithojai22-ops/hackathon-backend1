import mongoose from 'mongoose';

const submissionRound2Schema = new mongoose.Schema({
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, unique: true },
  filename: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  score: { type: Number },
  notes: { type: String }
}, { timestamps: true });

export default mongoose.model('SubmissionRound2', submissionRound2Schema);

