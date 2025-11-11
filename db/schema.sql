PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'team',
  team_id INTEGER,
  FOREIGN KEY(team_id) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_name TEXT NOT NULL,
  phone TEXT,
  member1 TEXT,
  member2 TEXT,
  member3 TEXT
);

CREATE TABLE IF NOT EXISTS mcq_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  opt_a TEXT NOT NULL,
  opt_b TEXT NOT NULL,
  opt_c TEXT NOT NULL,
  opt_d TEXT NOT NULL,
  correct TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts_round1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(team_id) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS problems_round2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  statement TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions_round2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  score INTEGER,
  notes TEXT,
  FOREIGN KEY(team_id) REFERENCES teams(id)
);

-- Enforce single upload per team
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub2_team ON submissions_round2(team_id);

CREATE TABLE IF NOT EXISTS shortlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  round1_qualified INTEGER DEFAULT 0,
  round2_shortlisted INTEGER DEFAULT 0,
  FOREIGN KEY(team_id) REFERENCES teams(id)
);

-- schedule (public)
CREATE TABLE IF NOT EXISTS schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT
);

-- Admin-configurable windows
CREATE TABLE IF NOT EXISTS event_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
