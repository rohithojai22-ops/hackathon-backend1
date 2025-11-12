import mongoose from 'mongoose';

const mcqQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  opt_a: { type: String, required: true },
  opt_b: { type: String, required: true },
  opt_c: { type: String, required: true },
  opt_d: { type: String, required: true },
  correct: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model('McqQuestion', mcqQuestionSchema);

