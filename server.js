import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'devjwt';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'hackathon2026.sqlite');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/datasets', express.static(path.join(__dirname, '..', 'public', 'datasets')));

// -------------------- DB Helpers --------------------
// ✅ Ensure DB directory exists automatically before opening
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`📁 Created missing directory: ${dbDir}`);
}

const db = new Database(DB_PATH);


function run(sql, params = []) {
  try {
    return db.prepare(sql).run(params);
  } catch (err) {
    console.error('DB RUN ERROR:', err);
    throw err;
  }
}
function all(sql, params = []) {
  try {
    return db.prepare(sql).all(params);
  } catch (err) {
    console.error('DB ALL ERROR:', err);
    throw err;
  }
}
function get(sql, params = []) {
  try {
    return db.prepare(sql).get(params);
  } catch (err) {
    console.error('DB GET ERROR:', err);
    throw err;
  }
}

// -------------------- Init schema & seeds --------------------
const candidatePaths = [
  path.join(__dirname, '..', 'db', 'schema.sql'),
  path.join(__dirname, 'db', 'schema.sql'),
  path.join(process.cwd(), 'db', 'schema.sql'),
  path.join(process.cwd(), 'server', 'db', 'schema.sql'),
];

let schemaPath = candidatePaths.find(p => fs.existsSync(p));
if (!schemaPath) throw new Error('⚠️ schema.sql not found in any expected location.');

const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

const adminExists = get('SELECT id FROM users WHERE email=?', ['admin@nits.ac.in']);
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  run('INSERT INTO users(email,password_hash,role) VALUES(?,?,?)', ['admin@nits.ac.in', hash, 'admin']);
}

const tables = [
  ['mcq_questions', 'seed_round1.sql'],
  ['problems_round2', 'seed_problems.sql'],
  ['schedule', 'seed_schedule.sql'],
];

for (const [table, seedFile] of tables) {
  const count = get(`SELECT COUNT(*) as c FROM ${table}`)?.c ?? 0;
  if (count === 0) {
    const p = path.join(path.dirname(schemaPath), seedFile);
    if (fs.existsSync(p)) db.exec(fs.readFileSync(p, 'utf-8'));
  }
}

['round1_start_iso', 'round1_end_iso', 'round2_start_iso', 'round2_end_iso'].forEach(k => {
  const row = get('SELECT value FROM event_settings WHERE key=?', [k]);
  if (!row) run('INSERT INTO event_settings(key,value) VALUES(?,?)', [k, '']);
});

run('CREATE UNIQUE INDEX IF NOT EXISTS idx_sub2_team ON submissions_round2(team_id)');
console.log('✅ Database ready.');

// -------------------- File Uploads --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// -------------------- Auth Helpers --------------------
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function auth(requiredRole = null) {
  return (req, res, next) => {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
      const data = jwt.verify(token, JWT_SECRET);
      if (requiredRole && data.role !== requiredRole)
        return res.status(403).json({ error: 'Forbidden' });
      req.user = data;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// -------------------- Settings Helpers --------------------
function getSetting(key) {
  const row = get('SELECT value FROM event_settings WHERE key=?', [key]);
  return row ? row.value || '' : '';
}
function setSettings(obj = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const row = get('SELECT value FROM event_settings WHERE key=?', [k]);
    if (row) run('UPDATE event_settings SET value=? WHERE key=?', [v ?? '', k]);
    else run('INSERT INTO event_settings(key,value) VALUES(?,?)', [k, v ?? '']);
  }
}
function parseISO(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function nowISO() { return new Date().toISOString(); }

// -------------------- Round Windows --------------------
function getRoundWindow(round) {
  const s = getSetting(`${round}_start_iso`);
  const e = getSetting(`${round}_end_iso`);
  return { startISO: s, endISO: e, start: parseISO(s), end: parseISO(e) };
}
function ensureWithinWindow(start, end) {
  const now = new Date();
  if (!start || !end) return { ok: false, code: 'WINDOW_NOT_SET', now };
  if (now < start) return { ok: false, code: 'NOT_STARTED', now };
  if (now >= end) return { ok: false, code: 'ENDED', now };
  return { ok: true, now };
}
function ensureAfterStart(start) {
  const now = new Date();
  if (!start) return { ok: false, code: 'WINDOW_NOT_SET', now };
  if (now < start) return { ok: false, code: 'NOT_STARTED', now };
  return { ok: true, now };
}

// -------------------- Public --------------------
app.get('/api/server-time', (req, res) => res.json({ now_iso: nowISO() }));

app.get('/api/event-settings', (req, res) => {
  const r1 = getRoundWindow('round1');
  const r2 = getRoundWindow('round2');
  res.json({ round1: r1, round2: r2, server_now_iso: nowISO() });
});

// -------------------- Auth --------------------
app.post('/api/auth/register', (req, res) => {
  const { team_name, email, password, phone, member1, member2, member3 } = req.body || {};
  if (!team_name || !email || !password || !phone || !member1 || !member2 || !member3)
    return res.status(400).json({ error: 'All fields required.' });

  const teamNameRegex = /^(?!\d+$)[A-Za-z0-9\s]+$/;
  if (!teamNameRegex.test(team_name))
    return res.status(400).json({ error: 'Invalid team name.' });

  if (!/^\d{10}$/.test(phone))
    return res.status(400).json({ error: 'Phone must be 10 digits.' });

  const nameRegex = /^[A-Za-z\s]+$/;
  if (![member1, member2, member3].every(m => nameRegex.test(m)))
    return res.status(400).json({ error: 'Member names must be alphabetic.' });

  run('INSERT INTO teams(team_name, phone, member1, member2, member3) VALUES (?,?,?,?,?)',
    [team_name, phone, member1, member2, member3]);
  const team = get('SELECT id FROM teams WHERE team_name=?', [team_name]);
  const hash = bcrypt.hashSync(password, 10);
  run('INSERT INTO users(email,password_hash,role,team_id) VALUES (?,?,?,?)',
    [email, hash, 'team', team.id]);
  run('INSERT INTO shortlist(team_id) VALUES (?)', [team.id]);
  const token = signToken({ role: 'team', team_id: team.id, email });
  res.json({ token });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = get('SELECT * FROM users WHERE email=?', [email]);
  if (!u || !bcrypt.compareSync(password, u.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ id: u.id, role: u.role, team_id: u.team_id, email: u.email });
  res.json({ token, role: u.role });
});

app.get('/api/me', auth(), (req, res) => {
  if (req.user.role === 'team') {
    const team = get('SELECT * FROM teams WHERE id=?', [req.user.team_id]);
    return res.json({ role: 'team', team });
  }
  return res.json({ role: 'admin', email: req.user.email });
});

// -------------------- Round 1 --------------------
app.get('/api/round1/questions', auth('team'), (req, res) => {
  const att = get('SELECT id FROM attempts_round1 WHERE team_id=? LIMIT 1', [req.user.team_id]);
  if (att) return res.status(403).json({ error: 'ALREADY_SUBMITTED' });

  const { start, end } = getRoundWindow('round1');
  const gate = ensureWithinWindow(start, end);
  if (!gate.ok) return res.status(403).json({ error: gate.code });

  const qs = all('SELECT id, question, opt_a, opt_b, opt_c, opt_d FROM mcq_questions ORDER BY id LIMIT 15');
  res.json(qs);
});

app.post('/api/round1/submit', auth('team'), (req, res) => {
  const existed = get('SELECT id FROM attempts_round1 WHERE team_id=?', [req.user.team_id]);
  if (existed) return res.status(409).json({ error: 'ALREADY_SUBMITTED' });

  const { start, end } = getRoundWindow('round1');
  const gate = ensureWithinWindow(start, end);
  if (!gate.ok) return res.status(403).json({ error: gate.code });

  const answers = req.body.answers || {};
  const qs = all('SELECT id, correct FROM mcq_questions ORDER BY id LIMIT 15');
  let score = 0;
  for (const q of qs) if (answers[q.id] === q.correct) score++;
  run('INSERT INTO attempts_round1(team_id, score, total) VALUES (?,?,?)',
    [req.user.team_id, score, qs.length]);
  res.json({ score, total: qs.length });
});

// -------------------- Round 2 --------------------
app.get('/api/round2/problems', auth('team'), (req, res) => {
  const { start } = getRoundWindow('round2');
  const gate = ensureAfterStart(start);
  if (!gate.ok) return res.status(403).json({ error: gate.code });
  res.json(all('SELECT * FROM problems_round2 ORDER BY id ASC'));
});

app.post('/api/round2/submit', auth('team'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const prev = get('SELECT id FROM submissions_round2 WHERE team_id=?', [req.user.team_id]);
  if (prev) return res.status(409).json({ error: 'ALREADY_SUBMITTED' });
  run('INSERT INTO submissions_round2(team_id, filename) VALUES (?,?)',
    [req.user.team_id, req.file.filename]);
  res.json({ ok: true });
});

// -------------------- Admin Routes --------------------
app.get('/api/admin/teams', auth('admin'), (req, res) =>
  res.json(all('SELECT * FROM teams ORDER BY id DESC'))
);

app.delete('/api/admin/teams/:id', auth('admin'), (req, res) => {
  run('DELETE FROM teams WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

app.post('/api/admin/compute-shortlist', auth('admin'), (req, res) => {
  const teams = all(`
    SELECT t.id as team_id, COALESCE(a.score,0) as score, COALESCE(a.total,15) as total
    FROM teams t
    LEFT JOIN (
      SELECT team_id, score, total
      FROM attempts_round1
      WHERE id IN (SELECT MAX(id) FROM attempts_round1 GROUP BY team_id)
    ) a ON a.team_id = t.id
  `);

  const ranked = teams.map(r => ({ ...r, pct: r.total ? r.score / r.total : 0 }))
    .sort((a, b) => b.pct - a.pct);

  const cutoff = ranked.length > 0 ? ranked[Math.floor(ranked.length * 0.75)]?.pct ?? 0 : 0;

  for (const r of ranked) {
    const qualifies = r.pct >= 0.5 || r.pct >= cutoff;
    run('UPDATE shortlist SET round1_qualified=? WHERE team_id=?', [qualifies ? 1 : 0, r.team_id]);
  }

  res.json({ ok: true });
});
app.get('/api/event-info', (req, res) => {
  res.json({
    prizes: {
      first: { amount: 50000, desc: 'Certificate of Achievement' },
      second: { amount: 40000, desc: 'Certificate of Achievement' },
      third: { amount: 30000, desc: 'Certificate of Achievement' },
    },
    certificates: [
      { type: 'Participation', desc: 'All registered participants.' },
      { type: 'Appreciation', desc: 'Participants securing ≥50% marks or ranking in top 75%.' },
      { type: 'Outstanding Performance', desc: 'Top 10% (≥80% score).' },
    ],
    registration: {
      deadline: '30 December 2025',
      fee: 2000,
      account: {
        number: 'XXX',
        holder: 'YYYY',
        bank: 'SBI, NIT Silchar Branch',
        ifsc: 'SBIN0007061',
        micr: '788002004',
      },
    },
    accommodation: 'Free accommodation will be provided to participants during the final (offline) round.',
    local_visit: 'Participants will have the opportunity to explore local attractions.',
    gala_dinner: 'Engage with esteemed academicians and enjoy the Conference Gala Dinner.',
    registration_link: '[Google Form Link Here]',
    organizing_team: 'Faculty & 3rd year B.Tech Students of CSE Department, NIT Silchar',
    contact: {
      name: 'CR, Sec A & B, B.Tech (CSE), 3rd year, NIT Silchar',
      email: 'hackathon@nits.ac.in',
    },
    conclusion: `This proposed Hackathon will serve as a catalyst to build a culture of innovation, coding excellence, and entrepreneurial thinking among students and professionals. With the support of NIT Silchar, this event is poised to become a prestigious national-level competition in AI, ML, and software development.`,
  });
});

// -------------------- Start Server --------------------
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
