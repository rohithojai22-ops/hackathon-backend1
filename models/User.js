import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role: { type: String, required: true, default: 'team' },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }
}, { timestamps: true });

export default mongoose.model('User', userSchema);

