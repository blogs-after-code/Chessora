// Fills the <nav id="nav"> on every page. Uses textContent only (usernames are user input).
import { api, currentUser } from './api.js';

function link(text, href) {
  const a = document.createElement('a');
  a.textContent = text;
  a.href = href;
  return a;
}

export async function initNav() {
  const nav = document.getElementById('nav');
  const user = await currentUser();
  if (nav) {
    nav.replaceChildren();
    if (user) {
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = `@${user.username}`;
      const out = document.createElement('button');
      out.type = 'button';
      out.className = 'linklike';
      out.textContent = 'Log out';
      out.addEventListener('click', async () => {
        try {
          await api('/api/auth/logout', { method: 'POST', body: {} });
        } finally {
          window.location.href = '/';
        }
      });
      nav.append(link('Dashboard', '/dashboard.html'), who, out);
    } else {
      nav.append(link('Log in', '/login.html'), link('Sign up', '/signup.html'));
    }
  }
  return user;
}
