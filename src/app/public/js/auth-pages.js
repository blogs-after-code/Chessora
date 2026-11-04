// Handles the sign-up and log-in forms (form[data-mode] is "signup" or "login").
import { api } from './api.js';
import { initNav } from './nav.js';

const form = document.querySelector('form[data-mode]');
const formError = document.getElementById('form-error');
const submit = form.querySelector('button[type="submit"]');

function showErrors(message, fields = {}) {
  formError.textContent = message || '';
  for (const el of form.querySelectorAll('[data-error-for]')) {
    el.textContent = fields[el.dataset.errorFor] || '';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showErrors('');
  submit.disabled = true;
  const body = Object.fromEntries(new FormData(form));
  try {
    await api(`/api/auth/${form.dataset.mode}`, { method: 'POST', body });
    window.location.href = '/dashboard.html';
  } catch (err) {
    showErrors(Object.keys(err.fields).length ? 'Please fix the highlighted fields.' : err.message, err.fields);
    submit.disabled = false;
  }
});

// Already logged in? Go straight to the dashboard.
initNav().then((user) => {
  if (user) window.location.href = '/dashboard.html';
});
