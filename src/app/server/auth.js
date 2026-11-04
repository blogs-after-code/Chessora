// Accounts: signup, login, logout, current user. Sessions are random tokens in an
// httpOnly cookie; only a SHA-256 hash of the token is stored in the database.
import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

export const COOKIE_NAME = 'chessora_sid';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const signupSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase()
    .max(254, 'Email is too long').email('Enter a valid email address'),
  username: z.string({ required_error: 'Username is required' }).trim()
    .regex(/^[A-Za-z0-9_]{3,20}$/, 'Username must be 3-20 letters, numbers or underscores'),
  password: z.string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .refine((v) => Buffer.byteLength(v) <= 72, 'Password is too long (max 72 bytes)'),
});

const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().max(254),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(200),
});

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* ignore malformed cookie */
    }
  }
  return out;
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validationFailed(res, error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!fields[key]) fields[key] = issue.message;
  }
  return res.status(400).json({ error: 'Invalid input', fields });
}

/** Rejects state-changing requests that come from another website (basic CSRF defence). */
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    let host = null;
    try {
      host = new URL(origin).host;
    } catch {
      /* invalid origin */
    }
    if (host !== req.get('host')) return res.status(403).json({ error: 'Cross-site request blocked' });
  }
  return next();
}

export function createAuth({ db, bcryptRounds = 12, secureCookies = false, authLimit = 20 }) {
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/' };
  // Used so "unknown email" takes as long as "wrong password" (no user enumeration by timing).
  const dummyHash = bcrypt.hashSync('chessora-dummy-password', bcryptRounds);

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: authLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again in a few minutes.' },
  });

  async function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    await db.execute({ sql: 'DELETE FROM sessions WHERE expires_at < ?', args: [now] });
    await db.execute({
      sql: 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
      args: [hashToken(token), userId, now + SESSION_MS],
    });
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_MS });
  }

  /** Sets req.user when a valid session cookie is present. */
  const loadUser = asyncHandler(async (req, _res, next) => {
    req.user = null;
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (token) {
      const rs = await db.execute({
        sql: `SELECT u.id, u.email, u.username
                FROM sessions s JOIN users u ON u.id = s.user_id
               WHERE s.id = ? AND s.expires_at > ?`,
        args: [hashToken(token), Date.now()],
      });
      if (rs.rows.length) {
        const r = rs.rows[0];
        req.user = { id: Number(r.id), email: String(r.email), username: String(r.username) };
      }
    }
    next();
  });

  const requireAuth = (req, res, next) =>
    req.user ? next() : res.status(401).json({ error: 'Please log in' });

  const router = express.Router();

  router.post('/signup', limiter, asyncHandler(async (req, res) => {
    const parsed = signupSchema.safeParse(req.body ?? {});
    if (!parsed.success) return validationFailed(res, parsed.error);
    const { email, username, password } = parsed.data;

    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    let userId;
    try {
      const rs = await db.execute({
        sql: 'INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)',
        args: [email, username, passwordHash],
      });
      userId = Number(rs.lastInsertRowid);
    } catch (err) {
      if (/UNIQUE/i.test(String(err.message))) {
        return res.status(409).json({ error: 'That email or username is already in use' });
      }
      throw err;
    }
    await startSession(res, userId);
    return res.status(201).json({ user: { id: userId, email, username } });
  }));

  router.post('/login', limiter, asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) return validationFailed(res, parsed.error);
    const { email, password } = parsed.data;

    const rs = await db.execute({
      sql: 'SELECT id, email, username, password_hash FROM users WHERE email = ?',
      args: [email],
    });
    const row = rs.rows[0];
    const ok = await bcrypt.compare(password, row ? String(row.password_hash) : dummyHash);
    if (!row || !ok) return res.status(401).json({ error: 'Invalid email or password' });

    await startSession(res, Number(row.id));
    return res.json({ user: { id: Number(row.id), email: String(row.email), username: String(row.username) } });
  }));

  router.post('/logout', asyncHandler(async (req, res) => {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (token) await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [hashToken(token)] });
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.json({ ok: true });
  }));

  router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

  return { router, loadUser, requireAuth };
}
