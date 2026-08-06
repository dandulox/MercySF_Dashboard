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
  if (status.hasAccess) {
    location.href = '/login.html';
    return;
  }
  document.getElementById('setup-form').addEventListener('submit', onSubmit);
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
  const phraseText = recoveryPhrase.join(' ');
  card.innerHTML = `
    <h1>⚔ Zugang angelegt</h1>
    <p class="muted">Speichere beide Schlüssel jetzt an einem sicheren Ort (z. B. Passwort-Manager). Sie werden nach dem Verlassen dieser Seite nicht mehr angezeigt.</p>
    <div class="secret-block">
      <h3>AES-Schlüssel (verschlüsselt deine gespeicherten Bot-Zugangsdaten)</h3>
      <div id="aes-key">${escapeHtml(aesKey)}</div>
    </div>
    <div class="secret-block">
      <h3>12-Wort-Wiederherstellungsschlüssel (für Passwort-Reset)</h3>
      <div id="recovery-phrase">${escapeHtml(phraseText)}</div>
    </div>
    <div class="confirm-row">
      <input type="checkbox" id="confirm-saved" />
      <label for="confirm-saved">Ich habe beide Schlüssel sicher gespeichert.</label>
    </div>
    <button type="button" class="btn btn-primary" id="continue-btn" disabled style="margin-top:16px;width:100%;">Weiter zum Dashboard</button>
  `;
  document.getElementById('confirm-saved').addEventListener('change', (ev) => {
    document.getElementById('continue-btn').disabled = !ev.target.checked;
  });
  document.getElementById('continue-btn').addEventListener('click', () => {
    location.href = '/';
  });
}

init();
