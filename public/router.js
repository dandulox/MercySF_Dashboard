const state = {
  accountId: null,
  accounts: [],
  listeners: new Set(),
};

export async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try { const body = await res.json(); if (body.error) msg = body.error; } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
}

export function getAccountId() { return state.accountId; }

export function setAccountId(id) {
  state.accountId = id;
  state.listeners.forEach(cb => cb(id));
}

export function onAccountChange(cb) {
  state.listeners.add(cb);
  return () => state.listeners.delete(cb);
}

export function injectStyleOnce(id, css) {
  if (document.getElementById('style-' + id)) return;
  const style = document.createElement('style');
  style.id = 'style-' + id;
  style.textContent = css;
  document.head.appendChild(style);
}

const ctx = { fetchJSON, getAccountId, onAccountChange, injectStyleOnce };

const PAGES = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'accounts', label: 'Account-Verwaltung', icon: '🗂' },
  { id: 'analytics', label: 'Analysen', icon: '📈' },
  { id: 'settings', label: 'Einstellungen', icon: '⚙' },
  { id: 'console', label: 'Konsole', icon: '⌨' },
];

let currentUnmount = null;

function fmtLevel(acc) {
  return acc.stats ? `Level ${acc.stats.level}` : 'keine Daten';
}

function renderSidebarAccounts() {
  const wrap = document.getElementById('accounts-list-items');
  const countEl = document.getElementById('accounts-count');
  if (!wrap) return;
  countEl.textContent = state.accounts.length ? `(${state.accounts.length})` : '';
  wrap.innerHTML = '';
  state.accounts.forEach(acc => {
    const div = document.createElement('div');
    div.className = 'account-item' + (acc.id === state.accountId ? ' selected' : '');
    const dotClass = acc.currentActivity ? 'account-item-dot active' : 'account-item-dot';
    const sub = acc.currentActivity
      ? `${fmtLevel(acc)} · ${acc.currentActivity}`
      : fmtLevel(acc);
    div.innerHTML = `
      <div class="account-item-name-row">
        <span class="${dotClass}"></span>
        <span class="account-item-name char-name">${acc.charName}</span>
      </div>
      <div class="account-item-sub char-name">${sub}</div>`;
    div.onclick = () => setAccountId(acc.id);
    wrap.appendChild(div);
  });
}

function closeAccountDropdown() {
  const panel = document.getElementById('account-dropdown-panel');
  if (panel) panel.hidden = true;
}

function renderTopbarAccountSelect() {
  const label = document.getElementById('account-dropdown-label');
  const panel = document.getElementById('account-dropdown-panel');
  const btn = document.getElementById('account-dropdown-btn');
  if (!label || !panel || !btn) return;

  const current = state.accounts.find(a => a.id === state.accountId);
  label.textContent = current ? `${current.charName} (${current.server})` : (state.accounts.length ? 'Account wählen' : 'Keine Accounts');

  panel.innerHTML = '';
  state.accounts.forEach(acc => {
    const opt = document.createElement('div');
    opt.className = 'account-dropdown-option char-name' + (acc.id === state.accountId ? ' selected' : '');
    opt.textContent = `${acc.charName} (${acc.server})`;
    opt.onclick = () => {
      setAccountId(acc.id);
      closeAccountDropdown();
    };
    panel.appendChild(opt);
  });

  btn.onclick = (ev) => {
    ev.stopPropagation();
    panel.hidden = !panel.hidden;
  };
}

document.addEventListener('click', (ev) => {
  const dropdown = document.getElementById('account-dropdown');
  if (dropdown && !dropdown.contains(ev.target)) closeAccountDropdown();
});

async function loadStatus() {
  const status = await fetchJSON('/api/status');
  const chip = document.getElementById('engine-status');
  const globalStatus = document.getElementById('global-status');
  if (!chip || !globalStatus) return;
  if (status.botRunning) {
    chip.textContent = 'LÄUFT';
    chip.className = 'pill pill-on';
    globalStatus.textContent = 'Bot-Prozess aktiv';
  } else {
    chip.textContent = 'GESTOPPT';
    chip.className = 'pill pill-off';
    globalStatus.textContent = 'Kein Bot-Prozess erkannt';
  }
  if (!status.dataDir) {
    globalStatus.textContent = 'Kein Account-Datenverzeichnis gefunden — noch nicht eingeloggt';
  }
}

async function loadCliUpdateStatus() {
  const row = document.getElementById('engine-update-row');
  const btn = document.getElementById('engine-update-btn');
  if (!row || !btn) return;
  const status = await fetchJSON('/api/cli-update/status');
  if (status.applying) {
    row.style.display = '';
    btn.disabled = true;
    btn.textContent = 'Installiere…';
  } else if (status.updateAvailable) {
    row.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Installieren';
  } else {
    row.style.display = 'none';
  }
}

async function loadAccounts() {
  const accounts = await fetchJSON('/api/accounts');
  state.accounts = accounts;
  if (!state.accountId && accounts.length) {
    state.accountId = accounts[0].id;
  }
  renderSidebarAccounts();
  renderTopbarAccountSelect();
  return accounts;
}

async function renderRoute() {
  const hash = location.hash.replace(/^#\/?/, '') || 'overview';
  const pageMeta = PAGES.find(p => p.id === hash) || PAGES[0];

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageMeta.id);
  });

  const root = document.getElementById('page-root');
  if (typeof currentUnmount === 'function') {
    try { currentUnmount(); } catch (e) { console.error(e); }
    currentUnmount = null;
  }
  root.innerHTML = '';

  try {
    const mod = await import(`/pages/${pageMeta.id}.js`);
    const page = mod.default;
    const result = page.mount(root, ctx);
    if (typeof result === 'function') currentUnmount = result;
  } catch (err) {
    root.innerHTML = `<div class="card"><p>Fehler beim Laden der Seite "${pageMeta.id}": ${err.message}</p></div>`;
  }
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = PAGES.map(p =>
    `<a class="nav-item" data-page="${p.id}" href="#/${p.id}"><span>${p.icon}</span> ${p.label}</a>`
  ).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function levelIcon(level) { return level === 'error' ? '🛑' : '⚠️'; }

let notifLastSeenId = parseInt(localStorage.getItem('mercy-notif-last-seen') || '0', 10);
let notifLastPolledId = notifLastSeenId;
let notifFirstPoll = true;
let allNotifications = [];

function renderNotifPanel() {
  const list = document.getElementById('notif-panel-list');
  const badge = document.getElementById('notif-badge');
  if (!list || !badge) return;
  const unread = allNotifications.filter(n => n.id > notifLastSeenId).length;
  badge.hidden = unread === 0;
  badge.textContent = unread > 99 ? '99+' : String(unread);
  if (!allNotifications.length) {
    list.innerHTML = '<div class="notif-panel-empty">Keine Fehler oder Warnungen bisher.</div>';
    return;
  }
  list.innerHTML = allNotifications.map(n => `
    <div class="notif-item level-${n.level}">
      <span class="notif-item-icon">${levelIcon(n.level)}</span>
      <div class="notif-item-body">
        <div class="notif-item-message">${escapeHtml(n.message)}</div>
        <div class="notif-item-meta">${new Date(n.at).toLocaleTimeString('de-DE')}${n.source ? ' · ' + escapeHtml(n.source) : ''}</div>
      </div>
    </div>`).join('');
}

function showToast(n) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const div = document.createElement('div');
  div.className = 'toast level-' + n.level;
  div.innerHTML = `<div class="notif-item-message">${levelIcon(n.level)} ${escapeHtml(n.message)}</div>`;
  stack.appendChild(div);
  setTimeout(() => div.remove(), 8000);
}

async function pollNotifications() {
  try {
    const fresh = await fetchJSON('/api/notifications');
    if (notifFirstPoll) {
      notifFirstPoll = false;
      if (fresh.length) notifLastPolledId = Math.max(...fresh.map(n => n.id));
    } else {
      const newest = fresh.filter(n => n.id > notifLastPolledId);
      newest.slice().reverse().forEach(showToast);
      if (fresh.length) notifLastPolledId = Math.max(...fresh.map(n => n.id));
    }
    allNotifications = fresh;
    renderNotifPanel();
  } catch (e) { /* still-starting dashboard, ignore */ }
}

function initNotifications() {
  const btn = document.getElementById('notif-btn');
  const panel = document.getElementById('notif-panel');
  const clearBtn = document.getElementById('notif-clear-btn');
  const dropdown = document.getElementById('notif-dropdown');
  if (!btn || !panel) return;
  btn.onclick = (ev) => {
    ev.stopPropagation();
    panel.hidden = !panel.hidden;
  };
  clearBtn.onclick = () => {
    notifLastSeenId = notifLastPolledId;
    localStorage.setItem('mercy-notif-last-seen', String(notifLastSeenId));
    renderNotifPanel();
  };
  document.addEventListener('click', (ev) => {
    if (dropdown && !dropdown.contains(ev.target)) panel.hidden = true;
  });
  pollNotifications();
  setInterval(pollNotifications, 5000);
}

function initAnonMode() {
  const input = document.getElementById('anon-toggle-input');
  if (!input) return;
  const stored = localStorage.getItem('mercy-anon-mode') === '1';
  input.checked = stored;
  document.body.classList.toggle('anon-mode', stored);
  input.addEventListener('change', () => {
    document.body.classList.toggle('anon-mode', input.checked);
    localStorage.setItem('mercy-anon-mode', input.checked ? '1' : '0');
  });
}

window.addEventListener('hashchange', renderRoute);

document.getElementById('refresh-btn')?.addEventListener('click', () => {
  loadStatus();
  loadAccounts().then(renderRoute);
});

document.getElementById('engine-update-btn')?.addEventListener('click', async () => {
  if (!confirm('CLI aktualisieren? Laufende Konsolen-Sessions werden neu gestartet, aktive Logins gehen dabei verloren.')) return;
  const btn = document.getElementById('engine-update-btn');
  btn.disabled = true;
  btn.textContent = 'Installiere…';
  try {
    await fetchJSON('/api/cli-update/apply', { method: 'POST' });
    await loadCliUpdateStatus();
  } catch (err) {
    alert('Update fehlgeschlagen: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Installieren';
  }
});

initAnonMode();
initNotifications();
renderNav();
loadStatus();
loadCliUpdateStatus();
loadAccounts().then(renderRoute);
setInterval(() => {
  loadStatus();
  loadCliUpdateStatus();
  loadAccounts();
}, 5000);
