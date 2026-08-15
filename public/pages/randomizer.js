import { t } from '/lib/i18n.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtMinutes(mins) {
  const m = Math.round(mins);
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export default {
  id: 'randomizer',
  label: 'Randomizer',
  icon: '🎲',
  mount(container, ctx) {
    const wrap = document.createElement('div');
    wrap.className = 'randomizer-page';
    wrap.innerHTML = `
      <h1 class="page-title">${t('randomizer.title')}</h1>
      <p class="page-hint">${t('randomizer.hint')}</p>

      <section class="card" id="randomizer-settings-card">
        <div class="card-header"><span>${t('randomizer.globalSettingsTitle')}</span></div>
        <div class="randomizer-settings-grid" id="randomizer-settings-grid"></div>
        <div class="randomizer-settings-footer">
          <button type="button" class="btn btn-primary" id="randomizer-settings-save-btn">${t('randomizer.saveSettingsBtn')}</button>
          <span id="randomizer-settings-status" class="muted"></span>
        </div>
      </section>

      <section class="card">
        <div class="card-header"><span>${t('randomizer.accountsTitle')}</span></div>
        <div id="randomizer-accounts-list"></div>
      </section>
    `;
    container.appendChild(wrap);

    ctx.injectStyleOnce('randomizer-page', `
      .randomizer-page .page-hint { color: var(--muted); font-size: 12.5px; margin: -6px 0 14px; }
      .randomizer-settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
      .randomizer-settings-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
      .randomizer-settings-grid input, .randomizer-settings-grid select {
        background: var(--input-bg); border: 1px solid var(--border); color: var(--text);
        border-radius: 8px; padding: 7px 10px; font-size: 13px; font-weight: 400; text-transform: none; letter-spacing: normal;
      }
      .randomizer-settings-grid select option, .randomizer-row-controls select option {
        background: var(--panel-2); color: var(--text);
      }
      .randomizer-settings-footer { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
      .randomizer-settings-footer .btn { width: auto; padding: 8px 18px; }
      .randomizer-row {
        display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 0; border-bottom: 1px solid var(--border);
      }
      .randomizer-row:last-child { border-bottom: none; }
      .randomizer-row-info { flex: 1; min-width: 180px; }
      .randomizer-row-name { font-weight: 600; font-size: 13.5px; }
      .randomizer-row-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
      .randomizer-row-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .randomizer-row-controls select {
        background: var(--input-bg); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 6px 10px; font-size: 12.5px;
      }
      .randomizer-priority-field { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--muted); }
      .randomizer-priority-field input {
        width: 48px; background: var(--input-bg); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 5px 6px; font-size: 12.5px;
      }
      .randomizer-willkur-btn {
        background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px;
        cursor: pointer; padding: 6px 12px; font-size: 12.5px; font-weight: 600;
      }
      .randomizer-willkur-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
      .randomizer-manual-fields { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; transition: opacity .15s; }
      .randomizer-manual-fields.disabled { opacity: 0.4; pointer-events: none; }
      .randomizer-manual-fields label { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--muted); }
      .randomizer-manual-fields input {
        width: 56px; background: var(--input-bg); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 5px 6px; font-size: 12.5px;
      }
      .randomizer-manual-fields input:disabled { cursor: not-allowed; }
      .randomizer-plan-btn { background: none; border: 1px solid var(--border); border-radius: 8px; color: var(--muted); cursor: pointer; padding: 6px 10px; font-size: 12px; }
      .randomizer-plan-btn:hover { color: var(--text); }
      .randomizer-plan-body { flex-basis: 100%; font-size: 12px; color: var(--text); background: var(--panel-2); border-radius: 8px; padding: 10px 12px; margin-top: 4px; }
      .randomizer-plan-body .muted { color: var(--muted); }
      .randomizer-plan-node { font-weight: 600; margin-bottom: 6px; }
      .randomizer-plan-list { list-style: none; margin: 4px 0 0; padding: 0; }
      .randomizer-plan-list li { padding: 2px 0; }
      .empty-hint { color: var(--muted); font-size: 13px; padding: 20px 0; text-align: center; }
    `);

    let settings = null;
    let nodes = [];
    let vpnProfileList = [];

    function nodeName(nodeId) {
      if (!nodeId) return t('randomizer.noNode');
      const node = nodes.find(n => n.id === nodeId);
      return node ? node.name : nodeId;
    }

    function nodeOptionsHtml(selected, includeEmpty) {
      const emptyOption = includeEmpty ? `<option value="">${t('randomizer.noneOption')}</option>` : '';
      return emptyOption + nodes.map(n =>
        `<option value="${escapeHtml(n.id)}" ${n.id === selected ? 'selected' : ''}>${escapeHtml(n.name)}</option>`
      ).join('');
    }

    const SETTINGS_FIELDS = [
      ['minHours', 'randomizer.minHours', 'number'],
      ['maxHours', 'randomizer.maxHours', 'number'],
      ['dayStart', 'randomizer.dayStart', 'text'],
      ['dayEnd', 'randomizer.dayEnd', 'text'],
      ['dayHardEnd', 'randomizer.dayHardEnd', 'text'],
      ['minBlockMinutes', 'randomizer.minBlock', 'number'],
      ['nodeHandoffMinutes', 'randomizer.nodeHandoff', 'number'],
      ['stadtwacheDurationMin', 'randomizer.stadtwacheDuration', 'number'],
      ['stadtwacheCutoff', 'randomizer.stadtwacheCutoff', 'text'],
    ];

    async function loadSettings() {
      settings = await ctx.fetchJSON('/api/randomizer/settings');
      const grid = wrap.querySelector('#randomizer-settings-grid');
      const reserveField = `
        <label>${t('randomizer.reserveNode')}
          <select data-key="reserveNodeId">${nodeOptionsHtml(settings.reserveNodeId, true)}</select>
        </label>
      `;
      const otherFields = SETTINGS_FIELDS.map(([key, labelKey, type]) => `
        <label>${t(labelKey)}
          <input type="${type}" data-key="${key}" value="${escapeHtml(String(settings[key]))}" />
        </label>
      `).join('');
      grid.innerHTML = reserveField + otherFields;
    }

    wrap.querySelector('#randomizer-settings-save-btn').addEventListener('click', async () => {
      const status = wrap.querySelector('#randomizer-settings-status');
      const patch = {};
      wrap.querySelectorAll('#randomizer-settings-grid [data-key]').forEach(el => {
        const key = el.dataset.key;
        patch[key] = el.type === 'number' ? Number(el.value) : (el.value || null);
      });
      status.textContent = t('randomizer.saving');
      try {
        settings = await ctx.fetchJSON('/api/randomizer/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        status.textContent = t('randomizer.settingsSaved');
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    });

    function vpnOptionsHtml(config) {
      const noneSelected = config.vpnMode === 'none';
      return `
        <option value="" ${noneSelected ? 'selected' : ''}>${t('randomizer.noVpnOption')}</option>
        ${vpnProfileList.map(p =>
          `<option value="${escapeHtml(p.id)}" ${!noneSelected && p.id === config.vpnProfileId ? 'selected' : ''}>${escapeHtml(p.label)}</option>`
        ).join('')}
      `;
    }

    function rowHtml(username, members, config) {
      const isWillkur = config.mode === 'willkuer';
      const charNames = members.map(m => m.characterName || m.nickname).filter(Boolean).join(', ');
      const countLabel = members.length === 1 ? t('accounts.characterSingular') : t('accounts.characterPlural');
      return `
        <div class="randomizer-row" data-username="${escapeHtml(username)}">
          <div class="randomizer-row-info">
            <div class="randomizer-row-name char-name">${escapeHtml(username)}</div>
            <div class="randomizer-row-meta char-name">${members.length} ${countLabel}${charNames ? ` · ${charNames}` : ''}</div>
          </div>
          <div class="randomizer-row-controls">
            <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);">
              <input type="checkbox" data-role="enabled" ${config.enabled ? 'checked' : ''} /> ${t('randomizer.enabledLabel')}
            </label>
            <label class="randomizer-priority-field">${t('randomizer.priorityLabel')}
              <input type="number" min="1" max="100" data-role="priority" value="${config.priority}" />
            </label>
            <select data-role="vpn">${vpnOptionsHtml(config)}</select>
            <button type="button" class="randomizer-willkur-btn ${isWillkur ? 'active' : ''}" data-role="willkur-toggle">
              ${t('randomizer.willkurBtnLabel')}: ${isWillkur ? t('randomizer.willkurOn') : t('randomizer.willkurOff')}
            </button>
            <div class="randomizer-manual-fields ${isWillkur ? 'disabled' : ''}" data-role="manual-fields">
              <label>${t('randomizer.hoursLabel')} <input type="number" min="1" max="24" step="0.5" data-role="hoursPerDay" value="${config.hoursPerDay}" ${isWillkur ? 'disabled' : ''} /></label>
              <label>${t('randomizer.blocksLabel')} <input type="number" min="1" max="4" data-role="blockCount" value="${config.blockCount}" ${isWillkur ? 'disabled' : ''} /></label>
              <label>${t('randomizer.stadtwacheLabel')} <input type="number" min="1" max="5" data-role="stadtwacheCount" value="${config.stadtwacheCount}" ${isWillkur ? 'disabled' : ''} /></label>
            </div>
            <button type="button" class="randomizer-plan-btn" data-role="plan-toggle">${t('randomizer.planBtn')}</button>
          </div>
          <div class="randomizer-plan-body" data-role="plan-body" hidden></div>
        </div>
      `;
    }

    function planBodyHtml(plan) {
      if (!plan) return `<span class="muted">${t('randomizer.planEmpty')}</span>`;
      const blockItems = plan.blocks.map(b => `<li>▶ ${fmtMinutes(b.start)} – ${fmtMinutes(b.end)}</li>`).join('');
      const stadtwacheItems = plan.stadtwache.map(s => `<li>🛡 ${fmtMinutes(s.at)}</li>`).join('');
      return `
        <div class="randomizer-plan-node">${t('randomizer.planNode')}: ${escapeHtml(nodeName(plan.nodeId))}</div>
        <div><strong>${t('randomizer.planBlock')}</strong></div>
        <ul class="randomizer-plan-list">${blockItems || `<li class="muted">—</li>`}</ul>
        <div style="margin-top:8px;"><strong>${t('randomizer.planStadtwache')}</strong></div>
        <ul class="randomizer-plan-list">${stadtwacheItems || `<li class="muted">—</li>`}</ul>
      `;
    }

    async function loadAccounts() {
      const list = wrap.querySelector('#randomizer-accounts-list');
      let profiles, configs;
      try {
        [profiles, configs] = await Promise.all([
          ctx.fetchJSON('/api/profiles'),
          ctx.fetchJSON('/api/randomizer/configs'),
        ]);
      } catch (err) {
        list.innerHTML = `<p class="empty-hint">${t('analytics.loadError', { message: err.message })}</p>`;
        return;
      }
      if (!profiles.length) {
        list.innerHTML = `<p class="empty-hint">${t('randomizer.noAccountsHint')}</p>`;
        return;
      }

      const groups = new Map();
      profiles.forEach(p => {
        if (!groups.has(p.username)) groups.set(p.username, []);
        groups.get(p.username).push(p);
      });

      const defaultConfig = {
        enabled: false, mode: 'manual', hoursPerDay: 6, blockCount: 2, stadtwacheCount: 2,
        priority: 50, vpnMode: 'none', vpnProfileId: null,
      };
      list.innerHTML = [...groups.entries()]
        .map(([username, members]) => rowHtml(username, members, { ...defaultConfig, ...(configs[username] || {}) }))
        .join('');

      list.querySelectorAll('.randomizer-row').forEach(row => {
        const username = row.dataset.username;
        const willkurBtn = row.querySelector('[data-role="willkur-toggle"]');
        const manualFields = row.querySelector('[data-role="manual-fields"]');
        const manualInputs = row.querySelectorAll('[data-role="manual-fields"] input');
        const enabledCheckbox = row.querySelector('[data-role="enabled"]');
        const priorityInput = row.querySelector('[data-role="priority"]');
        const vpnSelect = row.querySelector('[data-role="vpn"]');
        const planToggleBtn = row.querySelector('[data-role="plan-toggle"]');
        const planBody = row.querySelector('[data-role="plan-body"]');

        async function saveConfig(patch) {
          try {
            await ctx.fetchJSON(`/api/randomizer/configs/${encodeURIComponent(username)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patch),
            });
          } catch (err) {
            alert(t('randomizer.saveFailed', { message: err.message }));
          }
        }

        enabledCheckbox.addEventListener('change', () => saveConfig({ enabled: enabledCheckbox.checked }));

        priorityInput.addEventListener('change', () => saveConfig({ priority: Number(priorityInput.value) }));

        vpnSelect.addEventListener('change', () => {
          const value = vpnSelect.value;
          saveConfig(value ? { vpnMode: 'profile', vpnProfileId: value } : { vpnMode: 'none', vpnProfileId: null });
        });

        willkurBtn.addEventListener('click', () => {
          const isWillkur = willkurBtn.classList.toggle('active');
          willkurBtn.textContent = `${t('randomizer.willkurBtnLabel')}: ${isWillkur ? t('randomizer.willkurOn') : t('randomizer.willkurOff')}`;
          manualFields.classList.toggle('disabled', isWillkur);
          manualInputs.forEach(input => { input.disabled = isWillkur; });
          saveConfig({ mode: isWillkur ? 'willkuer' : 'manual' });
        });

        ['hoursPerDay', 'blockCount', 'stadtwacheCount'].forEach(role => {
          const input = row.querySelector(`[data-role="${role}"]`);
          input.addEventListener('change', () => saveConfig({ [role]: Number(input.value) }));
        });

        planToggleBtn.addEventListener('click', async () => {
          if (!planBody.hidden) { planBody.hidden = true; return; }
          planBody.hidden = false;
          planBody.innerHTML = t('overview.loadingEllipsis');
          try {
            const { plan } = await ctx.fetchJSON(`/api/randomizer/plan/${encodeURIComponent(username)}`);
            planBody.innerHTML = planBodyHtml(plan);
          } catch (err) {
            planBody.innerHTML = t('analytics.loadError', { message: err.message });
          }
        });
      });
    }

    async function init() {
      try {
        [nodes, vpnProfileList] = await Promise.all([
          ctx.fetchJSON('/api/nodes'),
          ctx.fetchJSON('/api/vpn/profiles'),
        ]);
      } catch (err) {
        nodes = [];
        vpnProfileList = [];
      }
      await loadSettings();
      await loadAccounts();
    }

    init();
  },
};
