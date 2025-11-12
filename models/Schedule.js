import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema({
  round: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  date: { type: String }
}, { timestamps: true });

export default mongoose.model('Schedule', scheduleSchema);

