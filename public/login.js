async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try { const body = await res.json(); if (body.error) msg = body.error; } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function init() {
  const status = await fetchJSON('/api/auth/status');
  if (!status.hasAccess) {
    location.href = '/setup.html';
    return;
  }
  document.getElementById('login-form').addEventListener('submit', onLogin);
  document.getElementById('forgot-btn').addEventListener('click', showResetForm);
  document.getElementById('back-to-login-btn').addEventListener('click', showLoginForm);
  document.getElementById('reset-form').addEventListener('submit', onReset);
  buildWordGrid();
}

function buildWordGrid() {
  const grid = document.getElementById('word-grid');
  grid.innerHTML = '';
  for (let i = 1; i <= 12; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = String(i);
    input.autocomplete = 'off';
    grid.appendChild(input);
  }
}

function showResetForm() {
  document.getElementById('login-form').hidden = true;
  document.getElementById('forgot-btn').hidden = true;
  document.getElementById('reset-form').hidden = false;
}

function showLoginForm() {
  document.getElementById('reset-form').hidden = true;
  document.getElementById('login-form').hidden = false;
  document.getElementById('forgot-btn').hidden = false;
}

async function onLogin(ev) {
  ev.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.hidden = true;
  try {
    await fetchJSON('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    location.href = '/';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

async function onReset(ev) {
  ev.preventDefault();
  const inputs = [...document.querySelectorAll('#word-grid input')];
  const recoveryPhrase = inputs.map(i => i.value.trim().toLowerCase());
  const newPassword = document.getElementById('new-password').value;
  const newPassword2 = document.getElementById('new-password2').value;
  const errorEl = document.getElementById('reset-error');
  errorEl.hidden = true;

  if (recoveryPhrase.some(w => !w)) {
    errorEl.textContent = 'Bitte alle 12 Wörter ausfüllen.';
    errorEl.hidden = false;
    return;
  }
  if (newPassword !== newPassword2) {
    errorEl.textContent = 'Passwörter stimmen nicht überein.';
    errorEl.hidden = false;
    return;
  }

  try {
    const result = await fetchJSON('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryPhrase, newPassword }),
    });
    showNewRecoveryPhrase(result.recoveryPhrase);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

function showNewRecoveryPhrase(recoveryPhrase) {
  const card = document.getElementById('card');
  const phraseText = recoveryPhrase.join(' ');
  card.innerHTML = `
    <h1>⚔ Passwort zurückgesetzt</h1>
    <p class="muted">Dein alter Wiederherstellungsschlüssel ist jetzt ungültig. Speichere den neuen Schlüssel an einem sicheren Ort — er wird nur jetzt angezeigt.</p>
    <div class="secret-block">
      <h3>Neuer 12-Wort-Wiederherstellungsschlüssel</h3>
      <div id="recovery-phrase">${escapeHtml(phraseText)}</div>
    </div>
    <div class="confirm-row">
      <input type="checkbox" id="confirm-saved" />
      <label for="confirm-saved">Ich habe den neuen Schlüssel sicher gespeichert.</label>
    </div>
    <button type="button" class="btn btn-primary" id="continue-btn" disabled style="margin-top:16px;width:100%;">Weiter zum Login</button>
  `;
  document.getElementById('confirm-saved').addEventListener('change', (ev) => {
    document.getElementById('continue-btn').disabled = !ev.target.checked;
  });
  document.getElementById('continue-btn').addEventListener('click', () => {
    location.href = '/login.html';
  });
}

init();
