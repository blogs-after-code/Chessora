import { initNav } from './nav.js';

initNav().then((user) => {
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  document.getElementById('welcome').textContent = `Welcome, ${user.username}`;
  document.getElementById('email').textContent = user.email;
  document.getElementById('content').hidden = false;
});
