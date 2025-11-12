import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  team_name: { type: String, required: true },
  phone: { type: String },
  member1: { type: String },
  member2: { type: String },
  member3: { type: String }
}, { timestamps: true });

export default mongoose.model('Team', teamSchema);

