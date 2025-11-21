// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const pool = require('./db');
const migrate = require('./migrations');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Uploads folder (ensure exists)
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${unique}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Helper to require auth
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing token' });
  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const hashed = await bcrypt.hash(password, 10);
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed]);
    res.json({ id: result.insertId, username });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already exists' });
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  } finally {
    conn.release();
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM users WHERE username = ?', [username]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  } finally {
    conn.release();
  }
});

// Upload file (authenticated)
app.post('/api/upload', authMiddleware, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(
      'INSERT INTO files (user_id, filename, original_name, mime, size) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, file.filename, file.originalname, file.mimetype, file.size]
    );
    res.json({ id: result.insertId, filename: file.filename, original_name: file.originalname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  } finally {
    conn.release();
  }
});

// List files for user
app.get('/api/files', authMiddleware, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT id, filename, original_name, mime, size, created_at FROM files WHERE user_id = ?', [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  } finally {
    conn.release();
  }
});

// Download file (authenticated)
app.get('/api/files/:id', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT filename, original_name FROM files WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const file = rows[0];
    const filePath = path.join(UPLOAD_DIR, file.filename);
    res.download(filePath, file.original_name);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  } finally {
    conn.release();
  }
});

// Simple dashboard route that requires auth
app.get('/api/profile', authMiddleware, async (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Run migrations on start if configured
(async () => {
  try {
    if (process.env.INIT_DB === 'true') {
      console.log('Running migrations...');
      await migrate();
    }
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  } catch (err) {
    console.error('Startup error', err);
    process.exit(1);
  }
})();
