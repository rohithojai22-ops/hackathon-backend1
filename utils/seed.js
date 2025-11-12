import User from '../models/User.js';
import Team from '../models/Team.js';
import McqQuestion from '../models/McqQuestion.js';
import ProblemRound2 from '../models/ProblemRound2.js';
import Schedule from '../models/Schedule.js';
import Shortlist from '../models/Shortlist.js';
import EventSetting from '../models/EventSetting.js';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  // Seed admin user
  const adminExists = await User.findOne({ email: 'admin@nits.ac.in' });
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    await User.create({
      email: 'admin@nits.ac.in',
      password_hash: hash,
      role: 'admin'
    });
    console.log('✅ Seeded admin: admin@nits.ac.in / admin123');
  }

  // Seed event settings
  const settings = ['round1_start_iso', 'round1_end_iso', 'round2_start_iso', 'round2_end_iso'];
  for (const key of settings) {
    const exists = await EventSetting.findOne({ key });
    if (!exists) {
      await EventSetting.create({ key, value: '' });
    }
  }

  // Seed MCQ questions if empty
  const mcqCount = await McqQuestion.countDocuments();
  if (mcqCount === 0) {
    const mcqs = [
      { question: 'Time complexity of binary search?', opt_a: 'O(n)', opt_b: 'O(n log n)', opt_c: 'O(log n)', opt_d: 'O(1)', correct: 'c' },
      { question: 'Which SQL clause filters rows?', opt_a: 'ORDER BY', opt_b: 'WHERE', opt_c: 'GROUP BY', opt_d: 'SELECT', correct: 'b' },
      { question: 'In C, which is not a loop?', opt_a: 'for', opt_b: 'repeat', opt_c: 'while', opt_d: 'do..while', correct: 'b' },
      { question: 'HTTP status 404 means?', opt_a: 'OK', opt_b: 'Moved Permanently', opt_c: 'Not Found', opt_d: 'Unauthorized', correct: 'c' },
      { question: 'Which is immutable in Python?', opt_a: 'list', opt_b: 'set', opt_c: 'dict', opt_d: 'tuple', correct: 'd' },
      { question: 'git command to create branch?', opt_a: 'git branch', opt_b: 'git merge', opt_c: 'git add', opt_d: 'git init', correct: 'a' },
      { question: 'Which is supervised learning?', opt_a: 'K-Means', opt_b: 'Linear Regression', opt_c: 'PCA', opt_d: 't-SNE', correct: 'b' },
      { question: 'TCP provides?', opt_a: 'Unreliable, unordered', opt_b: 'Reliable, ordered', opt_c: 'Broadcast', opt_d: 'Connectionless', correct: 'b' },
      { question: 'Aptitude: 2,6,12,20,? ', opt_a: '24', opt_b: '30', opt_c: '28', opt_d: '32', correct: 'c' },
      { question: 'Aptitude: If x% of 200 is 50, x = ?', opt_a: '10', opt_b: '20', opt_c: '25', opt_d: '30', correct: 'c' },
      { question: 'Which data structure uses FIFO?', opt_a: 'Stack', opt_b: 'Queue', opt_c: 'Tree', opt_d: 'Graph', correct: 'b' },
      { question: 'Best case for quicksort?', opt_a: 'Already sorted', opt_b: 'Reverse sorted', opt_c: 'Random', opt_d: 'All same', correct: 'a' },
      { question: 'Normalization reduces?', opt_a: 'Redundancy', opt_b: 'Integrity', opt_c: 'Indexes', opt_d: 'Transactions', correct: 'a' },
      { question: 'HTML for link?', opt_a: '<a>', opt_b: '<link>', opt_c: '<href>', opt_d: '<url>', correct: 'a' },
      { question: 'Which ML metric for classification?', opt_a: 'RMSE', opt_b: 'MAE', opt_c: 'Accuracy', opt_d: 'R^2', correct: 'c' }
    ];
    await McqQuestion.insertMany(mcqs);
    console.log('✅ Seeded MCQ questions');
  } else {
    console.log(`⚙️ Skipped seeding MCQ questions — already has ${mcqCount} records`);
  }

  // Seed problems if empty
  const problemCount = await ProblemRound2.countDocuments();
  if (problemCount === 0) {
    const problems = [
      { title: 'Fake News Classifier', statement: 'Build a text classifier to label short headlines as FAKE/REAL. Describe preprocessing and model.' },
      { title: 'House Price Prediction', statement: 'Train a regression model on small CSV (create synthetic if needed). Report RMSE and features used.' },
      { title: 'Traffic Sign Detection (Lite)', statement: 'Use transfer learning or pre-trained model. Submit steps, code, and qualitative results.' }
    ];
    await ProblemRound2.insertMany(problems);
    console.log('✅ Seeded Round 2 problems');
  } else {
    console.log(`⚙️ Skipped seeding Round 2 problems — already has ${problemCount} records`);
  }

  // Seed schedule if empty
  const scheduleCount = await Schedule.countDocuments();
  if (scheduleCount === 0) {
    const schedules = [
      { round: 'Registration', title: 'Registration Deadline', description: 'Last date to register', date: '2025-12-30' },
      { round: 'Round 1', title: 'Online MCQ Screening', description: 'Aptitude + Basic Coding', date: '2026-01-15' },
      { round: 'Round 2', title: 'Online Coding/AI-ML', description: 'Submit solutions online', date: '2026-02-07' },
      { round: 'Round 3', title: 'Offline Final @ NIT Silchar', description: 'On-campus hackathon', date: '2026-02-27' }
    ];
    await Schedule.insertMany(schedules);
    console.log('✅ Seeded schedule');
  } else {
    console.log(`⚙️ Skipped seeding schedule — already has ${scheduleCount} records`);
  }

  console.log('✅ Database seeding completed.');
}

