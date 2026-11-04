import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, call, sessionCookie } from './helpers.js';

let ctx;
before(async () => { ctx = await startTestApp(); });
after(() => ctx.stop());

const user = { email: 'Ana@Example.com', username: 'AnaChess', password: 'correct horse' };

async function signup(overrides = {}) {
  return call(ctx.base, 'POST', '/api/auth/signup', { body: { ...user, ...overrides } });
}

test('signup creates an account, logs in, and never returns the password', async () => {
  const { res, status, data } = await signup();
  assert.equal(status, 201);
  assert.equal(data.user.email, 'ana@example.com'); // lower-cased
  assert.equal(data.user.username, 'AnaChess');
  assert.equal(JSON.stringify(data).includes('password'), false);
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('chessora_sid='));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
});

test('password is stored as a bcrypt hash, never plain text', async () => {
  const rs = await ctx.db.execute({ sql: 'SELECT password_hash FROM users WHERE email = ?', args: ['ana@example.com'] });
  const hash = String(rs.rows[0].password_hash);
  assert.match(hash, /^\$2[aby]\$/);
  assert.notEqual(hash, user.password);
});

test('duplicate email or username (any letter case) is rejected with 409', async () => {
  assert.equal((await signup()).status, 409);
  assert.equal((await signup({ email: 'other@example.com', username: 'anachess' })).status, 409);
});

test('invalid signup input gives 400 with field messages', async () => {
  const bad = await signup({ email: 'nope', username: 'a', password: 'short' });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.fields.email && bad.data.fields.username && bad.data.fields.password);
  const empty = await call(ctx.base, 'POST', '/api/auth/signup', { body: {} });
  assert.equal(empty.status, 400);
});

test('me requires a valid session', async () => {
  assert.equal((await call(ctx.base, 'GET', '/api/auth/me')).status, 401);
  const login = await call(ctx.base, 'POST', '/api/auth/login', { body: { email: 'ana@example.com', password: user.password } });
  assert.equal(login.status, 200);
  const cookie = sessionCookie(login.res);
  assert.ok(cookie);
  const me = await call(ctx.base, 'GET', '/api/auth/me', { cookie });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.username, 'AnaChess');
  assert.equal((await call(ctx.base, 'GET', '/api/auth/me', { cookie: 'chessora_sid=garbage' })).status, 401);
});

test('wrong password and unknown email give the same generic 401', async () => {
  const wrong = await call(ctx.base, 'POST', '/api/auth/login', { body: { email: 'ana@example.com', password: 'wrong password' } });
  const unknown = await call(ctx.base, 'POST', '/api/auth/login', { body: { email: 'ghost@example.com', password: 'whatever123' } });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(wrong.data, unknown.data);
});

test('session ids are stored hashed, not as the cookie value', async () => {
  const login = await call(ctx.base, 'POST', '/api/auth/login', { body: { email: 'ana@example.com', password: user.password } });
  const token = sessionCookie(login.res).split('=')[1];
  const rs = await ctx.db.execute({ sql: 'SELECT COUNT(*) AS n FROM sessions WHERE id = ?', args: [token] });
  assert.equal(Number(rs.rows[0].n), 0);
});

test('logout ends the session', async () => {
  const login = await call(ctx.base, 'POST', '/api/auth/login', { body: { email: 'ana@example.com', password: user.password } });
  const cookie = sessionCookie(login.res);
  const out = await call(ctx.base, 'POST', '/api/auth/logout', { cookie });
  assert.equal(out.status, 200);
  assert.equal((await call(ctx.base, 'GET', '/api/auth/me', { cookie })).status, 401);
});

test('expired sessions are rejected', async () => {
  const login = await call(ctx.base, 'POST', '/api/auth/login', { body: { email: 'ana@example.com', password: user.password } });
  const cookie = sessionCookie(login.res);
  await ctx.db.execute('UPDATE sessions SET expires_at = 1');
  assert.equal((await call(ctx.base, 'GET', '/api/auth/me', { cookie })).status, 401);
});

test('requests from another website are blocked (CSRF guard)', async () => {
  const r = await call(ctx.base, 'POST', '/api/auth/login', {
    body: { email: 'ana@example.com', password: user.password },
    headers: { Origin: 'https://evil.example' },
  });
  assert.equal(r.status, 403);
  // same-origin requests still work
  const ok = await call(ctx.base, 'POST', '/api/auth/login', {
    body: { email: 'ana@example.com', password: user.password },
    headers: { Origin: ctx.base },
  });
  assert.equal(ok.status, 200);
});

test('login is rate limited', async () => {
  const limited = await startTestApp({ authLimit: 3 });
  try {
    const attempt = () => call(limited.base, 'POST', '/api/auth/login', { body: { email: 'x@example.com', password: 'whatever123' } });
    for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
    assert.equal((await attempt()).status, 429);
  } finally {
    await limited.stop();
  }
});
