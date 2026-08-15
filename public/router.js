import { t, getLanguage, setLanguageAuthenticated, onLanguageChange } from '/lib/i18n.js';

const state = {
  accountId: null,
  accounts: [],
  listeners: new Set(),
};

export async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    location.href = '/login.html';
    throw new Error('Nicht angemeldet');
  }
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
  { id: 'overview', icon: '▦', labelKey: 'nav.overview' },
  { id: 'accounts', icon: '🗂', labelKey: 'nav.accounts' },
  { id: 'analytics-compare', icon: '🧬', labelKey: 'nav.analyticsCompare' },
  { id: 'settings', icon: '⚙', labelKey: 'nav.settings' },
  { id: 'marketplace', icon: '🌐', labelKey: 'nav.marketplace' },
  { id: 'system-settings', icon: '🖥', labelKey: 'nav.systemSettings' },
];

let currentUnmount = null;

function fmtLevel(acc) {
  return acc.stats ? t('router.level', { level: acc.stats.level }) : t('router.noData');
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
  label.textContent = current ? `${current.charName} (${current.server})` : (state.accounts.length ? t('router.selectAccount') : t('router.noAccounts'));

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

let lastStatus = null;

function renderStatus() {
  const status = lastStatus;
  if (!status) return;
  const chip = document.getElementById('engine-status');
  const globalStatus = document.getElementById('global-status');
  const versionEl = document.getElementById('footer-version');
  if (versionEl && status.version) versionEl.textContent = `Dashboard v${status.version}`;
  if (!chip || !globalStatus) return;
  if (status.botRunning) {
    chip.textContent = t('router.botRunning');
    chip.className = 'pill pill-on';
    globalStatus.textContent = t('router.botActiveStatus');
  } else {
    chip.textContent = t('router.botStopped');
    chip.className = 'pill pill-off';
    globalStatus.textContent = t('router.botInactiveStatus');
  }
  if (!status.dataDir) {
    globalStatus.textContent = t('router.noDataDir');
  }
}

async function loadStatus() {
  lastStatus = await fetchJSON('/api/status');
  renderStatus();
}

let lastCliStatus = null;

function renderCliUpdateStatus() {
  const status = lastCliStatus;
  const pill = document.getElementById('cli-version-pill');
  const btn = document.getElementById('engine-update-btn');
  if (!pill || !btn || !status) return;
  if (status.applying) {
    pill.textContent = t('router.installing');
    pill.className = 'pill pill-warn';
    btn.style.display = 'none';
  } else if (status.updateAvailable) {
    pill.textContent = 'Update Available';
    pill.className = 'pill pill-warn';
    btn.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Update';
  } else {
    pill.textContent = 'Up To Date';
    pill.className = 'pill pill-on';
    btn.style.display = 'none';
  }
}

async function loadCliUpdateStatus() {
  const pill = document.getElementById('cli-version-pill');
  const btn = document.getElementById('engine-update-btn');
  if (!pill || !btn) return;
  lastCliStatus = await fetchJSON('/api/cli-update/status');
  renderCliUpdateStatus();
}

let lastDashboardStatus = null;
let updatePopupDismissedVersion = null;

function renderDashboardUpdateStatus() {
  const status = lastDashboardStatus;
  const pill = document.getElementById('dashboard-version-pill');
  const btn = document.getElementById('dashboard-update-btn');
  if (!pill || !btn || !status) return;
  if (status.applying) {
    pill.textContent = t('router.installing');
    pill.className = 'pill pill-warn';
    btn.style.display = 'none';
  } else if (status.updateAvailable) {
    pill.textContent = status.remoteVersion ? t('router.updateTo', { version: status.remoteVersion }) : 'Update Available';
    pill.title = status.currentVersion ? t('router.currentVersionTitle', { version: status.currentVersion }) : '';
    pill.className = 'pill pill-warn';
    btn.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Update';
  } else {
    pill.textContent = status.currentVersion ? t('router.upToDateWithVersion', { version: status.currentVersion }) : 'Up To Date';
    pill.className = 'pill pill-on';
    btn.style.display = 'none';
  }
  renderUpdatePopup(status);
}

function renderUpdatePopup(status) {
  const existing = document.getElementById('update-popup');
  const shouldShow = status.updateAvailable && !status.applying && status.remoteVersion !== updatePopupDismissedVersion;

  if (!shouldShow) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return; // already showing for this version, don't rebuild on every 5s poll

  const popup = document.createElement('div');
  popup.className = 'update-popup';
  popup.id = 'update-popup';
  popup.innerHTML = `
    <button class="update-popup-close" aria-label="${t('router.updatePopupDismiss')}">×</button>
    <div class="update-popup-title">${t('router.updatePopupTitle')}</div>
    <div class="update-popup-body">${t('router.updatePopupBody', { version: status.remoteVersion || '?', current: status.currentVersion || '?' })}</div>
    <button class="btn btn-primary update-popup-btn">${t('router.updatePopupUpdateBtn')}</button>
  `;
  popup.querySelector('.update-popup-close').addEventListener('click', () => {
    updatePopupDismissedVersion = status.remoteVersion;
    popup.remove();
  });
  popup.querySelector('.update-popup-btn').addEventListener('click', () => {
    document.getElementById('dashboard-update-btn')?.click();
    popup.remove();
  });
  document.body.appendChild(popup);
}

async function loadDashboardUpdateStatus() {
  const pill = document.getElementById('dashboard-version-pill');
  const btn = document.getElementById('dashboard-update-btn');
  if (!pill || !btn) return;
  lastDashboardStatus = await fetchJSON('/api/dashboard-update/status');
  renderDashboardUpdateStatus();
}

// Nach dem Anstoßen startet sich der Dashboard-Prozess selbst neu — die Seite pollt kurz, bis
// der Server wieder antwortet, und lädt dann automatisch neu statt den Nutzer hängen zu lassen.
async function waitForServerAndReload() {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok || res.status === 401) { location.reload(); return; }
    } catch (e) { /* Server noch nicht wieder erreichbar, weiter warten */ }
  }
  location.reload();
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
    root.innerHTML = `<div class="card"><p>${t('router.pageLoadError', { page: pageMeta.id, message: err.message })}</p></div>`;
  }
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = PAGES.map(p =>
    `<a class="nav-item" data-page="${p.id}" href="#/${p.id}"><span>${p.icon}</span> ${t(p.labelKey)}</a>`
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
    list.innerHTML = `<div class="notif-panel-empty">${t('router.notifEmpty')}</div>`;
    return;
  }
  list.innerHTML = allNotifications.map(n => `
    <div class="notif-item level-${n.level}">
      ${n.source ? `<div class="notif-item-char char-name">${escapeHtml(n.source)}</div>` : ''}
      <div class="notif-item-meta-row">
        <span class="notif-item-level-badge">${levelIcon(n.level)} ${n.level === 'error' ? 'ERROR' : 'WARN'}</span>
        <span class="notif-item-time">${new Date(n.at).toLocaleTimeString('de-DE')}</span>
      </div>
      <div class="notif-item-message">${escapeHtml(n.message)}</div>
    </div>`).join('');
}

function showToast(n) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const div = document.createElement('div');
  div.className = 'toast level-' + n.level;
  div.innerHTML = `
    ${n.source ? `<div class="notif-item-char char-name">${escapeHtml(n.source)}</div>` : ''}
    <div class="notif-item-message">${levelIcon(n.level)} ${escapeHtml(n.message)}</div>`;
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

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  const apply = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    btn.textContent = theme === 'light' ? '🌙' : '☀';
    btn.title = theme === 'light' ? t('router.enableDarkMode') : t('router.enableLightMode');
  };
  apply(document.documentElement.getAttribute('data-theme') || 'dark');
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    localStorage.setItem('mercy-theme', next);
    apply(next);
    window.dispatchEvent(new CustomEvent('mercy-theme-change', { detail: { theme: next } }));
  });
}

function initAccessMenu() {
  const btn = document.getElementById('access-btn');
  const panel = document.getElementById('access-panel');
  const dropdown = document.getElementById('access-dropdown');
  const form = document.getElementById('change-password-form');
  const logoutBtn = document.getElementById('logout-btn');
  if (!btn || !panel) return;
  btn.onclick = (ev) => {
    ev.stopPropagation();
    panel.hidden = !panel.hidden;
  };
  document.addEventListener('click', (ev) => {
    if (dropdown && !dropdown.contains(ev.target)) panel.hidden = true;
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const currentPassword = document.getElementById('cp-current').value;
    const newPassword = document.getElementById('cp-new').value;
    const errorEl = document.getElementById('cp-error');
    const successEl = document.getElementById('cp-success');
    errorEl.hidden = true;
    successEl.hidden = true;
    try {
      await fetchJSON('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      successEl.hidden = false;
      form.reset();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
  logoutBtn.addEventListener('click', async () => {
    await fetchJSON('/api/auth/logout', { method: 'POST' });
    location.href = '/login.html';
  });
}

function initLangToggle() {
  const btn = document.getElementById('lang-toggle-btn');
  if (!btn) return;
  const apply = (lang) => { btn.textContent = lang === 'de' ? 'EN' : 'DE'; };
  apply(getLanguage());
  btn.addEventListener('click', async () => {
    const next = getLanguage() === 'de' ? 'en' : 'de';
    try {
      await setLanguageAuthenticated(next, fetchJSON);
    } catch (err) {
      console.error('Failed to persist language choice', err);
    }
  });
}

onLanguageChange((lang) => {
  const btn = document.getElementById('lang-toggle-btn');
  if (btn) btn.textContent = lang === 'de' ? 'EN' : 'DE';
  renderNav();
  renderSidebarAccounts();
  renderTopbarAccountSelect();
  renderStatus();
  renderCliUpdateStatus();
  renderDashboardUpdateStatus();
  renderNotifPanel();
  renderRoute();
});

function initMobileNav() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (!sidebar || !backdrop || !toggleBtn) return;

  function open() {
    sidebar.classList.add('open');
    backdrop.classList.add('visible');
  }
  function close() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('visible');
  }
  toggleBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    sidebar.classList.contains('open') ? close() : open();
  });
  backdrop.addEventListener('click', close);
  sidebar.addEventListener('click', (ev) => {
    if (ev.target.closest('.nav-item') || ev.target.closest('.account-item')) close();
  });
  window.addEventListener('hashchange', close);
}

window.addEventListener('hashchange', renderRoute);

document.getElementById('refresh-btn')?.addEventListener('click', () => {
  loadStatus();
  loadAccounts().then(renderRoute);
});

document.getElementById('engine-update-btn')?.addEventListener('click', async () => {
  if (!confirm(t('router.confirmCliUpdate'))) return;
  const btn = document.getElementById('engine-update-btn');
  btn.disabled = true;
  btn.textContent = t('router.installing');
  try {
    await fetchJSON('/api/cli-update/apply', { method: 'POST' });
    await loadCliUpdateStatus();
  } catch (err) {
    alert(t('router.updateFailed', { message: err.message }));
    btn.disabled = false;
    btn.textContent = 'Update';
  }
});

document.getElementById('dashboard-update-btn')?.addEventListener('click', async () => {
  if (!confirm(t('router.confirmDashboardUpdate'))) return;
  const btn = document.getElementById('dashboard-update-btn');
  btn.disabled = true;
  btn.textContent = t('router.installing');
  try {
    await fetchJSON('/api/dashboard-update/apply', { method: 'POST' });
    btn.textContent = t('router.restarting');
    waitForServerAndReload();
  } catch (err) {
    alert(t('router.updateFailed', { message: err.message }));
    btn.disabled = false;
    btn.textContent = 'Update';
  }
});

function wireForceCheckButton(btnId, endpoint, reload) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.classList.add('spinning');
    try {
      await fetchJSON(endpoint, { method: 'POST' });
      await reload();
    } catch (err) {
      alert(t('router.checkFailed', { message: err.message }));
    } finally {
      btn.disabled = false;
      btn.classList.remove('spinning');
    }
  });
}

wireForceCheckButton('cli-force-check-btn', '/api/cli-update/check', loadCliUpdateStatus);
wireForceCheckButton('dashboard-force-check-btn', '/api/dashboard-update/check', loadDashboardUpdateStatus);

initAnonMode();
initThemeToggle();
initLangToggle();
initNotifications();
initAccessMenu();
initMobileNav();
renderNav();
loadStatus();
loadCliUpdateStatus();
loadDashboardUpdateStatus();
loadAccounts().then(renderRoute);
setInterval(() => {
  loadStatus();
  loadCliUpdateStatus();
  loadDashboardUpdateStatus();
  loadAccounts();
}, 5000);
