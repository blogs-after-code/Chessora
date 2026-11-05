// Small fetch helper for the Chessora JSON API.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* response was not JSON */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.fields = (data && data.fields) || {};
    err.failed = (data && data.failed) || [];
    throw err;
  }
  return data;
}

/** Returns the logged-in user, or null. */
export async function currentUser() {
  try {
    return (await api('/api/auth/me')).user;
  } catch {
    return null;
  }
}
