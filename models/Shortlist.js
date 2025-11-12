import mongoose from 'mongoose';

const shortlistSchema = new mongoose.Schema({
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, unique: true },
  round1_qualified: { type: Number, default: 0 },
  round2_shortlisted: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Shortlist', shortlistSchema);

