import { connectTerminal } from '/lib/terminal.js';
import { t } from '/lib/i18n.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function serverFromUrl(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

function fmtUptime(startedAt) {
  if (!startedAt) return null;
  const secs = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export default {
  id: 'accounts',
  label: 'Account-Verwaltung',
  icon: '🗂',
  mount(container, ctx) {
    const css = `
      .accounts-page .add-card {
        background: linear-gradient(180deg, var(--panel), var(--panel-2));
        border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 14px;
        position: relative; overflow: hidden;
      }
      .accounts-page .add-card::before {
        content: ''; position: absolute; top: -60px; left: -60px; width: 160px; height: 160px;
        background: radial-gradient(circle, rgba(79,140,255,0.18), transparent 70%); pointer-events: none;
      }
      .accounts-page .add-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; position: relative; }
      .accounts-page .add-icon {
        width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px;
        background: linear-gradient(135deg, var(--accent), #7a5cff);
        display: flex; align-items: center; justify-content: center; font-size: 18px;
        box-shadow: 0 4px 12px rgba(79,140,255,0.3);
      }
      .accounts-page .add-title { font-weight: 700; font-size: 15px; }
      .accounts-page .add-subtitle { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
      .accounts-page .add-form { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; position: relative; }
      .accounts-page .field { display: flex; flex-direction: column; gap: 6px; }
      .accounts-page .field label { font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
      .accounts-page .field input {
        background: var(--input-bg); border: 1px solid var(--border); color: var(--text);
        border-radius: var(--radius-lg); padding: 9px 12px; font-size: 13px; min-width: 200px;
        transition: border-color .15s, box-shadow .15s;
      }
      .accounts-page .field input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,140,255,0.18); }
      .accounts-page .field select {
        background: var(--input-bg); border: 1px solid var(--border); color: var(--text);
        border-radius: var(--radius-lg); padding: 9px 12px; font-size: 13px; min-width: 160px;
      }
      .accounts-page .node-select {
        background: var(--panel-2); border: 1px solid var(--border); color: var(--text);
        border-radius: 8px; padding: 5px 8px; font-size: 12px;
      }
      .accounts-page .node-badge { display: inline-block; font-size: 10.5px; color: var(--accent); border: 1px solid var(--accent); border-radius: 6px; padding: 1px 6px; margin-left: 6px; }
      .accounts-page .password-wrap { position: relative; }
      .accounts-page .password-wrap input { padding-right: 38px; }
      .accounts-page .password-toggle {
        position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
        background: none; border: none; cursor: pointer; font-size: 15px; opacity: 0.6; padding: 4px; line-height: 1;
      }
      .accounts-page .password-toggle:hover { opacity: 1; }
      .accounts-page .add-btn {
        width: auto; padding: 10px 20px; border: none; border-radius: 10px; font-weight: 700;
        background: linear-gradient(135deg, var(--accent), #7a5cff); color: #fff;
        box-shadow: 0 6px 16px rgba(79,140,255,0.28); cursor: pointer; transition: transform .1s, box-shadow .15s;
      }
      .accounts-page .add-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(79,140,255,0.38); }
      .accounts-page .add-hint { font-size: 11px; color: var(--muted); margin-top: 8px; position: relative; }
      .accounts-page .profile-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: 10px; overflow: hidden; }
      .accounts-page .profile-head { display: flex; align-items: center; gap: 12px; padding: 12px 14px; flex-wrap: wrap; }
      .accounts-page .profile-info { flex: 1; min-width: 160px; }
      .accounts-page .profile-nickname-row { display: flex; align-items: center; gap: 6px; }
      .accounts-page .profile-nickname { font-weight: 600; font-size: 14px; }
      .accounts-page .rename-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 0; }
      .accounts-page .rename-btn:hover { color: var(--text); }
      .accounts-page .profile-meta { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
      .accounts-page .profile-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .accounts-page .profile-actions button { width: auto; padding: 6px 12px; font-size: 12px; }
      .accounts-page .btn-danger { background: transparent; border: 1px solid var(--red); color: var(--red); border-radius: 8px; cursor: pointer; }
      .accounts-page .btn-secondary { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; cursor: pointer; }
      .accounts-page .btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }
      .accounts-page .status-wrap { display: flex; align-items: center; gap: 6px; }
      .accounts-page .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
      .accounts-page .status-dot.running { background: var(--green); box-shadow: 0 0 6px var(--green); }
      .accounts-page .status-dot.logged_in { background: var(--accent); box-shadow: 0 0 6px var(--accent); }
      .accounts-page .status-dot.connecting { background: var(--yellow); }
      .accounts-page .status-dot.offline { background: var(--muted); }
      .accounts-page .status-text { font-size: 11px; color: var(--muted); white-space: nowrap; }
      .accounts-page .profile-details { display: flex; gap: 18px; flex-wrap: wrap; padding-top: 8px; margin-top: 6px; border-top: 1px solid var(--border); font-size: 11.5px; }
      .accounts-page .detail-block { min-width: 160px; flex: 1; }
      .accounts-page .detail-block h4 { margin: 0 0 6px; font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }
      .accounts-page .stat-line { color: var(--text); line-height: 1.7; }
      .accounts-page .stat-line b { color: var(--muted); font-weight: 500; }
      .accounts-page .empty-hint { color: var(--muted); font-size: 13px; padding: 20px 0; text-align: center; }
      .accounts-page .login-group { margin-bottom: 20px; }
      .accounts-page .login-group-header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px 10px 0 0; flex-wrap: wrap; }
      .accounts-page .login-group-title { font-weight: 600; font-size: 13px; flex: 1; }
      .accounts-page .login-group-count { font-size: 11px; color: var(--muted); font-weight: 400; }
      .accounts-page .login-group-actions { display: flex; gap: 6px; flex-wrap: wrap; }
      .accounts-page .login-group-actions button { width: auto; padding: 5px 10px; font-size: 11px; }
      .accounts-page .login-group-body { border: 1px solid var(--border); border-top: none; border-radius: 0 0 10px 10px; padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; align-items: start; }
      .accounts-page .login-group-status { font-size: 11px; color: var(--muted); width: 100%; margin-top: 4px; grid-column: 1 / -1; }
      .accounts-page .profile-card { margin-bottom: 0; }
      .accounts-page .profile-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; width: 100%; padding: 0 14px 12px; }
      .accounts-page .profile-actions-primary { display: flex; gap: 6px; }
      .accounts-page .profile-actions-extra {
        display: none; flex-direction: column; gap: 6px; position: fixed; z-index: 250; min-width: 200px;
        background: var(--panel-2); border: 1px solid var(--border); border-radius: var(--radius-lg);
        padding: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.45);
      }
      .accounts-page .profile-actions-extra.open { display: flex; }
      .accounts-page .profile-actions-extra > * { width: 100%; margin: 0; }
      .accounts-page .profile-toggle-more { background: none; border: 1px solid var(--border); border-radius: 8px; color: var(--muted); cursor: pointer; padding: 6px 10px; font-size: 12px; margin-left: auto; }
      .accounts-page .profile-toggle-more:hover { color: var(--text); }
      .profile-term-modal-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 300;
        display: flex; align-items: center; justify-content: center; padding: 20px;
      }
      .profile-term-modal {
        background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg);
        width: 100%; max-width: 760px; max-height: 90vh; overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5); display: flex; flex-direction: column;
      }
      .profile-term-modal-header {
        display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;
      }
      .profile-term-modal-title { font-weight: 600; font-size: 14px; flex: 1; }
      .profile-term-modal-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 20px; line-height: 1; padding: 2px 4px; }
      .profile-term-modal-close:hover { color: var(--text); }
      .login-helper { display: none; padding: 12px 16px; border-top: 1px solid var(--border); background: var(--panel-2); }
      .login-helper.visible { display: block; }
      .login-helper-label { font-size: 11.5px; color: var(--muted); margin-bottom: 8px; }
      .login-helper-row { display: flex; gap: 8px; align-items: center; }
      .login-helper input[type="password"], .login-helper input[type="text"] { flex: 1; background: var(--panel); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 7px 10px; font-size: 13px; }
      .char-btn { display: block; width: 100%; text-align: left; background: var(--panel); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 9px 12px; cursor: pointer; margin-bottom: 6px; font-size: 13px; }
      .char-btn:last-child { margin-bottom: 0; }
      .char-btn:hover { background: var(--panel-hover); border-color: var(--accent); }
      .char-btn .char-url { color: var(--muted); font-size: 11px; margin-left: 6px; }
      .profile-term { border-top: 1px solid var(--border); padding: 10px; background: var(--surface-sunken); height: 460px; }
      .accounts-page .filter-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
      .accounts-page .filter-bar input[type="text"] { background: var(--input-bg); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 7px 10px; font-size: 12.5px; min-width: 180px; }
      .accounts-page .filter-bar select { background: var(--input-bg); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 7px 10px; font-size: 12.5px; }
      .accounts-page .filter-chip {
        display: inline-flex; align-items: center; gap: 4px; background: var(--panel-2); border: 1px solid var(--border);
        border-radius: 20px; padding: 4px 10px; font-size: 11.5px; cursor: pointer; user-select: none; color: var(--muted);
      }
      .accounts-page .filter-chip.active { color: var(--text); border-color: var(--accent); }
      @media (max-width: 480px) {
        .accounts-page .field input { min-width: 0; width: 100%; }
        .accounts-page .add-form { flex-direction: column; align-items: stretch; }
        .accounts-page .add-btn { width: 100%; }
      }
      @media (max-width: 480px) {
        .profile-term { height: 320px; }
        .profile-term-modal-backdrop { padding: 0; }
        .profile-term-modal { max-width: 100%; max-height: 100%; height: 100%; border-radius: 0; }
      }
    `;
    ctx.injectStyleOnce('accounts', css);

    const wrap = document.createElement('div');
    wrap.className = 'accounts-page';
    wrap.innerHTML = `
      <h1 class="page-title">${t('accounts.title')}</h1>
      <div class="add-card">
        <div class="add-header">
          <div class="add-icon">➕</div>
          <div>
            <div class="add-title">${t('accounts.addTitle')}</div>
            <div class="add-subtitle">${t('accounts.addSubtitle')}</div>
          </div>
        </div>
        <div class="add-form">
          <div class="field">
            <label for="acc-username">${t('accounts.usernameLabel')}</label>
            <input type="text" id="acc-username" placeholder="Username" autocomplete="off" />
          </div>
          <div class="field">
            <label for="acc-password">${t('login.password')}</label>
            <input type="password" id="acc-password" placeholder="${t('login.password')}" autocomplete="off" />
          </div>
          <div class="field">
            <label for="acc-node">Node</label>
            <select id="acc-node"><option value="">${t('accounts.localNode')}</option></select>
          </div>
          <button class="add-btn" id="acc-add-btn">${t('accounts.addBtn')}</button>
        </div>
        <div class="add-hint">${t('accounts.addHint')}</div>
        <div class="add-hint" id="acc-add-status"></div>
      </div>
      <div class="filter-bar">
        <button class="btn-secondary" id="acc-start-all" type="button">${t('accounts.startAllGlobalBtn')}</button>
        <button class="btn-secondary" id="acc-stop-all" type="button">${t('accounts.stopAllGlobalBtn')}</button>
        <button class="btn-secondary" id="acc-reload-configs" type="button" title="${t('accounts.reloadConfigsTitle')}">${t('accounts.reloadConfigsBtn')}</button>
        <span class="add-hint" id="acc-global-status"></span>
      </div>
      <div class="filter-bar">
        <input type="text" id="acc-filter-search" placeholder="${t('accounts.filterSearchPlaceholder')}" />
        <select id="acc-filter-status">
          <option value="">${t('accounts.filterStatusAll')}</option>
          <option value="running">${t('accounts.filterStatusRunning')}</option>
          <option value="offline">${t('accounts.filterStatusStopped')}</option>
        </select>
        <div id="acc-filter-classes"></div>
      </div>
      <div id="profiles-list"></div>
    `;
    container.appendChild(wrap);

    (function addPasswordToggle() {
      const input = wrap.querySelector('#acc-password');
      const fieldWrap = document.createElement('div');
      fieldWrap.className = 'password-wrap';
      input.parentNode.insertBefore(fieldWrap, input);
      fieldWrap.appendChild(input);
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
      fieldWrap.appendChild(btn);
    })();

    let nodesById = new Map();

    async function loadNodeOptions() {
      let nodes = [];
      try { nodes = await ctx.fetchJSON('/api/nodes'); } catch (e) { /* Nodes-Feature evtl. nicht verfügbar, still lokal weiterlaufen */ }
      nodesById = new Map(nodes.map(n => [n.id, n]));
      const select = wrap.querySelector('#acc-node');
      const current = select.value;
      select.innerHTML = `<option value="">${t('accounts.localNode')}</option>` +
        nodes.map(n => `<option value="${n.id}">${escapeHtml(n.name)}</option>`).join('');
      select.value = current;
      return nodes;
    }

    function nodeOptionsHtml(selectedId) {
      return `<option value="">${t('accounts.localNode')}</option>` +
        [...nodesById.values()].map(n => `<option value="${n.id}" ${n.id === selectedId ? 'selected' : ''}>${escapeHtml(n.name)}</option>`).join('');
    }

    const openTerminals = new Map(); // profileId -> { handle }

    function closeTerminal(id) {
      const t = openTerminals.get(id);
      if (t) { t.handle.dispose(); openTerminals.delete(id); }
    }

    // Konsole öffnet sich als eigenständiges Popup (an document.body angehängt, nicht als Teil
    // der Kachel) statt inline in der Kachel aufzuklappen — nur eine Konsole gleichzeitig offen,
    // ein zweites Öffnen schließt die erste zuerst.
    let activeTerminalModal = null;

    function closeTerminalModal() {
      if (!activeTerminalModal) return;
      const { profileId, backdropEl, onKeydown } = activeTerminalModal;
      closeTerminal(profileId);
      backdropEl.remove();
      document.removeEventListener('keydown', onKeydown);
      activeTerminalModal = null;
    }

    function metaLine(p) {
      const nodeBadge = p.nodeId ? `<span class="node-badge">🖧 ${escapeHtml(nodesById.get(p.nodeId)?.name || '?')}</span>` : '';
      const classBadge = p.characterClass ? `<span class="node-badge">${escapeHtml(p.characterClass)}</span>` : '';
      if (p.server && p.characterName) {
        return `${escapeHtml(p.username)} · ${escapeHtml(p.characterName)} @ ${escapeHtml(p.server)}${classBadge}${nodeBadge}`;
      }
      return `${escapeHtml(p.username)} · ${t('accounts.notLoggedIn')}${nodeBadge}`;
    }

    function statusInfo(botState, currentActivity) {
      switch (botState) {
        case 'running': return { cls: 'running', text: currentActivity ? t('accounts.runningWithActivity', { activity: currentActivity }) : 'Running' };
        case 'logged_in': return { cls: 'logged_in', text: t('accounts.loggedIn') };
        case 'connecting': return { cls: 'connecting', text: t('accounts.connecting') };
        default: return { cls: 'offline', text: 'Offline' };
      }
    }

    // Overflow-Menü ("⋯") schwebt als position:fixed-Overlay über dem Inhalt statt den
    // Kachel-Grid-Fluss zu verschieben — Position wird bei jedem Öffnen relativ zum Button neu
    // berechnet, damit es auch bei Scroll-Position und Fenstergröße korrekt andockt.
    function closeAllOverflowMenus() {
      wrap.querySelectorAll('.profile-actions-extra.open').forEach(el => el.classList.remove('open'));
    }

    function openOverflowMenu(menuEl, btnEl) {
      menuEl.classList.add('open');
      const btnRect = btnEl.getBoundingClientRect();
      const menuRect = menuEl.getBoundingClientRect();
      let left = btnRect.right - menuRect.width;
      left = Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8));
      let top = btnRect.bottom + 6;
      if (top + menuRect.height > window.innerHeight - 8) {
        top = btnRect.top - menuRect.height - 6;
      }
      menuEl.style.left = `${left}px`;
      menuEl.style.top = `${top}px`;
    }

    function closeMenusOnOutsideClick(ev) {
      if (ev.target.closest('.profile-actions-extra') || ev.target.closest('.profile-toggle-more')) return;
      closeAllOverflowMenus();
    }
    function closeMenusOnEscape(ev) {
      if (ev.key === 'Escape') closeAllOverflowMenus();
    }
    document.addEventListener('click', closeMenusOnOutsideClick);
    document.addEventListener('keydown', closeMenusOnEscape);
    window.addEventListener('scroll', closeAllOverflowMenus, true);

    // Klassen-Sichtbarkeit: neue Klassen werden beim ersten Erscheinen sichtbar
    // hinzugefügt, ein späteres Abwählen bleibt aber über Neuladungen hinweg bestehen.
    const visibleClasses = new Set();
    const knownClasses = new Set();

    function renderClassFilterChips(profileClasses) {
      const chipsWrap = wrap.querySelector('#acc-filter-classes');
      chipsWrap.innerHTML = profileClasses.map(c => `
        <button type="button" class="filter-chip${visibleClasses.has(c) ? ' active' : ''}" data-value="${escapeHtml(c)}">${escapeHtml(c)}</button>
      `).join('');
      chipsWrap.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const value = btn.dataset.value;
          if (visibleClasses.has(value)) visibleClasses.delete(value); else visibleClasses.add(value);
          btn.classList.toggle('active');
          applyFilters();
        });
      });
    }

    function applyFilters() {
      closeAllOverflowMenus();
      const searchVal = (wrap.querySelector('#acc-filter-search')?.value || '').trim().toLowerCase();
      const statusVal = wrap.querySelector('#acc-filter-status')?.value || '';
      wrap.querySelectorAll('.login-group').forEach(group => {
        let anyVisible = false;
        group.querySelectorAll('.profile-card').forEach(card => {
          const cls = card.dataset.class;
          const status = card.dataset.status;
          const haystack = `${card.querySelector('[data-role="nickname"]')?.textContent || ''} ${card.querySelector('[data-role="meta"]')?.textContent || ''}`.toLowerCase();
          const matchesSearch = !searchVal || haystack.includes(searchVal);
          const matchesStatus = !statusVal || status === statusVal;
          const matchesClass = !cls || visibleClasses.has(cls);
          const visible = matchesSearch && matchesStatus && matchesClass;
          card.style.display = visible ? '' : 'none';
          if (visible) anyVisible = true;
        });
        group.style.display = anyVisible ? '' : 'none';
      });
    }

    wrap.querySelector('#acc-filter-search').addEventListener('input', applyFilters);
    wrap.querySelector('#acc-filter-status').addEventListener('change', applyFilters);

    const globalStatusEl = wrap.querySelector('#acc-global-status');

    wrap.querySelector('#acc-start-all').addEventListener('click', async () => {
      const profiles = await ctx.fetchJSON('/api/profiles');
      if (!profiles.length) return;
      if (!confirm(t('accounts.confirmStartAllGlobal', { count: profiles.length }))) return;
      globalStatusEl.textContent = t('accounts.startingAll');
      const results = await Promise.all(profiles.map(p =>
        ctx.fetchJSON(`/api/profiles/${encodeURIComponent(p.id)}/start`, { method: 'POST' })
          .then(() => null).catch(err => ({ nickname: p.nickname, message: err.message }))));
      const failed = results.filter(Boolean);
      globalStatusEl.textContent = failed.length
        ? t('accounts.reloadConfigsFailed', { succeeded: profiles.length - failed.length, total: profiles.length, names: failed.map(f => f.nickname).join(', ') })
        : '';
      await loadProfiles();
    });

    wrap.querySelector('#acc-stop-all').addEventListener('click', async () => {
      const profiles = await ctx.fetchJSON('/api/profiles');
      if (!profiles.length) return;
      if (!confirm(t('accounts.confirmStopAllGlobal', { count: profiles.length }))) return;
      globalStatusEl.textContent = t('accounts.stoppingAll');
      profiles.forEach(p => closeTerminal(p.id));
      const results = await Promise.all(profiles.map(p =>
        ctx.fetchJSON(`/api/profiles/${encodeURIComponent(p.id)}/stop`, { method: 'POST' })
          .then(() => null).catch(err => ({ nickname: p.nickname, message: err.message }))));
      const failed = results.filter(Boolean);
      globalStatusEl.textContent = failed.length
        ? t('accounts.reloadConfigsFailed', { succeeded: profiles.length - failed.length, total: profiles.length, names: failed.map(f => f.nickname).join(', ') })
        : '';
      await loadProfiles();
    });

    wrap.querySelector('#acc-reload-configs').addEventListener('click', async () => {
      globalStatusEl.textContent = t('accounts.reloadingConfigs');
      try {
        const result = await ctx.fetchJSON('/api/profiles/resync-all', { method: 'POST' });
        globalStatusEl.textContent = result.failed.length
          ? t('accounts.reloadConfigsFailed', { succeeded: result.succeeded, total: result.total, names: result.failed.map(f => f.nickname).join(', ') })
          : t('accounts.reloadConfigsDone', { succeeded: result.succeeded, total: result.total });
      } catch (err) {
        globalStatusEl.textContent = t('analytics.loadError', { message: err.message });
      }
    });

    async function loadProfiles() {
      const list = wrap.querySelector('#profiles-list');
      await loadNodeOptions();
      let profiles;
      try {
        profiles = await ctx.fetchJSON('/api/profiles');
      } catch (err) {
        list.innerHTML = `<p class="empty-hint">${t('analytics.loadError', { message: escapeHtml(err.message) })}</p>`;
        return;
      }
      if (!profiles.length) {
        list.innerHTML = `<p class="empty-hint">${t('accounts.emptyHint')}</p>`;
        return;
      }

      const groups = new Map();
      profiles.forEach(p => {
        if (!groups.has(p.username)) groups.set(p.username, []);
        groups.get(p.username).push(p);
      });

      const profileClasses = [...new Set(profiles.map(p => p.characterClass).filter(Boolean))].sort();
      profileClasses.forEach(c => {
        if (!knownClasses.has(c)) { knownClasses.add(c); visibleClasses.add(c); }
      });

      function detailsHtml(p) {
        if (!p.status.running) return '';
        const uptime = fmtUptime(p.status.startedAt);
        return `
          <div class="profile-details">
            <div class="detail-block">
              <h4>Session</h4>
              <div class="stat-line">
                ${uptime ? `<b>${t('accounts.uptimeLabel')}</b> ${uptime}<br>` : ''}
                <b>${t('accounts.commandsSentLabel')}</b> ${p.status.commandsSent ?? 0}<br>
                <b>${t('accounts.errorsWarningsLabel')}</b> ${p.status.errorsSeen ?? 0}
              </div>
            </div>
          </div>`;
      }

      function profileCardHtml(p) {
        const hasCharacter = !!(p.server && p.characterName);
        const paused = (p.pausedKeys || []).length > 0;
        const st = statusInfo(p.status.botState, p.currentActivity);
        return `
        <div class="profile-card" data-id="${p.id}" data-class="${escapeHtml(p.characterClass || '')}" data-status="${p.status.running ? 'running' : 'offline'}">
          <div class="profile-head">
            <div class="status-wrap">
              <span class="status-dot ${st.cls}" data-role="dot"></span>
              <span class="status-text" data-role="status-text">${st.text}</span>
            </div>
            <div class="profile-info">
              <div class="profile-nickname-row">
                <span class="profile-nickname char-name" data-role="nickname">${escapeHtml(p.nickname)}</span>
                <button class="rename-btn" data-action="rename" title="${t('nodes.renameTitle')}">✏️</button>
              </div>
              <div class="profile-meta char-name" data-role="meta">${metaLine(p)}</div>
            </div>
          </div>
          <div class="profile-actions">
            <div class="profile-actions-primary">
              <button class="btn btn-primary" data-action="start" ${p.status.running ? 'disabled' : ''}>Start</button>
              <button class="btn-secondary" data-action="stop" ${p.status.running ? '' : 'disabled'}>Stop</button>
            </div>
            <button type="button" class="profile-toggle-more" data-action="toggle-more">⋯</button>
            <div class="profile-actions-extra">
              <button class="btn-secondary" data-action="pause" ${hasCharacter && !paused ? '' : 'disabled'} title="${t('accounts.pauseTitle')}">${paused ? t('accounts.paused') : 'Pause'}</button>
              <button class="btn-secondary" data-action="resume" ${paused ? '' : 'disabled'}>${t('accounts.resumeBtn')}</button>
              <button class="btn-secondary" data-action="claim" ${hasCharacter && p.hasPassword ? '' : 'disabled'} title="${t('accounts.claimTitle')}">${t('accounts.claimBtn')}</button>
              <button class="btn-secondary" data-action="detect-class" ${hasCharacter && p.hasPassword ? '' : 'disabled'} title="${t('accounts.detectClassTitle')}">${t('accounts.detectClassBtn')}</button>
              <button class="btn-secondary" data-action="toggle-term">${t('accounts.consoleBtn')}</button>
              <select class="node-select" data-action="move-node" title="${t('accounts.moveNodeTitle')}">${nodeOptionsHtml(p.nodeId)}</select>
              <button class="btn-danger" data-action="delete">${t('settings.deleteBtn')}</button>
              ${detailsHtml(p)}
            </div>
          </div>
        </div>
      `;
      }

      list.innerHTML = [...groups.entries()].map(([username, members]) => `
        <div class="login-group" data-username="${escapeHtml(username)}">
          <div class="login-group-header">
            <span class="login-group-title char-name">${escapeHtml(username)} <span class="login-group-count">(${members.length} ${members.length === 1 ? t('accounts.characterSingular') : t('accounts.characterPlural')})</span></span>
            <div class="login-group-actions">
              <button class="btn-secondary" data-group-action="refresh">${t('accounts.refreshBtn')}</button>
              <button class="btn-secondary" data-group-action="start-all">${t('accounts.startAllBtn')}</button>
              <button class="btn-secondary" data-group-action="stop-all">${t('accounts.stopAllBtn')}</button>
              <button class="btn-secondary" data-group-action="pause-all">${t('accounts.pauseAllBtn')}</button>
              <button class="btn-danger" data-group-action="remove-login">${t('accounts.removeLoginBtn')}</button>
            </div>
            <div class="login-group-status" data-role="group-status"></div>
          </div>
          <div class="login-group-body">
            ${members.map(profileCardHtml).join('')}
          </div>
        </div>
      `).join('');

      renderClassFilterChips(profileClasses);

      list.querySelectorAll('.profile-card').forEach(card => {
        const id = card.dataset.id;
        const profile = profiles.find(p => p.id === id);

        async function renameProfile(nickname) {
          const trimmed = (nickname || '').trim();
          if (!trimmed) return;
          try {
            await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/nickname`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nickname: trimmed }),
            });
            profile.nickname = trimmed;
            card.querySelector('[data-role="nickname"]').textContent = trimmed;
          } catch (err) {
            alert(t('nodes.renameFailed', { message: err.message }));
          }
        }

        card.querySelector('[data-action="rename"]').addEventListener('click', () => {
          const next = prompt(t('accounts.renameNicknamePrompt'), profile.nickname);
          if (next !== null) renameProfile(next);
        });

        const moreBtn = card.querySelector('[data-action="toggle-more"]');
        const extraMenu = card.querySelector('.profile-actions-extra');
        moreBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const wasOpen = extraMenu.classList.contains('open');
          closeAllOverflowMenus();
          if (!wasOpen) openOverflowMenu(extraMenu, moreBtn);
        });

        card.querySelector('[data-action="start"]').addEventListener('click', async () => {
          try {
            await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/start`, { method: 'POST' });
          } catch (err) {
            alert(t('accounts.startFailed', { message: err.message }));
          }
          await loadProfiles();
        });
        card.querySelector('[data-action="stop"]').addEventListener('click', async () => {
          closeTerminal(id);
          try {
            await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/stop`, { method: 'POST' });
          } catch (err) {
            alert(t('accounts.stopFailed', { message: err.message }));
          }
          await loadProfiles();
        });
        card.querySelector('[data-action="pause"]').addEventListener('click', async () => {
          try {
            await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/pause`, { method: 'POST' });
            await loadProfiles();
          } catch (err) {
            alert(t('accounts.pauseFailed', { message: err.message }));
          }
        });
        card.querySelector('[data-action="resume"]').addEventListener('click', async () => {
          try {
            await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/resume`, { method: 'POST' });
            await loadProfiles();
          } catch (err) {
            alert(t('accounts.resumeFailed', { message: err.message }));
          }
        });
        const claimBtn = card.querySelector('[data-action="claim"]');
        if (claimBtn) {
          claimBtn.addEventListener('click', async () => {
            const original = claimBtn.textContent;
            claimBtn.disabled = true;
            claimBtn.textContent = t('accounts.claimingBtn');
            try {
              await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/claim`, { method: 'POST' });
              claimBtn.textContent = t('accounts.claimedBtn');
            } catch (err) {
              claimBtn.textContent = original;
              alert(t('accounts.claimFailed', { message: err.message }));
            } finally {
              setTimeout(() => { claimBtn.disabled = false; claimBtn.textContent = original; }, 2500);
            }
          });
        }

        const detectClassBtn = card.querySelector('[data-action="detect-class"]');
        if (detectClassBtn) {
          detectClassBtn.addEventListener('click', async () => {
            const original = detectClassBtn.textContent;
            detectClassBtn.disabled = true;
            detectClassBtn.textContent = t('accounts.detectingBtn');
            try {
              await ctx.fetchJSON(`/api/gamestate/${encodeURIComponent(id)}`);
              await loadProfiles();
            } catch (err) {
              detectClassBtn.textContent = original;
              alert(t('accounts.detectClassFailed', { message: err.message }));
            } finally {
              detectClassBtn.disabled = !(profile.server && profile.characterName && profile.hasPassword);
            }
          });
        }

        card.querySelector('[data-action="move-node"]').addEventListener('change', async (ev) => {
          const nodeId = ev.target.value || null;
          const targetName = nodeId ? (nodesById.get(nodeId)?.name || nodeId) : t('accounts.localNodeTarget');
          if (!confirm(t('accounts.confirmMoveNode', { nickname: profile.nickname, target: targetName }))) {
            ev.target.value = profile.nodeId || '';
            return;
          }
          closeTerminal(id);
          try {
            await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/node`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nodeId }),
            });
            await loadProfiles();
          } catch (err) {
            alert(t('accounts.moveFailed', { message: err.message }));
            ev.target.value = profile.nodeId || '';
          }
        });

        card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          if (!confirm(t('accounts.confirmDeleteProfile', { nickname: profile.nickname }))) return;
          closeTerminal(id);
          await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
          await loadProfiles();
        });

        // Konsole ist eine reine Anzeige, unabhängig von Start/Stop — das CLI-Fenster öffnet
        // sich als Popup, nur sichtbar, wenn man das hier explizit anklickt.
        card.querySelector('[data-action="toggle-term"]').addEventListener('click', () => {
          if (activeTerminalModal && activeTerminalModal.profileId === id) {
            closeTerminalModal();
            return;
          }
          closeTerminalModal();

          const backdropEl = document.createElement('div');
          backdropEl.className = 'profile-term-modal-backdrop';
          backdropEl.innerHTML = `
            <div class="profile-term-modal">
              <div class="profile-term-modal-header">
                <span class="profile-term-modal-title char-name">${escapeHtml(profile.nickname)}</span>
                <button type="button" class="profile-term-modal-close" data-role="term-modal-close">×</button>
              </div>
              <div class="login-helper" data-role="login-helper"></div>
              <div class="profile-term" data-role="term-container"></div>
            </div>
          `;
          document.body.appendChild(backdropEl);
          const termEl = backdropEl.querySelector('[data-role="term-container"]');
          const helperEl = backdropEl.querySelector('[data-role="login-helper"]');
          const onKeydown = (ev) => { if (ev.key === 'Escape') closeTerminalModal(); };
          document.addEventListener('keydown', onKeydown);
          backdropEl.addEventListener('click', (ev) => { if (ev.target === backdropEl) closeTerminalModal(); });
          backdropEl.querySelector('[data-role="term-modal-close"]').addEventListener('click', closeTerminalModal);
          activeTerminalModal = { profileId: id, backdropEl, onKeydown };

          const dot = card.querySelector('[data-role="dot"]');
          const statusTextEl = card.querySelector('[data-role="status-text"]');

          function showPasswordHelper() {
            helperEl.classList.add('visible');
            helperEl.innerHTML = `
              <div class="login-helper-label">${t('accounts.passwordForLabel', { nickname: escapeHtml(profile.nickname) })}</div>
              <div class="login-helper-row">
                <input type="password" data-role="pw-input" placeholder="${t('login.password')}" autocomplete="off" />
                <button class="btn btn-primary" data-role="pw-submit" style="width:auto;padding:7px 16px;">${t('accounts.loginBtn')}</button>
              </div>
            `;
            const input = helperEl.querySelector('[data-role="pw-input"]');
            const submit = () => {
              if (!input.value) return;
              handle.write(input.value + '\r');
              input.value = '';
              helperEl.classList.remove('visible');
              helperEl.innerHTML = '';
            };
            helperEl.querySelector('[data-role="pw-submit"]').addEventListener('click', submit);
            input.addEventListener('keydown', ev => { if (ev.key === 'Enter') submit(); });
            input.focus();
          }

          function showCharacterHelper(characters) {
            helperEl.classList.add('visible');
            helperEl.innerHTML = `
              <div class="login-helper-label">${t('accounts.chooseCharacterLabel')}</div>
              ${characters.map(c => `
                <button class="char-btn" data-index="${c.index}" data-name="${escapeHtml(c.name)}" data-url="${escapeHtml(c.url)}">
                  <span class="char-name">${escapeHtml(c.name)}</span>
                  <span class="char-url">${escapeHtml(c.url)}</span>
                </button>`).join('')}
            `;
            helperEl.querySelectorAll('.char-btn').forEach(btn => {
              btn.addEventListener('click', () => showNicknameStep(btn.dataset.index, btn.dataset.name, btn.dataset.url));
            });
          }

          function showNicknameStep(index, charName, url) {
            helperEl.innerHTML = `
              <div class="login-helper-label">${t('accounts.nicknameForLabel', { charName: escapeHtml(charName) })}</div>
              <div class="login-helper-row">
                <input type="text" data-role="nick-input" value="${escapeHtml(charName)}" />
                <button class="btn btn-primary" data-role="nick-submit" style="width:auto;padding:7px 16px;">${t('accounts.confirmBtn')}</button>
              </div>
            `;
            const input = helperEl.querySelector('[data-role="nick-input"]');
            const submit = async () => {
              const nickname = input.value.trim() || charName;
              try {
                await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/character`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ nickname, server: serverFromUrl(url), characterName: charName }),
                });
              } catch (e) { /* Login trotzdem fortsetzen, auch wenn das Speichern scheitert */ }
              handle.write(index + '\r');
              helperEl.classList.remove('visible');
              helperEl.innerHTML = '';
            };
            helperEl.querySelector('[data-role="nick-submit"]').addEventListener('click', submit);
            input.addEventListener('keydown', ev => { if (ev.key === 'Enter') submit(); });
            input.select();
          }

          // Ist bereits ein Passwort gespeichert UND der Charakter bekannt, läuft der Login
          // serverseitig voll automatisch (siehe ptyManager) — die Login-Hilfe würde sonst kurz
          // aufblitzen, obwohl der Server die Eingabe längst selbst erledigt hat.
          const needsManualHelp = !(profile.hasPassword && profile.characterName);

          const handle = connectTerminal({
            container: termEl,
            profileId: id,
            redactTerms: [profile.username, profile.characterName, profile.nickname].filter(Boolean),
            onStatus: (status) => {
              if (!status.botState) return; // WS getrennt, kein PTY-Status bekannt
              const info = statusInfo(status.botState);
              dot.className = 'status-dot ' + info.cls;
              statusTextEl.textContent = info.text;
            },
            onPrompt: needsManualHelp ? (prompt) => {
              if (prompt.kind === 'password') showPasswordHelper();
              else if (prompt.kind === 'character-index') showCharacterHelper(prompt.characters);
            } : undefined,
          });
          openTerminals.set(id, { handle });
        });
      });

      list.querySelectorAll('.login-group').forEach(group => {
        const username = group.dataset.username;
        const memberIds = [...group.querySelectorAll('.profile-card')].map(c => c.dataset.id);
        const statusEl = group.querySelector('[data-role="group-status"]');

        group.querySelector('[data-group-action="refresh"]').addEventListener('click', async () => {
          statusEl.textContent = t('accounts.searchingCharacters');
          try {
            const result = await ctx.fetchJSON(`/api/logins/${encodeURIComponent(username)}/refresh`, { method: 'POST' });
            statusEl.textContent = result.created.length
              ? t('accounts.newCharactersFound', { count: result.created.length, names: result.created.map(p => p.characterName).join(', ') })
              : t('accounts.noNewCharacters', { total: result.totalFound });
            await loadProfiles();
          } catch (err) {
            statusEl.textContent = t('analytics.loadError', { message: err.message });
          }
        });

        group.querySelector('[data-group-action="start-all"]').addEventListener('click', async () => {
          statusEl.textContent = t('accounts.startingAll');
          await Promise.all(memberIds.map(mid =>
            ctx.fetchJSON(`/api/profiles/${encodeURIComponent(mid)}/start`, { method: 'POST' }).catch(() => {})));
          statusEl.textContent = '';
          await loadProfiles();
        });

        group.querySelector('[data-group-action="stop-all"]').addEventListener('click', async () => {
          statusEl.textContent = t('accounts.stoppingAll');
          memberIds.forEach(closeTerminal);
          await Promise.all(memberIds.map(mid =>
            ctx.fetchJSON(`/api/profiles/${encodeURIComponent(mid)}/stop`, { method: 'POST' }).catch(() => {})));
          statusEl.textContent = '';
          await loadProfiles();
        });

        group.querySelector('[data-group-action="pause-all"]').addEventListener('click', async () => {
          statusEl.textContent = t('accounts.pausingAll');
          await Promise.all(memberIds.map(mid =>
            ctx.fetchJSON(`/api/profiles/${encodeURIComponent(mid)}/pause`, { method: 'POST' }).catch(() => {})));
          statusEl.textContent = '';
          await loadProfiles();
        });

        group.querySelector('[data-group-action="remove-login"]').addEventListener('click', async () => {
          if (!confirm(t('accounts.confirmRemoveLogin', { username, count: memberIds.length }))) return;
          memberIds.forEach(closeTerminal);
          await ctx.fetchJSON(`/api/logins/${encodeURIComponent(username)}`, { method: 'DELETE' });
          await loadProfiles();
        });
      });

      applyFilters();
    }

    wrap.querySelector('#acc-add-btn').addEventListener('click', async () => {
      const username = wrap.querySelector('#acc-username').value.trim();
      const password = wrap.querySelector('#acc-password').value;
      const nodeId = wrap.querySelector('#acc-node').value || undefined;
      const status = wrap.querySelector('#acc-add-status');
      if (!username || !password) {
        status.textContent = t('accounts.addValidation');
        return;
      }
      status.textContent = t('accounts.addTesting');
      try {
        const result = await ctx.fetchJSON('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, nodeId }),
        });
        wrap.querySelector('#acc-username').value = '';
        wrap.querySelector('#acc-password').value = '';
        const names = result.created.map(p => p.characterName).join(', ');
        status.textContent = result.created.length
          ? t('accounts.addedCharacters', { count: result.created.length, names })
          : t('accounts.noNewCharactersOnAdd');
        await loadProfiles();
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    });

    loadProfiles();
    const interval = setInterval(() => {
      // Nur Status aktualisieren, keine offenen Terminals stören
      if (openTerminals.size === 0) loadProfiles();
    }, 5000);

    return () => {
      clearInterval(interval);
      closeTerminalModal();
      openTerminals.forEach(t => t.handle.dispose());
      document.removeEventListener('click', closeMenusOnOutsideClick);
      document.removeEventListener('keydown', closeMenusOnEscape);
      window.removeEventListener('scroll', closeAllOverflowMenus, true);
    };
  }
};
