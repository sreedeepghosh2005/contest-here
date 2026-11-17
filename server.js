'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { db, tx } = require('./db');
const judge = require('./judge');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('Set ADMIN_PASSWORD before starting, e.g. ADMIN_PASSWORD=secret npm start');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '2mb' }));
// The React landing page (built from web/ by `npm run build-web`) is served first, so "/" is the hero page.
// The other pages (contest, solve, leaderboard, admin) come from public/.
app.use(express.static(path.join(__dirname, 'public-landing')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/codemirror', express.static(path.join(__dirname, 'node_modules/codemirror')));

const now = () => Date.now();
const hashPin = (pin, salt = crypto.randomBytes(16).toString('hex')) =>
  salt + ':' + crypto.scryptSync(String(pin), salt, 32).toString('hex');
const checkPin = (pin, stored) => {
  const [salt, hash] = stored.split(':');
  const got = crypto.scryptSync(String(pin), salt, 32);
  return crypto.timingSafeEqual(got, Buffer.from(hash, 'hex'));
};

function fail(res, status, message) {
  res.status(status).json({ error: message });
}
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => {
  console.error(err);
  fail(res, 500, err.message || 'Server error');
});

// ---------- admin auth ----------
const adminTokens = new Set();
app.post('/api/admin/login', (req, res) => {
  const given = Buffer.from(String(req.body.password || ''));
  const want = Buffer.from(ADMIN_PASSWORD);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return fail(res, 401, 'Wrong password');
  }
  const token = crypto.randomBytes(24).toString('hex');
  adminTokens.add(token);
  res.json({ token });
});
function admin(req, res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer /, '');
  if (!adminTokens.has(token)) return fail(res, 401, 'Admin login needed');
  next();
}

// ---------- admin: events ----------
app.get('/api/admin/events', admin, (req, res) => {
  res.json(db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM questions q WHERE q.event_id = e.id) AS question_count,
      (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id) AS participant_count
    FROM events e ORDER BY e.id DESC`).all());
});

app.post('/api/admin/events', admin, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return fail(res, 400, 'Event name is required');
  let code = String(req.body.code || '').trim().toUpperCase();
  if (!code) code = crypto.randomBytes(3).toString('hex').toUpperCase();
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) return fail(res, 400, 'Code: 3-20 letters, digits or -');
  try {
    const r = db.prepare('INSERT INTO events (name, code, is_open, created_at) VALUES (?, ?, 0, ?)')
      .run(name, code, now());
    res.json({ id: Number(r.lastInsertRowid), code });
  } catch {
    fail(res, 400, 'That event code is already used');
  }
});

app.patch('/api/admin/events/:id', admin, (req, res) => {
  const e = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!e) return fail(res, 404, 'No such event');
  const name = req.body.name !== undefined ? String(req.body.name).trim() : e.name;
  const isOpen = req.body.is_open !== undefined ? (req.body.is_open ? 1 : 0) : e.is_open;
  db.prepare('UPDATE events SET name = ?, is_open = ? WHERE id = ?').run(name, isOpen, e.id);
  res.json({ ok: true });
});

app.delete('/api/admin/events/:id', admin, (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/events/:id/reset', admin, (req, res) => {
  // Removes all participants (and their attempts and submissions). Questions stay.
  db.prepare('DELETE FROM participants WHERE event_id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- admin: questions and test cases ----------
app.get('/api/admin/events/:id/questions', admin, (req, res) => {
  const qs = db.prepare('SELECT * FROM questions WHERE event_id = ? ORDER BY position, id')
    .all(req.params.id);
  const tcs = db.prepare('SELECT * FROM test_cases WHERE question_id = ? ORDER BY id');
  res.json(qs.map((q) => ({ ...q, test_cases: tcs.all(q.id) })));
});

function readQuestion(body) {
  const title = String(body.title || '').trim();
  const statement = String(body.statement || '');
  const timeLimit = Math.round(Number(body.time_limit_ms || 3000));
  const tests = Array.isArray(body.test_cases) ? body.test_cases : [];
  if (!title) throw new Error('Title is required');
  if (!(timeLimit >= 100 && timeLimit <= 20000)) throw new Error('Time limit must be 100-20000 ms');
  if (!tests.length) throw new Error('Add at least one test case');
  if (tests.length > 50) throw new Error('At most 50 test cases');
  return {
    title, statement, timeLimit, position: Math.round(Number(body.position || 0)),
    tests: tests.map((t) => ({
      input: String(t.input ?? ''),
      expected: String(t.expected_output ?? ''),
      sample: t.is_sample ? 1 : 0,
    })),
  };
}
function writeTests(questionId, tests) {
  db.prepare('DELETE FROM test_cases WHERE question_id = ?').run(questionId);
  const ins = db.prepare(
    'INSERT INTO test_cases (question_id, input, expected_output, is_sample) VALUES (?, ?, ?, ?)');
  for (const t of tests) ins.run(questionId, t.input, t.expected, t.sample);
}

app.post('/api/admin/events/:id/questions', admin, (req, res) => {
  let q;
  try { q = readQuestion(req.body); } catch (err) { return fail(res, 400, err.message); }
  const id = tx(() => {
    const r = db.prepare(
      'INSERT INTO questions (event_id, title, statement, time_limit_ms, position) VALUES (?, ?, ?, ?, ?)')
      .run(req.params.id, q.title, q.statement, q.timeLimit, q.position);
    const qid = Number(r.lastInsertRowid);
    writeTests(qid, q.tests);
    return qid;
  });
  res.json({ id });
});

app.put('/api/admin/questions/:id', admin, (req, res) => {
  let q;
  try { q = readQuestion(req.body); } catch (err) { return fail(res, 400, err.message); }
  tx(() => {
    db.prepare('UPDATE questions SET title = ?, statement = ?, time_limit_ms = ?, position = ? WHERE id = ?')
      .run(q.title, q.statement, q.timeLimit, q.position, req.params.id);
    writeTests(req.params.id, q.tests);
  });
  res.json({ ok: true });
});

app.delete('/api/admin/questions/:id', admin, (req, res) => {
  db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Admin checks a reference solution against the question's test cases.
app.post('/api/admin/questions/:id/check', admin, wrap(async (req, res) => {
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!q) return fail(res, 404, 'No such question');
  const { language, code } = req.body;
  if (!judge.LANGUAGES.includes(language)) return fail(res, 400, 'Unknown language');
  const tests = db.prepare('SELECT * FROM test_cases WHERE question_id = ? ORDER BY id').all(q.id);
  const result = await judge.run({
    language, code: String(code || ''), inputs: tests.map((t) => t.input), timeLimitMs: q.time_limit_ms,
  });
  res.json(grade(result, tests));
}));

app.get('/api/admin/events/:id/submissions', admin, (req, res) => {
  res.json(db.prepare(`
    SELECT s.id, s.language, s.verdict, s.created_at, p.name AS participant, q.title AS question
    FROM submissions s
    JOIN participants p ON p.id = s.participant_id
    JOIN questions q ON q.id = s.question_id
    WHERE p.event_id = ? ORDER BY s.id DESC LIMIT 300`).all(req.params.id));
});

app.get('/api/admin/submissions/:id', admin, (req, res) => {
  const s = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!s) return fail(res, 404, 'No such submission');
  res.json(s);
});

// ---------- participants ----------
app.post('/api/join', (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const name = String(req.body.name || '').trim();
  const pin = String(req.body.pin || '');
  const event = db.prepare('SELECT * FROM events WHERE code = ?').get(code);
  if (!event) return fail(res, 404, 'No event with that code');
  if (!name || name.length > 40) return fail(res, 400, 'Name must be 1-40 characters');
  if (!/^\d{4,8}$/.test(pin)) return fail(res, 400, 'PIN must be 4-8 digits');

  const existing = db.prepare('SELECT * FROM participants WHERE event_id = ? AND name = ?')
    .get(event.id, name);
  if (existing) {
    if (!checkPin(pin, existing.pin_hash)) return fail(res, 401, 'That name is taken. Wrong PIN.');
    return res.json({ token: existing.token });
  }
  if (!event.is_open) return fail(res, 403, 'This event is not open yet');
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO participants (event_id, name, pin_hash, token, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(event.id, name, hashPin(pin), token, now());
  res.json({ token });
});

function participant(req, res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer /, '');
  const p = db.prepare(`
    SELECT p.*, e.name AS event_name, e.code AS event_code, e.is_open
    FROM participants p JOIN events e ON e.id = p.event_id WHERE p.token = ?`).get(token);
  if (!p) return fail(res, 401, 'Please join the event again');
  req.p = p;
  next();
}

function ownQuestion(req, res) {
  const q = db.prepare('SELECT * FROM questions WHERE id = ? AND event_id = ?')
    .get(req.params.id, req.p.event_id);
  if (!q) fail(res, 404, 'No such question');
  return q;
}

app.get('/api/me', participant, (req, res) => {
  const qs = db.prepare(`
    SELECT q.id, q.title, q.time_limit_ms, a.started_at, a.solved_at
    FROM questions q
    LEFT JOIN attempts a ON a.question_id = q.id AND a.participant_id = ?
    WHERE q.event_id = ? ORDER BY q.position, q.id`).all(req.p.id, req.p.event_id);
  res.json({
    name: req.p.name, event: { name: req.p.event_name, code: req.p.event_code, is_open: !!req.p.is_open },
    server_time: now(), questions: qs,
  });
});

app.get('/api/questions/:id', participant, (req, res) => {
  const q = ownQuestion(req, res);
  if (!q) return;
  const a = db.prepare('SELECT * FROM attempts WHERE participant_id = ? AND question_id = ?')
    .get(req.p.id, q.id);
  const base = { id: q.id, title: q.title, time_limit_ms: q.time_limit_ms, server_time: now() };
  // The statement stays hidden until the participant presses Start.
  if (!a) return res.json({ ...base, started_at: null });
  const samples = db.prepare(
    'SELECT input, expected_output FROM test_cases WHERE question_id = ? AND is_sample = 1 ORDER BY id').all(q.id);
  const last = db.prepare(`SELECT language, code FROM submissions
    WHERE participant_id = ? AND question_id = ? ORDER BY id DESC LIMIT 1`).get(req.p.id, q.id);
  const history = db.prepare(`SELECT id, language, verdict, created_at FROM submissions
    WHERE participant_id = ? AND question_id = ? ORDER BY id DESC`).all(req.p.id, q.id);
  res.json({
    ...base, statement: q.statement, samples, started_at: a.started_at, solved_at: a.solved_at,
    last_submission: last || null, history,
  });
});

app.post('/api/questions/:id/start', participant, (req, res) => {
  if (!req.p.is_open) return fail(res, 403, 'The event is closed');
  const q = ownQuestion(req, res);
  if (!q) return;
  db.prepare('INSERT OR IGNORE INTO attempts (participant_id, question_id, started_at) VALUES (?, ?, ?)')
    .run(req.p.id, q.id, now());
  res.json({ ok: true });
});

// One judge run per participant at a time.
const busy = new Set();
function startedAttempt(req, res, q) {
  const a = db.prepare('SELECT * FROM attempts WHERE participant_id = ? AND question_id = ?')
    .get(req.p.id, q.id);
  if (!a) fail(res, 400, 'Press Start first');
  return a;
}
function readCode(req, res) {
  const { language } = req.body;
  const code = String(req.body.code || '');
  if (!judge.LANGUAGES.includes(language)) return fail(res, 400, 'Unknown language');
  if (!code.trim()) return fail(res, 400, 'Code is empty');
  if (code.length > 100000) return fail(res, 400, 'Code is too long');
  if (busy.has(req.p.id)) return fail(res, 429, 'Your previous run is still going');
  return { language, code };
}

// "Run": runs the code on custom input. Nothing is saved and nothing is graded.
app.post('/api/questions/:id/run', participant, wrap(async (req, res) => {
  const q = ownQuestion(req, res);
  if (!q || !startedAttempt(req, res, q)) return;
  const c = readCode(req, res);
  if (!c) return;
  busy.add(req.p.id);
  try {
    const result = await judge.run({
      ...c, inputs: [String(req.body.input ?? '')], timeLimitMs: q.time_limit_ms,
    });
    res.json(result);
  } finally {
    busy.delete(req.p.id);
  }
}));

function grade(result, tests) {
  if (!result.compile.ok) {
    return { verdict: 'Compilation Error', compile_output: result.compile.output, tests: [] };
  }
  let verdict = 'Accepted';
  const rows = result.tests.map((r, i) => {
    let v = 'Passed';
    if (r.status === 'tle') v = 'Time Limit Exceeded';
    else if (r.status === 'rte') v = 'Runtime Error';
    else if (!judge.sameOutput(r.stdout, tests[i].expected_output)) v = 'Wrong Answer';
    if (v !== 'Passed' && verdict === 'Accepted') verdict = v;
    const row = { verdict: v, time_ms: r.time_ms, sample: !!tests[i].is_sample };
    // Show details for sample tests only. Hidden tests stay hidden.
    if (tests[i].is_sample) {
      Object.assign(row, { input: tests[i].input, expected: tests[i].expected_output,
        got: r.stdout, stderr: r.stderr });
    } else if (v === 'Runtime Error') {
      row.stderr = r.stderr;
    }
    return row;
  });
  return { verdict, tests: rows };
}

// "Submit": runs the code on every test case. If all pass, the question is solved.
app.post('/api/questions/:id/submit', participant, wrap(async (req, res) => {
  if (!req.p.is_open) return fail(res, 403, 'The event is closed');
  const q = ownQuestion(req, res);
  if (!q) return;
  const a = startedAttempt(req, res, q);
  if (!a) return;
  if (a.solved_at) return fail(res, 400, 'You already solved this question');
  const c = readCode(req, res);
  if (!c) return;
  busy.add(req.p.id);
  try {
    const tests = db.prepare('SELECT * FROM test_cases WHERE question_id = ? ORDER BY id').all(q.id);
    const submittedAt = now();
    const result = await judge.run({ ...c, inputs: tests.map((t) => t.input), timeLimitMs: q.time_limit_ms });
    const graded = grade(result, tests);
    db.prepare(`INSERT INTO submissions (participant_id, question_id, language, code, verdict, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(req.p.id, q.id, c.language, c.code, graded.verdict, submittedAt);
    if (graded.verdict === 'Accepted') {
      // Time counts until the moment the code was submitted, not until judging ended.
      db.prepare('UPDATE attempts SET solved_at = ? WHERE participant_id = ? AND question_id = ? AND solved_at IS NULL')
        .run(submittedAt, req.p.id, q.id);
      graded.solve_ms = submittedAt - a.started_at;
    }
    res.json(graded);
  } finally {
    busy.delete(req.p.id);
  }
}));

// ---------- leaderboard (public) ----------
// Rank: more questions solved first. Ties: less total solve time first.
// Solve time for one question = solved_at - started_at (from pressing Start to the accepted submit).
app.get('/api/leaderboard/:code', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE code = ?').get(String(req.params.code).toUpperCase());
  if (!event) return fail(res, 404, 'No event with that code');
  const questions = db.prepare('SELECT id, title FROM questions WHERE event_id = ? ORDER BY position, id')
    .all(event.id);
  const rows = db.prepare(`
    SELECT p.id, p.name, a.question_id, a.started_at, a.solved_at,
      (SELECT COUNT(*) FROM submissions s WHERE s.participant_id = p.id AND s.question_id = a.question_id
         AND s.verdict != 'Accepted') AS wrong
    FROM participants p
    LEFT JOIN attempts a ON a.participant_id = p.id
    WHERE p.event_id = ?`).all(event.id);

  const people = new Map();
  for (const r of rows) {
    if (!people.has(r.id)) people.set(r.id, { name: r.name, solved: 0, total_ms: 0, last_solve: 0, cells: {} });
    const p = people.get(r.id);
    if (r.question_id == null) continue;
    const cell = { wrong: r.wrong, started: true };
    if (r.solved_at) {
      cell.ms = r.solved_at - r.started_at;
      p.solved++;
      p.total_ms += cell.ms;
      p.last_solve = Math.max(p.last_solve, r.solved_at);
    }
    p.cells[r.question_id] = cell;
  }
  const ranked = [...people.values()]
    .filter((p) => Object.keys(p.cells).length)
    .sort((a, b) => b.solved - a.solved || a.total_ms - b.total_ms || a.last_solve - b.last_solve);
  let rank = 0;
  ranked.forEach((p, i) => {
    const prev = ranked[i - 1];
    if (!prev || prev.solved !== p.solved || prev.total_ms !== p.total_ms) rank = i + 1;
    p.rank = rank;
    delete p.last_solve;
  });
  res.json({ event: { name: event.name, code: event.code, is_open: !!event.is_open }, questions, rows: ranked });
});

app.listen(PORT, async () => {
  console.log(`Contest Here on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
  if (!(await judge.imageExists())) {
    console.warn(`WARNING: docker image "${judge.IMAGE}" not found. Run: npm run build-runner`);
  }
});
