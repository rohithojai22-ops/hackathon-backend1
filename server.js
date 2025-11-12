// server.js — final merged, complete, async, Render/Vercel/Local compatible
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- CONFIG --------------------
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'devjwt';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'hackathon2026.sqlite');

const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://hackathon-frontend.vercel.app',
    '*'
  ],
  credentials: true
}));
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/datasets', express.static(path.join(__dirname, '..', 'public', 'datasets')));

// -------------------- DB INIT --------------------
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`📁 Created directory: ${dbDir}`);
}

// open DB
const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

// convenience wrappers
async function run(sql, params = []) { return db.run(sql, params); }
async function all(sql, params = []) { return db.all(sql, params); }
async function get(sql, params = []) { return db.get(sql, params); }

// find schema & apply
const candidatePaths = [
  path.join(__dirname, '..', 'db', 'schema.sql'),
  path.join(__dirname, 'db', 'schema.sql'),
  path.join(process.cwd(), 'db', 'schema.sql'),
  path.join(process.cwd(), 'server', 'db', 'schema.sql')
];
const schemaPath = candidatePaths.find(p => fs.existsSync(p));
if (!schemaPath) throw new Error('schema.sql not found in expected locations');
const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
await db.exec(schemaSql);

// admin user seed
const adminExists = await get('SELECT id FROM users WHERE email=?', ['admin@nits.ac.in']);
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  await run('INSERT INTO users(email,password_hash,role) VALUES(?,?,?)', ['admin@nits.ac.in', hash, 'admin']);
  console.log('✅ Seeded admin: admin@nits.ac.in / admin123');
}

// seed data files if empty
// ✅ Proper seeding logic to prevent duplicates
const tables = [
  ['mcq_questions', 'seed_round1.sql'],
  ['problems_round2', 'seed_problems.sql'],
  ['schedule', 'seed_schedule.sql'],
];

for (const [table, seedFile] of tables) {
  const row = await get(`SELECT COUNT(*) AS c FROM ${table}`);
  if ((row?.c ?? 0) === 0) {
    const p = path.join(path.dirname(schemaPath), seedFile);
    if (fs.existsSync(p)) {
      await db.exec(fs.readFileSync(p, 'utf-8'));
      console.log(`✅ Seeded ${table} from ${seedFile}`);
    }
  } else {
    console.log(`⚙️ Skipped seeding ${table} — already has ${row.c} records`);
  }
}


// ensure settings keys exist
for (const k of ['round1_start_iso','round1_end_iso','round2_start_iso','round2_end_iso']) {
  const r = await get('SELECT value FROM event_settings WHERE key=?', [k]);
  if (!r) await run('INSERT INTO event_settings(key,value) VALUES(?,?)', [k, '']);
}

await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_sub2_team ON submissions_round2(team_id)');
console.log('✅ Database ready.');

// -------------------- HELPERS --------------------
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
      if (requiredRole && data.role !== requiredRole) return res.status(403).json({ error: 'Forbidden' });
      req.user = data;
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}
async function getSetting(key) {
  const row = await get('SELECT value FROM event_settings WHERE key=?', [key]);
  return row ? row.value || '' : '';
}
async function setSettings(obj = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const r = await get('SELECT key FROM event_settings WHERE key=?', [k]);
    if (r) await run('UPDATE event_settings SET value=? WHERE key=?', [v ?? '', k]);
    else await run('INSERT INTO event_settings(key,value) VALUES(?,?)', [k, v ?? '']);
  }
}
function parseISO(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function nowISO() { return new Date().toISOString(); }

async function getRound1Window() {
  const s = await getSetting('round1_start_iso');
  const e = await getSetting('round1_end_iso');
  return { startISO: s, endISO: e, start: parseISO(s), end: parseISO(e) };
}
async function getRound2Window() {
  const s = await getSetting('round2_start_iso');
  const e = await getSetting('round2_end_iso');
  return { startISO: s, endISO: e, start: parseISO(s), end: parseISO(e) };
}

function ensureWithinWindow(start, end) {
  const now = new Date();
  if (!start || !end) return { ok:false, code:'WINDOW_NOT_SET', now, start, end };
  if (now < start) return { ok:false, code:'NOT_STARTED', now, start, end };
  if (now >= end) return { ok:false, code:'ENDED', now, start, end };
  return { ok:true, now, start, end };
}
function ensureAfterStart(start) {
  const now = new Date();
  if (!start) return { ok:false, code:'WINDOW_NOT_SET', now, start };
  if (now < start) return { ok:false, code:'NOT_STARTED', now, start };
  return { ok:true, now, start };
}

// -------------------- FILE UPLOAD --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const upl = path.join(__dirname, 'uploads');
    if (!fs.existsSync(upl)) fs.mkdirSync(upl, { recursive: true });
    cb(null, upl);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// -------------------- PUBLIC --------------------
app.get('/api/server-time', (req, res) => res.json({ now_iso: nowISO() }));

app.get('/api/event-settings', async (req, res) => {
  const r1 = await getRound1Window();
  const r2 = await getRound2Window();
  res.json({ round1: { start_iso: r1.startISO, end_iso: r1.endISO }, round2: { start_iso: r2.startISO, end_iso: r2.endISO }, server_now_iso: nowISO() });
});

// -------------------- AUTH --------------------
app.post('/api/auth/register', async (req, res) => {
  const { team_name, email, password, phone, member1, member2, member3 } = req.body || {};

  if (!team_name || !email || !password || !phone || !member1 || !member2 || !member3) {
    return res.status(400).json({ error: 'All fields are required (team name, email, password, phone, 3 members).' });
  }

  const teamNameRegex = /^(?!\d+$)[A-Za-z0-9\s]+$/;
  if (!teamNameRegex.test(team_name)) return res.status(400).json({ error: 'Invalid team name. Must be alphabetical or alphanumeric, cannot be only digits.' });

  if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number. Must be exactly 10 digits.' });

  const nameRegex = /^[A-Za-z\s]+$/;
  if (![member1, member2, member3].every(m => nameRegex.test(m))) return res.status(400).json({ error: 'Member names must contain only alphabets and spaces.' });

  try {
    // check email not used
    const exists = await get('SELECT id FROM users WHERE email=?', [email]);
    if (exists) return res.status(400).json({ error: 'Email already registered.' });

    await run('INSERT INTO teams(team_name, phone, member1, member2, member3) VALUES (?,?,?,?,?)', [team_name, phone, member1, member2, member3]);
    const team = await get('SELECT id FROM teams WHERE team_name=? ORDER BY id DESC LIMIT 1', [team_name]);
    const hash = bcrypt.hashSync(password, 10);
    await run('INSERT INTO users(email,password_hash,role,team_id) VALUES (?,?,?,?)', [email, hash, 'team', team.id]);
    await run('INSERT INTO shortlist(team_id) VALUES (?)', [team.id]);

    const token = signToken({ id: 0, role: 'team', team_id: team.id, email });
    return res.json({ token });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const u = await get('SELECT * FROM users WHERE email=?', [email]);
    if (!u || !bcrypt.compareSync(password, u.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ id: u.id, role: u.role, team_id: u.team_id, email: u.email });
    res.json({ token, role: u.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// -------------------- ME --------------------
app.get('/api/me', auth(), async (req, res) => {
  if (req.user.role === 'team') {
    const team = await get('SELECT * FROM teams WHERE id=?', [req.user.team_id]);
    return res.json({ role: 'team', team });
  } else {
    return res.json({ role: 'admin', email: req.user.email });
  }
});

// -------------------- STATUS --------------------
app.get('/api/status', auth(), async (req, res) => {
  const attempt = await get('SELECT score,total FROM attempts_round1 WHERE team_id=? ORDER BY id DESC LIMIT 1', [req.user.team_id]);
  const short = await get('SELECT * FROM shortlist WHERE team_id=?', [req.user.team_id]);
  const r1 = await getRound1Window();
  const r2 = await getRound2Window();
  res.json({
    round1: attempt ? attempt : null,
    shortlist: short || { round1_qualified: 0, round2_shortlisted: 0 },
    round1_window: { start_iso: r1.startISO, end_iso: r1.endISO, server_now_iso: nowISO() },
    round2_window: { start_iso: r2.startISO, end_iso: r2.endISO, server_now_iso: nowISO() },
    round1_attempted: !!attempt
  });
});

// -------------------- ROUND 1 --------------------
app.get('/api/round1/questions', auth('team'), async (req, res) => {
  const att = await get('SELECT id FROM attempts_round1 WHERE team_id=? LIMIT 1', [req.user.team_id]);
  if (att) return res.status(403).json({ error: 'ALREADY_SUBMITTED' });

  const { start, end, startISO, endISO } = await getRound1Window();
  const gate = ensureWithinWindow(start, end);
  if (!gate.ok) {
    return res.status(403).json({
      error: gate.code,
      server_now_iso: nowISO(),
      start_iso: startISO,
      end_iso: endISO,
      message:
        gate.code === 'WINDOW_NOT_SET' ? 'Round 1 window not set by admin.' :
        gate.code === 'NOT_STARTED' ? 'Round 1 has not started yet.' :
        'Round 1 has ended.'
    });
  }

  const qs = await all('SELECT id, question, opt_a, opt_b, opt_c, opt_d FROM mcq_questions ORDER BY id LIMIT 15');
  res.json(qs);
});

app.post('/api/round1/submit', auth('team'), async (req, res) => {
  const existed = await get('SELECT id,score,total FROM attempts_round1 WHERE team_id=? ORDER BY id DESC LIMIT 1', [req.user.team_id]);
  if (existed) return res.status(409).json({ error: 'ALREADY_SUBMITTED', score: existed.score, total: existed.total });

  const { start, end, startISO, endISO } = await getRound1Window();
  const gate = ensureWithinWindow(start, end);
  if (!gate.ok) {
    return res.status(403).json({
      error: gate.code,
      server_now_iso: nowISO(),
      start_iso: startISO,
      end_iso: endISO,
      message:
        gate.code === 'WINDOW_NOT_SET' ? 'Round 1 window not set by admin.' :
        gate.code === 'NOT_STARTED' ? 'Round 1 has not started yet.' :
        'Round 1 has ended.'
    });
  }

  const answers = req.body.answers || {};
  const qs = await all('SELECT id, correct FROM mcq_questions ORDER BY id LIMIT 15');
  let score = 0;
  for (const q of qs) if (answers[q.id] && answers[q.id] === q.correct) score++;
  await run('INSERT INTO attempts_round1(team_id, score, total) VALUES (?,?,?)', [req.user.team_id, score, qs.length]);
  res.json({ score, total: qs.length });
});

// -------------------- ROUND 2 --------------------
app.get('/api/round2/problems', auth('team'), async (req, res) => {
  const { start, startISO } = await getRound2Window();
  const gate = ensureAfterStart(start);
  if (!gate.ok) {
    return res.status(403).json({
      error: gate.code,
      message: 'Round 2 has not started yet.',
      server_now_iso: nowISO(),
      start_iso: startISO,
    });
  }
  const ps = await all('SELECT * FROM problems_round2 ORDER BY id ASC');
  res.json(ps);
});

// helper route used by client: my submission for round2
app.get('/api/round2/my-submission', auth('team'), async (req, res) => {
  const sub = await get('SELECT * FROM submissions_round2 WHERE team_id=?', [req.user.team_id]);
  res.json(sub || null);
});

app.post('/api/round2/submit', auth('team'), upload.single('file'), async (req, res) => {
  const { start, startISO } = await getRound2Window();
  const gate = ensureAfterStart(start);
  if (!gate.ok) {
    return res.status(403).json({
      error: gate.code,
      message: 'Round 2 has not started yet.',
      server_now_iso: nowISO(),
      start_iso: startISO,
    });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const prev = await get('SELECT id FROM submissions_round2 WHERE team_id=?', [req.user.team_id]);
  if (prev) return res.status(409).json({ error: 'ALREADY_SUBMITTED' });

  await run('INSERT INTO submissions_round2(team_id, filename, created_at) VALUES (?,?,?)', [req.user.team_id, req.file.filename, nowISO()]);
  res.json({ ok: true, filename: req.file.filename });
});

// -------------------- CERTIFICATE DATA --------------------
app.get('/api/certificate-data', auth('team'), async (req, res) => {
  const team = await get('SELECT team_name FROM teams WHERE id=?', [req.user.team_id]);
  const att = await get('SELECT score, total, created_at FROM attempts_round1 WHERE team_id=? ORDER BY id DESC LIMIT 1', [req.user.team_id]);
  const short = await get('SELECT round1_qualified FROM shortlist WHERE team_id=?', [req.user.team_id]);
  res.json({
    teamName: team?.team_name || 'Team',
    score: att?.score ?? 0,
    total: att?.total ?? 15,
    qualified: short?.round1_qualified ? true : false,
    date: (att?.created_at) ? new Date(att.created_at).toISOString() : new Date().toISOString()
  });
});

// -------------------- ADMIN --------------------
app.get('/api/admin/teams', auth('admin'), async (req, res) => {
  const teams = await all('SELECT * FROM teams ORDER BY id DESC');
  res.json(teams);
});

app.delete('/api/admin/teams/:id', auth('admin'), async (req, res) => {
  await run('DELETE FROM teams WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/admin/submissions', auth('admin'), async (req, res) => {
  const subs = await all('SELECT * FROM submissions_round2 ORDER BY created_at DESC');
  res.json(subs);
});

// MCQ admin endpoints
app.get('/api/admin/mcqs', auth('admin'), async (req, res) => {
  const qs = await all('SELECT * FROM mcq_questions ORDER BY id DESC');
  res.json(qs);
});
app.post('/api/admin/mcqs', auth('admin'), async (req, res) => {
  const { question, opt_a, opt_b, opt_c, opt_d, correct } = req.body || {};
  await run('INSERT INTO mcq_questions(question,opt_a,opt_b,opt_c,opt_d,correct) VALUES (?,?,?,?,?,?)', [question, opt_a, opt_b, opt_c, opt_d, correct]);
  res.json({ ok: true });
});
app.put('/api/admin/mcqs/:id', auth('admin'), async (req, res) => {
  const { question, opt_a, opt_b, opt_c, opt_d, correct } = req.body || {};
  await run('UPDATE mcq_questions SET question=?, opt_a=?, opt_b=?, opt_c=?, opt_d=?, correct=? WHERE id=?', [question, opt_a, opt_b, opt_c, opt_d, correct, req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/admin/mcqs/:id', auth('admin'), async (req, res) => {
  await run('DELETE FROM mcq_questions WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// Problems admin endpoints
app.get('/api/admin/problems', auth('admin'), async (req, res) => {
  const ps = await all('SELECT * FROM problems_round2 ORDER BY id DESC');
  res.json(ps);
});
app.post('/api/admin/problems', auth('admin'), async (req, res) => {
  const { title, statement } = req.body || {};
  await run('INSERT INTO problems_round2(title,statement) VALUES (?,?)', [title, statement]);
  res.json({ ok: true });
});
app.put('/api/admin/problems/:id', auth('admin'), async (req, res) => {
  const { title, statement } = req.body || {};
  await run('UPDATE problems_round2 SET title=?, statement=? WHERE id=?', [title, statement, req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/admin/problems/:id', auth('admin'), async (req, res) => {
  await run('DELETE FROM problems_round2 WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// compute shortlist
app.post('/api/admin/compute-shortlist', auth('admin'), async (req, res) => {
  const latest = await all(`
    SELECT t.id as team_id, COALESCE(a.score,0) as score, COALESCE(a.total,15) as total
    FROM teams t
    LEFT JOIN (
      SELECT team_id, score, total
      FROM attempts_round1
      WHERE id IN (SELECT MAX(id) FROM attempts_round1 GROUP BY team_id)
    ) a ON a.team_id = t.id
  `);

  const withPct = latest.map(r => ({ ...r, pct: r.total ? r.score / r.total : 0 })).sort((a,b)=>b.pct - a.pct);
  const n = withPct.length;
  const cutoffIndex = Math.floor(n * 0.75) - 1;
  const cutoffPct = cutoffIndex >= 0 && n > 0 ? withPct[cutoffIndex].pct : 0;

  for (const row of withPct) {
    const qualifies = row.pct >= 0.5 || row.pct >= cutoffPct;
    await run('UPDATE shortlist SET round1_qualified=? WHERE team_id=?', [qualifies ? 1 : 0, row.team_id]);
  }

  const subs = await all('SELECT DISTINCT team_id FROM submissions_round2');
  for (const s of subs) {
    const st = await get('SELECT round1_qualified FROM shortlist WHERE team_id=?', [s.team_id]);
    if (st && st.round1_qualified) {
      await run('UPDATE shortlist SET round2_shortlisted=1 WHERE team_id=?', [s.team_id]);
    }
  }
  res.json({ ok: true, message: 'Shortlist computed' });
});

// -------------------- EVENT SETTINGS (admin-friendly) --------------------
app.get('/api/admin/event-settings', auth('admin'), async (req, res) => {
  const rows = await all('SELECT key, value FROM event_settings');
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});
app.put('/api/admin/event-settings', auth('admin'), async (req, res) => {
  const allowedKeys = ['round1_start_iso','round1_end_iso','round2_start_iso','round2_end_iso'];
  const payload = {};
  for (const k of allowedKeys) if (req.body[k] !== undefined) payload[k] = req.body[k];
  if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No valid settings provided' });
  // validate ISO dates
  try {
    if (payload.round1_start_iso && !parseISO(payload.round1_start_iso)) return res.status(400).json({ error: 'Invalid round1_start_iso' });
    if (payload.round1_end_iso && !parseISO(payload.round1_end_iso)) return res.status(400).json({ error: 'Invalid round1_end_iso' });
    if (payload.round1_start_iso && payload.round1_end_iso && new Date(payload.round1_start_iso) >= new Date(payload.round1_end_iso)) return res.status(400).json({ error: 'R1 start must be before end' });
    if (payload.round2_start_iso && !parseISO(payload.round2_start_iso)) return res.status(400).json({ error: 'Invalid round2_start_iso' });
    await setSettings(payload);
    const r1 = await getRound1Window(); const r2 = await getRound2Window();
    res.json({ ok: true, round1: { start_iso: r1.startISO, end_iso: r1.endISO }, round2: { start_iso: r2.startISO, end_iso: r2.endISO }, server_now_iso: nowISO() });
  } catch (err) {
    console.error('Save settings error:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// -------------------- SCHEDULE --------------------
app.get('/api/schedule', async (req, res) => {
  const rows = await all('SELECT * FROM schedule ORDER BY date ASC, id ASC');
  res.json(rows);
});
app.post('/api/admin/schedule', auth('admin'), async (req, res) => {
  const { round, title, description, date } = req.body || {};
  await run('INSERT INTO schedule(round,title,description,date) VALUES (?,?,?,?)', [round || '', title || '', description || '', date || '']);
  res.json({ ok: true });
});
app.put('/api/admin/schedule/:id', auth('admin'), async (req, res) => {
  const { round, title, description, date } = req.body || {};
  await run('UPDATE schedule SET round=?, title=?, description=?, date=? WHERE id=?', [round || '', title || '', description || '', date || '', req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/admin/schedule/:id', auth('admin'), async (req, res) => {
  await run('DELETE FROM schedule WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// -------------------- LEADERBOARD --------------------
app.get('/api/leaderboard', async (req, res) => {
  let isAdmin = false;
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (token) {
      const data = jwt.verify(token, JWT_SECRET);
      isAdmin = data.role === 'admin';
    }
  } catch (_) {}

  const { end } = await getRound1Window();
  const now = new Date();
  if (!isAdmin && end && now < end) {
    return res.status(403).json({
      error: 'LEADERBOARD_LOCKED',
      message: 'Leaderboard unlocks after Round 1 ends.',
      unlock_at_iso: end.toISOString(),
      server_now_iso: now.toISOString()
    });
  }

  const rows = await all(`
    WITH last_attempt AS (
      SELECT team_id, MAX(id) as max_id FROM attempts_round1 GROUP BY team_id
    )
    SELECT t.team_name, a.score, a.total, a.created_at
    FROM teams t
    JOIN last_attempt la ON la.team_id = t.id
    JOIN attempts_round1 a ON a.id = la.max_id
    ORDER BY CAST(a.score AS REAL)/a.total DESC, a.created_at ASC
    LIMIT 100
  `);
  res.json(rows);
});

// -------------------- EVENT INFO --------------------
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
    accommodation: 'Free accommodation for finalists.',
    local_visit: 'Participants will have the opportunity to explore local attractions.',
    gala_dinner: 'Meet experts and enjoy a gala dinner!',
    registration_link: '[Google Form Link Here]',
    organizing_team: 'Faculty & 3rd year B.Tech Students of CSE Department, NIT Silchar',
    contact: { name: 'CR, Sec A & B, B.Tech (CSE), 3rd year, NIT Silchar', email: 'hackathon@nits.ac.in' },
    conclusion: `This Hackathon aims to build a culture of innovation and coding excellence among students and professionals.`
  });
});

// -------------------- DEBUG --------------------
app.get('/debug-users', async (req, res) => {
  try {
    const users = await all('SELECT id, email, role, team_id FROM users');
    res.json(users);
  } catch (err) {
    console.error('debug-users error', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// -------------------- START --------------------
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
