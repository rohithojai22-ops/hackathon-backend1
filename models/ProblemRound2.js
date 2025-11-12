import mongoose from 'mongoose';

const problemRound2Schema = new mongoose.Schema({
  title: { type: String, required: true },
  statement: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model('ProblemRound2', problemRound2Schema);

