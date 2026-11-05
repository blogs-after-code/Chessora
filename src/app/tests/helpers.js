// Shared test helpers: start the app on a random port with a throwaway database file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { openDb } from '../server/db.js';
import { migrate } from '../server/migrate.js';

export async function startTestApp(options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chessora-test-'));
  const db = await openDb(`file:${path.join(dir, 'test.db')}`);
  await migrate(db);
  const server = createApp({ db, bcryptRounds: 4, authLimit: 1000, ...options }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stop = async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  };
  return { db, base, stop };
}

/** JSON request helper; pass { cookie } to act as a logged-in user. */
export async function call(base, method, url, { body, cookie, headers = {} } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }
  return { res, status: res.status, data };
}

/** Extract "chessora_sid=..." from a response, or null. */
export function sessionCookie(res) {
  const header = res.headers.getSetCookie().find((c) => c.startsWith('chessora_sid='));
  return header ? header.split(';')[0] : null;
}

let userCounter = 0;
/** Create a fresh account; returns { cookie, user }. */
export async function registerUser(base) {
  userCounter += 1;
  const body = { email: `user${userCounter}@example.com`, username: `user_${userCounter}`, password: 'test-password-1' };
  const { res, data } = await call(base, 'POST', '/api/auth/signup', { body });
  return { cookie: sessionCookie(res), user: data.user };
}
