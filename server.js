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

// -------------------- DB helpers --------------------
const db = new sqlite3.Database(DB_PATH);
function run(sql, params = []) {
  return new Promise((res, rej) =>
    db.run(sql, params, function (e) { e ? rej(e) : res(this); })
  );
}
function all(sql, params = []) {
  return new Promise((res, rej) =>
    db.all(sql, params, (e, r) => (e ? rej(e) : res(r)))
  );
}
function get(sql, params = []) {
  return new Promise((res, rej) =>
    db.get(sql, params, (e, r) => (e ? rej(e) : res(r)))
  );
}

// -------------------- Init schema & seeds --------------------
// -------------------- Init schema & seeds --------------------
// Try to locate schema.sql from multiple possible locations
const candidatePaths = [
  path.join(__dirname, '..', 'db', 'schema.sql'),       // when db is one folder up
  path.join(__dirname, 'db', 'schema.sql'),             // when db is inside same folder
  path.join(process.cwd(), 'db', 'schema.sql'),         // when db is in repo root
  path.join(process.cwd(), 'server', 'db', 'schema.sql') // when db is under /server/db
];

let schemaPath = candidatePaths.find(p => fs.existsSync(p));

if (!schemaPath) {
  console.error('⚠️ schema.sql not found. Tried paths:', candidatePaths);
  throw new Error('Database schema file (db/schema.sql) not found.');
}

const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema, async (err) => {
  if (err) console.error('Schema error:', err);

  const u = await get('SELECT id FROM users WHERE email=?', ['admin@nits.ac.in']).catch(()=>null);
  if (!u) {
    const hash = bcrypt.hashSync('admin123', 10);
    await run('INSERT INTO users(email,password_hash,role) VALUES(?,?,?)', [
      'admin@nits.ac.in', hash, 'admin'
    ]);
  }

  const qcount = await get('SELECT COUNT(*) as c FROM mcq_questions').catch(()=>({c:0}));
  if (qcount.c === 0) {
    const p = path.join(path.dirname(schemaPath), 'seed_round1.sql');
    if (fs.existsSync(p)) db.exec(fs.readFileSync(p, 'utf-8'));
  }

  const pcount = await get('SELECT COUNT(*) as c FROM problems_round2').catch(()=>({c:0}));
  if (pcount.c === 0) {
    const p = path.join(path.dirname(schemaPath), 'seed_problems.sql');
    if (fs.existsSync(p)) db.exec(fs.readFileSync(p, 'utf-8'));
  }

  const scount = await get('SELECT COUNT(*) as c FROM schedule').catch(()=>({c:0}));
  if (scount.c === 0) {
    const p = path.join(path.dirname(schemaPath), 'seed_schedule.sql');
    if (fs.existsSync(p)) db.exec(fs.readFileSync(p, 'utf-8'));
  }

  const keys = ['round1_start_iso','round1_end_iso','round2_start_iso','round2_end_iso'];
  for (const k of keys) {
    const row = await get('SELECT value FROM event_settings WHERE key=?', [k]).catch(()=>null);
    if (!row) await run('INSERT INTO event_settings(key,value) VALUES(?,?)', [k,'']);
  }

  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_sub2_team ON submissions_round2(team_id)').catch(()=>{});
  console.log('✅ Database ready.');
});


// -------------------- File Uploads --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// -------------------- Auth helpers --------------------
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
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// -------------------- Settings helpers --------------------
async function getSetting(key) {
  const row = await get('SELECT value FROM event_settings WHERE key=?', [key]).catch(()=>null);
  return row ? (row.value || '') : '';
}
async function setSettings(obj = {}) {
  for (const [k,v] of Object.entries(obj)) {
    const has = await get('SELECT value FROM event_settings WHERE key=?', [k]).catch(()=>null);
    if (has) await run('UPDATE event_settings SET value=? WHERE key=?', [v ?? '', k]);
    else await run('INSERT INTO event_settings(key,value) VALUES(?,?)', [k, v ?? '']);
  }
}
function parseISO(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function nowISO() { return new Date().toISOString(); }

// -------------------- ROUND WINDOWS --------------------
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
  if (now < start)     return { ok:false, code:'NOT_STARTED',   now, start, end };
  if (now >= end)      return { ok:false, code:'ENDED',         now, start, end };
  return { ok:true, now, start, end };
}
function ensureAfterStart(start) {
  const now = new Date();
  if (!start) return { ok:false, code:'WINDOW_NOT_SET', now, start };
  if (now < start) return { ok:false, code:'NOT_STARTED', now, start };
  return { ok:true, now, start };
}

// -------------------- PUBLIC ENDPOINTS --------------------
app.get('/api/server-time', (req, res) => {
  res.json({ now_iso: nowISO() });
});
app.get('/api/event-settings', async (req, res) => {
  const r1 = await getRound1Window();
  const r2 = await getRound2Window();
  res.json({
    round1: { start_iso: r1.startISO, end_iso: r1.endISO },
    round2: { start_iso: r2.startISO, end_iso: r2.endISO },
    server_now_iso: nowISO()
  });
});

// -------------------- AUTH --------------------
app.post('/api/auth/register', async (req, res) => {
  const { team_name, email, password, phone, member1, member2, member3 } = req.body || {};

  if (!team_name || !email || !password || !phone || !member1 || !member2 || !member3) {
    return res.status(400).json({ error: 'All fields are required (team name, email, password, phone, 3 members).' });
  }

  // ✅ Team name must be alphabetic or alphanumeric, NOT purely numeric
  const teamNameRegex = /^(?!\d+$)[A-Za-z0-9\s]+$/;
  if (!teamNameRegex.test(team_name)) {
    return res.status(400).json({
      error: 'Invalid team name. Must be alphabetical or alphanumeric, cannot be only digits.'
    });
  }

  // ✅ Phone must be exactly 10 digits
  if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number. Must be exactly 10 digits.' });

  // ✅ Member names only alphabets and spaces
  const nameRegex = /^[A-Za-z\s]+$/;
  if (![member1, member2, member3].every(m => nameRegex.test(m))) {
    return res.status(400).json({ error: 'Member names must contain only alphabets and spaces.' });
  }

  try {
    await run('INSERT INTO teams(team_name, phone, member1, member2, member3) VALUES (?,?,?,?,?)',
      [team_name, phone, member1, member2, member3]);

    const team = await get('SELECT id FROM teams WHERE team_name=?', [team_name]);

    const hash = bcrypt.hashSync(password, 10);
    await run('INSERT INTO users(email,password_hash,role,team_id) VALUES (?,?,?,?)', [email, hash, 'team', team.id]);

    await run('INSERT INTO shortlist(team_id) VALUES (?)', [team.id]);

    const token = signToken({ id: 0, role: 'team', team_id: team.id, email });
    res.json({ token });

  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const u = await get('SELECT * FROM users WHERE email=?', [email]);
  if (!u || !bcrypt.compareSync(password, u.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ id: u.id, role: u.role, team_id: u.team_id, email: u.email });
  res.json({ token, role: u.role });
});

app.get('/api/me', auth(), async (req, res) => {
  if (req.user.role === 'team') {
    const team = await get('SELECT * FROM teams WHERE id=?', [req.user.team_id]);
    return res.json({ role: 'team', team });
  } else {
    return res.json({ role: 'admin', email: req.user.email });
  }
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
  await run('INSERT INTO attempts_round1(team_id, score, total) VALUES (?,?,?)', [
    req.user.team_id, score, qs.length,
  ]);
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

  await run('INSERT INTO submissions_round2(team_id, filename) VALUES (?,?)', [
    req.user.team_id, req.file.filename,
  ]);
  res.json({ ok: true, filename: req.file.filename });
});

// -------------------- STATUS --------------------
app.get('/api/status', auth(), async (req, res) => {
  const attempt = await get(
    'SELECT score,total FROM attempts_round1 WHERE team_id=? ORDER BY id DESC LIMIT 1',
    [req.user.team_id]
  );
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


// -------------------- ADMIN --------------------
app.get('/api/admin/teams', auth('admin'), async (req, res) => {
  const teams = await all('SELECT * FROM teams ORDER BY id DESC');
  res.json(teams);
});
app.get('/api/admin/submissions', auth('admin'), async (req, res) => {
  const subs = await all('SELECT * FROM submissions_round2 ORDER BY created_at DESC');
  res.json(subs);
});
app.get('/api/admin/mcqs', auth('admin'), async (req, res) => {
  const qs = await all('SELECT * FROM mcq_questions ORDER BY id DESC');
  res.json(qs);
});
app.post('/api/admin/mcqs', auth('admin'), async (req, res) => {
  const { question, opt_a, opt_b, opt_c, opt_d, correct } = req.body || {};
  await run('INSERT INTO mcq_questions(question,opt_a,opt_b,opt_c,opt_d,correct) VALUES (?,?,?,?,?,?)',
    [question, opt_a, opt_b, opt_c, opt_d, correct]);
  res.json({ ok: true });
});
app.put('/api/admin/mcqs/:id', auth('admin'), async (req, res) => {
  const { question, opt_a, opt_b, opt_c, opt_d, correct } = req.body || {};
  await run('UPDATE mcq_questions SET question=?, opt_a=?, opt_b=?, opt_c=?, opt_d=?, correct=? WHERE id=?',
    [question, opt_a, opt_b, opt_c, opt_d, correct, req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/admin/mcqs/:id', auth('admin'), async (req, res) => {
  await run('DELETE FROM mcq_questions WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

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

// -------------------- EVENT SETTINGS --------------------
app.get('/api/admin/event-settings', auth('admin'), async (req, res) => {
  const r1 = await getRound1Window();
  const r2 = await getRound2Window();
  res.json({
    round1: { start_iso: r1.startISO, end_iso: r1.endISO },
    round2: { start_iso: r2.startISO, end_iso: r2.endISO },
    server_now_iso: nowISO()
  });
});
app.put('/api/admin/event-settings', auth('admin'), async (req, res) => {
  const { round1_start_iso, round1_end_iso, round2_start_iso, round2_end_iso } = req.body || {};
  const s1 = round1_start_iso ? parseISO(round1_start_iso) : null;
  const e1 = round1_end_iso ? parseISO(round1_end_iso) : null;
  const s2 = round2_start_iso ? parseISO(round2_start_iso) : null;
  const e2 = round2_end_iso ? parseISO(round2_end_iso) : null;

  if (round1_start_iso && !s1) return res.status(400).json({ error: 'Invalid round1_start_iso' });
  if (round1_end_iso && !e1) return res.status(400).json({ error: 'Invalid round1_end_iso' });
  if (s1 && e1 && s1 >= e1) return res.status(400).json({ error: 'R1 start must be before end' });
  if (round2_start_iso && !s2) return res.status(400).json({ error: 'Invalid round2_start_iso' });

  await setSettings({
    round1_start_iso: s1 ? s1.toISOString() : '',
    round1_end_iso:   e1 ? e1.toISOString() : '',
    round2_start_iso: s2 ? s2.toISOString() : '',
    round2_end_iso:   e2 ? e2.toISOString() : '',
  });

  const r1 = await getRound1Window();
  const r2 = await getRound2Window();
  res.json({ ok: true, round1: { start_iso: r1.startISO, end_iso: r1.endISO }, round2: { start_iso: r2.startISO, end_iso: r2.endISO }, server_now_iso: nowISO() });
});

// -------------------- SHORTLIST COMPUTE --------------------
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

  const withPct = latest
    .map(r => ({ ...r, pct: r.total ? r.score / r.total : 0 }))
    .sort((a, b) => b.pct - a.pct);

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

// -------------------- SCHEDULE --------------------
app.get('/api/schedule', async (req, res) => {
  const rows = await all('SELECT * FROM schedule ORDER BY date ASC, id ASC');
  res.json(rows);
});
app.post('/api/admin/schedule', auth('admin'), async (req, res) => {
  const { round, title, description, date } = req.body || {};
  await run('INSERT INTO schedule(round,title,description,date) VALUES (?,?,?,?)',
    [round || '', title || '', description || '', date || '']);
  res.json({ ok: true });
});
app.put('/api/admin/schedule/:id', auth('admin'), async (req, res) => {
  const { round, title, description, date } = req.body || {};
  await run('UPDATE schedule SET round=?, title=?, description=?, date=? WHERE id=?',
    [round || '', title || '', description || '', date || '', req.params.id]);
  res.json({ ok: true });
});
app.delete('/api/admin/schedule/:id', auth('admin'), async (req, res) => {
  await run('DELETE FROM schedule WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// -------------------- TEAM UPDATE --------------------
app.put('/api/team', auth('team'), async (req, res) => {
  const { phone, member1, member2, member3 } = req.body || {};
  if (!/^\d{10}$/.test(phone || '')) return res.status(400).json({ error: 'Invalid phone (10 digits).' });
  const nameRegex = /^[A-Za-z\s]+$/;
  if (![member1, member2, member3].every(m => nameRegex.test(m || '')))
    return res.status(400).json({ error: 'Member names must contain only alphabets and spaces.' });

  await run('UPDATE teams SET phone=?, member1=?, member2=?, member3=? WHERE id=?',
    [phone || '', member1 || '', member2 || '', member3 || '', req.user.team_id]);
  const team = await get('SELECT * FROM teams WHERE id=?', [req.user.team_id]);
  res.json({ ok: true, team });
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

// -------------------- START SERVER --------------------
app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));