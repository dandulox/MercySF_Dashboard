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
          <button type="button" class="randomizer-willkur-btn" id="randomizer-hard-enforce-btn"></button>
          <button type="button" class="randomizer-willkur-btn" id="randomizer-recalculate-btn">${t('randomizer.recalculateBtn')}</button>
          <span id="randomizer-settings-status" class="muted"></span>
        </div>
        <p class="randomizer-hard-enforce-hint muted">${t('randomizer.hardEnforceHint')}</p>
        <p class="randomizer-hard-enforce-hint muted">${t('randomizer.recalculateHint')}</p>
      </section>

      <section class="card">
        <div class="card-header">
          <span>${t('randomizer.timelineTitle')}</span>
          <span id="randomizer-server-time" class="randomizer-server-time"></span>
          <button type="button" class="randomizer-plan-btn" id="randomizer-timeline-refresh-btn">${t('randomizer.refreshBtn')}</button>
        </div>
        <div id="randomizer-timeline" style="position:relative;"></div>
        <div class="randomizer-timeline-tooltip" id="randomizer-timeline-tooltip" hidden></div>
      </section>

      <section class="card">
        <div class="card-header"><span>${t('randomizer.accountsTitle')}</span></div>
        <div id="randomizer-accounts-list"></div>
      </section>
    `;
    container.appendChild(wrap);

    ctx.injectStyleOnce('randomizer-page', `
      .randomizer-page .page-hint { color: var(--muted); font-size: 12.5px; margin: -6px 0 14px; }
      .randomizer-settings-grid {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: start;
      }
      @media (max-width: 900px) {
        .randomizer-settings-grid { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 520px) {
        .randomizer-settings-grid { grid-template-columns: 1fr; }
      }
      .randomizer-settings-grid label { display: flex; flex-direction: column; gap: 4px; }
      .randomizer-settings-grid label .label-text {
        font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em;
        min-height: 28px; display: flex; align-items: flex-end; line-height: 1.3;
      }
      .randomizer-settings-grid input, .randomizer-settings-grid select {
        background: var(--input-bg); border: 1px solid var(--border); color: var(--text);
        border-radius: 8px; padding: 7px 10px; font-size: 13px; font-weight: 400; text-transform: none; letter-spacing: normal;
        width: 100%; box-sizing: border-box;
      }
      .randomizer-settings-grid select option, .randomizer-row-controls select option {
        background: var(--panel-2); color: var(--text);
      }
      .randomizer-settings-footer { display: flex; align-items: center; gap: 10px; margin-top: 16px; }
      .randomizer-settings-footer .btn { width: auto; padding: 8px 18px; }
      .randomizer-hard-enforce-hint { font-size: 11px; margin: 8px 0 0; }

      #randomizer-accounts-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
      @media (max-width: 900px) {
        #randomizer-accounts-list { grid-template-columns: 1fr; }
      }
      .randomizer-row {
        display: flex; flex-direction: column; gap: 10px; padding: 14px;
        background: var(--panel-2); border: 1px solid var(--border); border-radius: var(--radius-lg);
      }
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
        background: var(--panel); border: 1px solid var(--border); color: var(--text); border-radius: 8px;
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
      .randomizer-plan-body { font-size: 12px; color: var(--text); background: var(--panel); border-radius: 8px; padding: 10px 12px; }
      .randomizer-plan-body .muted { color: var(--muted); }
      .randomizer-plan-node { font-weight: 600; margin-bottom: 6px; }
      .randomizer-plan-list { list-style: none; margin: 4px 0 0; padding: 0; }
      .randomizer-plan-list li { padding: 2px 0; }
      .randomizer-page .empty-hint { color: var(--muted); font-size: 13px; padding: 20px 0; text-align: center; grid-column: 1 / -1; }

      .randomizer-unscheduled-warning {
        background: var(--panel-2); border: 1px solid var(--red); color: var(--red);
        border-radius: 6px; padding: 8px 12px; font-size: 13px; margin-bottom: 10px;
      }
      .randomizer-timeline-ruler { display: flex; margin-left: 160px; font-size: 10px; color: var(--muted); padding-bottom: 4px; }
      .randomizer-timeline-ruler span { flex: 1; text-align: left; }
      .randomizer-timeline-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
      .randomizer-timeline-label { width: 150px; flex-shrink: 0; font-size: 12px; }
      .randomizer-timeline-label .name { font-weight: 600; }
      .randomizer-timeline-label .pct { color: var(--muted); font-size: 11px; }
      .randomizer-timeline-track {
        position: relative; flex: 1; height: 22px; background: var(--panel);
        border: 1px solid var(--border); border-radius: 6px; overflow: hidden;
      }
      .randomizer-timeline-block {
        position: absolute; top: 0; bottom: 0; border-radius: 3px; cursor: default;
        opacity: 0.85; min-width: 2px;
      }
      .randomizer-timeline-block:hover { opacity: 1; }
      .randomizer-timeline-pulse {
        position: absolute; top: 3px; bottom: 3px; min-width: 3px; border-radius: 2px;
        background: var(--accent); cursor: default;
      }
      .randomizer-timeline-now {
        position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--red); z-index: 5;
      }
      .randomizer-timeline-tooltip {
        position: fixed; z-index: 300; background: var(--panel); border: 1px solid var(--border);
        border-radius: 6px; padding: 5px 9px; font-size: 12px; color: var(--text);
        box-shadow: 0 6px 18px rgba(0,0,0,0.35); pointer-events: none; white-space: nowrap;
      }
      .randomizer-server-time { font-size: 11px; color: var(--muted); font-weight: 400; white-space: nowrap; }
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

    const TIMEZONE_OPTIONS = [
      'UTC',
      'Europe/Berlin', 'Europe/London', 'Europe/Paris', 'Europe/Madrid', 'Europe/Rome',
      'Europe/Amsterdam', 'Europe/Warsaw', 'Europe/Moscow', 'Europe/Istanbul',
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
      'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore',
      'Australia/Sydney', 'Pacific/Auckland',
    ];

    function timezoneOptionsHtml(selected) {
      const options = TIMEZONE_OPTIONS.includes(selected) ? TIMEZONE_OPTIONS : [selected, ...TIMEZONE_OPTIONS];
      return options.map(tz =>
        `<option value="${escapeHtml(tz)}" ${tz === selected ? 'selected' : ''}>${escapeHtml(tz)}</option>`
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
      ['stadtwacheMinGapMinutes', 'randomizer.stadtwacheMinGap', 'number'],
      ['stadtwacheCutoff', 'randomizer.stadtwacheCutoff', 'text'],
    ];

    function renderHardEnforceBtn() {
      const btn = wrap.querySelector('#randomizer-hard-enforce-btn');
      const isHard = !!settings.hardEnforce;
      btn.classList.toggle('active', isHard);
      btn.textContent = `${t('randomizer.hardEnforceLabel')}: ${isHard ? t('randomizer.willkurOn') : t('randomizer.willkurOff')}`;
    }

    async function loadSettings() {
      settings = await ctx.fetchJSON('/api/randomizer/settings');
      const grid = wrap.querySelector('#randomizer-settings-grid');
      const timezoneField = `
        <label><span class="label-text">${t('randomizer.timezone')}</span>
          <select data-key="timezone">${timezoneOptionsHtml(settings.timezone)}</select>
        </label>
      `;
      const reserveField = `
        <label><span class="label-text">${t('randomizer.reserveNode')}</span>
          <select data-key="reserveNodeId">${nodeOptionsHtml(settings.reserveNodeId, true)}</select>
        </label>
      `;
      const otherFields = SETTINGS_FIELDS.map(([key, labelKey, type]) => `
        <label><span class="label-text">${t(labelKey)}</span>
          <input type="${type}" data-key="${key}" value="${escapeHtml(String(settings[key]))}" />
        </label>
      `).join('');
      grid.innerHTML = timezoneField + reserveField + otherFields;
      renderHardEnforceBtn();
    }

    wrap.querySelector('#randomizer-hard-enforce-btn').addEventListener('click', async () => {
      const status = wrap.querySelector('#randomizer-settings-status');
      try {
        settings = await ctx.fetchJSON('/api/randomizer/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hardEnforce: !settings.hardEnforce }),
        });
        renderHardEnforceBtn();
        status.textContent = t('randomizer.settingsSaved');
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    });

    wrap.querySelector('#randomizer-recalculate-btn').addEventListener('click', async () => {
      if (!confirm(t('randomizer.recalculateConfirm'))) return;
      const status = wrap.querySelector('#randomizer-settings-status');
      status.textContent = t('randomizer.recalculating');
      try {
        await ctx.fetchJSON('/api/randomizer/recalculate', { method: 'POST' });
        await loadTimeline();
        await loadAccounts();
        status.textContent = t('randomizer.recalculateDone');
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    });

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

    const TIMELINE_COLORS = ['#4f8cff', '#35c98f', '#f0b429', '#ff6b6b', '#a875ff', '#2dd4d4', '#ff9f43', '#e879f9'];
    const timelineColorByUsername = new Map();
    function colorFor(username) {
      if (!timelineColorByUsername.has(username)) {
        timelineColorByUsername.set(username, TIMELINE_COLORS[timelineColorByUsername.size % TIMELINE_COLORS.length]);
      }
      return timelineColorByUsername.get(username);
    }

    function timelineRowHtml(label, pctLabel, tracksHtml) {
      return `
        <div class="randomizer-timeline-row">
          <div class="randomizer-timeline-label">
            <div class="name">${escapeHtml(label)}</div>
            ${pctLabel !== null ? `<div class="pct">${pctLabel}</div>` : ''}
          </div>
          <div class="randomizer-timeline-track">${tracksHtml}</div>
        </div>
      `;
    }

    function nowMarkerHtml(nowMinutes) {
      return `<div class="randomizer-timeline-now" style="left:${(nowMinutes / 1440) * 100}%;" title="${t('randomizer.nowLabel')}"></div>`;
    }

    async function loadTimeline() {
      const el = wrap.querySelector('#randomizer-timeline');
      const serverTimeEl = wrap.querySelector('#randomizer-server-time');
      try {
        const timeline = await ctx.fetchJSON('/api/randomizer/timeline');
        timelineColorByUsername.clear();

        serverTimeEl.textContent = t('randomizer.serverTimeLabel', {
          time: fmtMinutes(timeline.nowMinutes),
          tz: timeline.timezone,
        });

        const ruler = `
          <div class="randomizer-timeline-ruler">
            ${['00', '04', '08', '12', '16', '20', '24'].map(h => `<span>${h}:00</span>`).join('')}
          </div>
        `;

        if (!timeline.nodes.length && !timeline.reserveNode) {
          el.innerHTML = `<p class="empty-hint">${t('randomizer.timelineEmpty')}</p>`;
          return;
        }

        const nodeRows = timeline.nodes.map(node => {
          const blocksHtml = node.accounts.map(acc => {
            const color = colorFor(acc.username);
            return acc.blocks.map(b => `
              <div class="randomizer-timeline-block" style="left:${(b.start / 1440) * 100}%; width:${((b.end - b.start) / 1440) * 100}%; background:${color};" data-tip="${escapeHtml(acc.username)}: ${fmtMinutes(b.start)}–${fmtMinutes(b.end)}"></div>
            `).join('');
          }).join('');
          return timelineRowHtml(node.name, `${node.utilizationPct}%`, blocksHtml + nowMarkerHtml(timeline.nowMinutes));
        }).join('');

        const reserveRow = timeline.reserveNode
          ? timelineRowHtml(
              `${timeline.reserveNode.name} (${t('randomizer.stadtwacheLabel')})`,
              null,
              timeline.reserveNode.pulses.map(p => `
                <div class="randomizer-timeline-pulse" style="left:${(p.at / 1440) * 100}%; width:${((p.end - p.at) / 1440) * 100}%;" data-tip="${escapeHtml(p.username)}: ${fmtMinutes(p.at)}"></div>
              `).join('') + nowMarkerHtml(timeline.nowMinutes)
            )
          : '';

        const unscheduledHtml = timeline.unscheduled && timeline.unscheduled.length
          ? `<div class="randomizer-unscheduled-warning">${t('randomizer.unscheduledWarning', { count: timeline.unscheduled.length, names: timeline.unscheduled.map(escapeHtml).join(', ') })}</div>`
          : '';

        el.innerHTML = unscheduledHtml + ruler + nodeRows + reserveRow;
      } catch (err) {
        el.innerHTML = `<p class="empty-hint">${t('analytics.loadError', { message: err.message })}</p>`;
      }
    }

    wrap.querySelector('#randomizer-timeline-refresh-btn').addEventListener('click', loadTimeline);

    // Custom Tooltip statt title-Attribut — bei den dicht gepackten, teils wenige Pixel breiten
    // Timeline-Segmenten reagiert das native Browser-Tooltip zu träge/unzuverlässig.
    const timelineEl = wrap.querySelector('#randomizer-timeline');
    const tooltipEl = wrap.querySelector('#randomizer-timeline-tooltip');
    timelineEl.addEventListener('mouseover', (ev) => {
      const target = ev.target.closest('[data-tip]');
      if (target) {
        tooltipEl.textContent = target.dataset.tip;
        tooltipEl.hidden = false;
      } else {
        tooltipEl.hidden = true;
      }
    });
    timelineEl.addEventListener('mousemove', (ev) => {
      if (tooltipEl.hidden) return;
      tooltipEl.style.left = `${ev.clientX + 14}px`;
      tooltipEl.style.top = `${ev.clientY + 14}px`;
    });
    timelineEl.addEventListener('mouseleave', () => { tooltipEl.hidden = true; });

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
      await loadTimeline();
    }

    init();
  },
};
