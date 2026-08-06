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

function addPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.toggled) return;
    input.dataset.toggled = '1';
    const wrap = document.createElement('div');
    wrap.className = 'password-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'password-toggle';
    btn.textContent = '👁';
    btn.setAttribute('aria-label', 'Passwort anzeigen');
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁';
    });
    wrap.appendChild(btn);
  });
}

function initCopyButtons(root = document) {
  root.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetEl = document.getElementById(btn.dataset.copyTarget);
      if (!targetEl) return;
      try {
        await navigator.clipboard.writeText(targetEl.textContent);
        const original = btn.textContent;
        btn.textContent = 'Kopiert ✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1800);
      } catch (e) {
        btn.textContent = 'Fehler';
      }
    });
  });
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
  addPasswordToggles();
}

function buildWordGrid() {
  const grid = document.getElementById('word-grid');
  grid.innerHTML = '';
  for (let i = 1; i <= 12; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'word-input-wrap';
    const badge = document.createElement('span');
    badge.className = 'word-index';
    badge.textContent = i;
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    wrap.appendChild(badge);
    wrap.appendChild(input);
    grid.appendChild(wrap);
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
  const wordGridHtml = recoveryPhrase.map((w, i) =>
    `<div class="word-chip"><span class="word-index">${i + 1}</span>${escapeHtml(w)}</div>`
  ).join('');

  card.innerHTML = `
    <div class="auth-header">
      <div class="auth-icon">🔑</div>
      <div>
        <h1 class="auth-title">Passwort zurückgesetzt</h1>
        <p class="auth-subtitle">Dein alter Wiederherstellungsschlüssel ist jetzt ungültig.</p>
      </div>
    </div>

    <div class="secret-block">
      <div class="secret-block-header">
        <h3>Neuer 12-Wort-Wiederherstellungsschlüssel</h3>
        <button type="button" class="copy-btn" data-copy-target="recovery-phrase-plain">Kopieren</button>
      </div>
      <div class="word-grid" style="grid-template-columns:repeat(3,1fr);">${wordGridHtml}</div>
      <div id="recovery-phrase-plain" style="display:none;">${escapeHtml(recoveryPhrase.join(' '))}</div>
    </div>

    <div class="warning-banner">
      <span class="icon">⚠️</span>
      <span>Speichere den neuen Schlüssel jetzt an einem sicheren Ort — er wird nur dieses eine Mal angezeigt.</span>
    </div>

    <div class="confirm-row">
      <input type="checkbox" id="confirm-saved" />
      <label for="confirm-saved">Ich habe den neuen Schlüssel sicher gespeichert.</label>
    </div>
    <button type="button" class="btn-primary-lg" id="continue-btn" disabled style="margin-top:14px;">Weiter zum Login</button>
  `;

  document.getElementById('confirm-saved').addEventListener('change', (ev) => {
    document.getElementById('continue-btn').disabled = !ev.target.checked;
  });
  document.getElementById('continue-btn').addEventListener('click', () => {
    location.href = '/login.html';
  });
  initCopyButtons(card);
}

init();
