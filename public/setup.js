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
  if (status.hasAccess) {
    location.href = '/login.html';
    return;
  }
  document.getElementById('setup-form').addEventListener('submit', onSubmit);
  addPasswordToggles();
}

async function onSubmit(ev) {
  ev.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const password2 = document.getElementById('password2').value;
  const errorEl = document.getElementById('setup-error');
  errorEl.hidden = true;

  if (password !== password2) {
    errorEl.textContent = 'Passwörter stimmen nicht überein.';
    errorEl.hidden = false;
    return;
  }

  try {
    const result = await fetchJSON('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    showSecrets(result.aesKey, result.recoveryPhrase);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

function showSecrets(aesKey, recoveryPhrase) {
  const card = document.getElementById('card');
  const wordGridHtml = recoveryPhrase.map((w, i) =>
    `<div class="word-chip"><span class="word-index">${i + 1}</span>${escapeHtml(w)}</div>`
  ).join('');

  card.innerHTML = `
    <div class="auth-header">
      <div class="auth-icon">🔑</div>
      <div>
        <h1 class="auth-title">Zugang angelegt</h1>
        <p class="auth-subtitle">Speichere beide Schlüssel jetzt an einem sicheren Ort. Sie werden nach dem Verlassen dieser Seite nicht mehr angezeigt.</p>
      </div>
    </div>

    <div class="secret-block">
      <div class="secret-block-header">
        <h3>AES-Schlüssel (Bot-Zugangsdaten)</h3>
        <button type="button" class="copy-btn" data-copy-target="aes-key">Kopieren</button>
      </div>
      <div class="secret-value" id="aes-key">${escapeHtml(aesKey)}</div>
    </div>

    <div class="secret-block">
      <div class="secret-block-header">
        <h3>12-Wort-Wiederherstellungsschlüssel</h3>
        <button type="button" class="copy-btn" data-copy-target="recovery-phrase-plain">Kopieren</button>
      </div>
      <div class="word-grid">${wordGridHtml}</div>
      <div id="recovery-phrase-plain" style="display:none;">${escapeHtml(recoveryPhrase.join(' '))}</div>
    </div>

    <div class="warning-banner no-print">
      <span class="icon">⚠️</span>
      <span>Beide Schlüssel lassen sich danach nirgends erneut anzeigen. Der Recovery-Schlüssel setzt bei Verlust dein Passwort zurück — bewahre ihn wie ein echtes Passwort auf.</span>
    </div>

    <button type="button" class="btn-secondary no-print" id="print-btn">🖨 Drucken</button>

    <div class="confirm-row no-print">
      <input type="checkbox" id="confirm-saved" />
      <label for="confirm-saved">Ich habe beide Schlüssel sicher gespeichert.</label>
    </div>
    <button type="button" class="btn-primary-lg no-print" id="continue-btn" disabled style="margin-top:14px;">Weiter zum Dashboard</button>
  `;

  document.getElementById('print-btn').addEventListener('click', () => window.print());
  document.getElementById('confirm-saved').addEventListener('change', (ev) => {
    document.getElementById('continue-btn').disabled = !ev.target.checked;
  });
  document.getElementById('continue-btn').addEventListener('click', () => {
    location.href = '/';
  });
  initCopyButtons(card);
}

init();
