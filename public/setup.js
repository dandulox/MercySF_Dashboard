import { t, initI18nLocal, setLanguageLocal, getLanguage, onLanguageChange } from '/lib/i18n.js';

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
    btn.setAttribute('aria-label', t('common.showPassword'));
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
        btn.textContent = t('common.copied');
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1800);
      } catch (e) {
        btn.textContent = t('common.copyError');
      }
    });
  });
}

function initLangToggle() {
  const btn = document.getElementById('lang-toggle-btn');
  if (!btn) return;
  const apply = (lang) => { btn.textContent = lang === 'de' ? 'EN' : 'DE'; };
  apply(getLanguage());
  onLanguageChange(apply);
  btn.addEventListener('click', () => {
    setLanguageLocal(getLanguage() === 'de' ? 'en' : 'de');
  });
}

async function init() {
  initI18nLocal();
  initLangToggle();
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
    errorEl.textContent = t('common.passwordMismatch');
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
        <h1 class="auth-title">${t('setup.doneTitle')}</h1>
        <p class="auth-subtitle">${t('setup.doneSubtitle')}</p>
      </div>
    </div>

    <div class="secret-block">
      <div class="secret-block-header">
        <h3>${t('setup.aesKeyTitle')}</h3>
        <button type="button" class="copy-btn" data-copy-target="aes-key">${t('common.copyBtn')}</button>
      </div>
      <div class="secret-value" id="aes-key">${escapeHtml(aesKey)}</div>
    </div>

    <div class="secret-block">
      <div class="secret-block-header">
        <h3>${t('setup.recoveryTitle')}</h3>
        <button type="button" class="copy-btn" data-copy-target="recovery-phrase-plain">${t('common.copyBtn')}</button>
      </div>
      <div class="word-grid">${wordGridHtml}</div>
      <div id="recovery-phrase-plain" style="display:none;">${escapeHtml(recoveryPhrase.join(' '))}</div>
    </div>

    <div class="warning-banner no-print">
      <span class="icon">⚠️</span>
      <span>${t('setup.warning')}</span>
    </div>

    <button type="button" class="btn-secondary no-print" id="print-btn">${t('setup.printBtn')}</button>

    <div class="confirm-row no-print">
      <input type="checkbox" id="confirm-saved" />
      <label for="confirm-saved">${t('setup.confirmSaved')}</label>
    </div>
    <button type="button" class="btn-primary-lg no-print" id="continue-btn" disabled style="margin-top:14px;">${t('setup.continueToDashboard')}</button>
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
