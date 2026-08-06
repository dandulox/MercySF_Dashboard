function fmt(n) {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightCharName(escapedLine, charName) {
  if (!charName) return escapedLine;
  const re = new RegExp(escapeRegExp(escapeHtml(charName)), 'g');
  return escapedLine.replace(re, m => `<span class="char-name">${m}</span>`);
}

export default {
  id: 'overview',
  label: 'Overview',
  icon: '▦',
  mount(container, ctx) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <h1 class="page-title">Overview</h1>
      <section class="card" id="no-data-card" style="display:none">
        <p>Noch keine Account-Daten gefunden. Logg dich über die Konsole ein — sobald ein Account läuft, erscheinen hier automatisch echte Live-Daten.</p>
      </section>
      <section class="card accounts-card">
        <div class="card-header">
          <span>👥 Accounts</span>
          <span id="accounts-running" class="muted"></span>
        </div>
        <table class="accounts-table">
          <thead>
            <tr>
              <th>ACCOUNT</th><th>SERVER</th><th>LEVEL</th><th>SILBER</th><th>PILZE</th>
              <th>EHRE</th><th>RANG</th><th>ARENA HEUTE</th><th>DUNGEON HEUTE</th>
            </tr>
          </thead>
          <tbody id="accounts-table-body"></tbody>
        </table>
      </section>
      <section class="stat-grid" id="stat-grid"></section>
      <section class="card" id="equipment-card">
        <div class="card-header">
          <span>🛡 Ausrüstung</span>
          <button class="icon-btn" id="equipment-refresh-btn" title="Aktualisieren">⟳</button>
        </div>
        <div id="equipment-body" class="muted">Wähle einen Account, um die Ausrüstung zu sehen.</div>
      </section>
      <section class="card">
        <div class="card-header">📜 Activity Log</div>
        <div id="activity-log" class="activity-log">Wähle einen Account, um das Log zu sehen.</div>
      </section>
    `;
    container.appendChild(wrap);

    ctx.injectStyleOnce('overview-equipment', `
      .equip-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
      .equip-slot { background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
      .equip-slot-name { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
      .equip-slot-type { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
      .equip-slot-attrs { font-size: 12px; color: var(--text); line-height: 1.5; }
      .equip-slot-meta { font-size: 11px; color: var(--muted); margin-top: 6px; }
    `);

    async function renderAccountsTable(accounts) {
      const body = wrap.querySelector('#accounts-table-body');
      wrap.querySelector('#accounts-running').textContent = `${accounts.length} Account(s)`;
      body.innerHTML = '';
      accounts.forEach(acc => {
        const s = acc.stats || {};
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="acc-name char-name">${acc.charName}</td>
          <td>${acc.server}</td>
          <td>${s.level ?? '—'}</td>
          <td>${fmt(s.silver)}</td>
          <td>${s.mushrooms ?? '—'}</td>
          <td>${fmt(s.honor)}</td>
          <td>${fmt(s.rank)}</td>
          <td>${s.arena_fights_today ?? '—'}</td>
          <td>${s.dungeon_fights_today ?? '—'}</td>
        `;
        body.appendChild(tr);
      });
    }

    function renderStatCards(account) {
      const grid = wrap.querySelector('#stat-grid');
      grid.innerHTML = '';
      if (!account || !account.stats) return;
      const s = account.stats;
      [['LEVEL', s.level], ['SILBER', fmt(s.silver)], ['PILZE', s.mushrooms], ['EHRE', fmt(s.honor)], ['RANG', fmt(s.rank)]]
        .forEach(([label, value]) => {
          const div = document.createElement('div');
          div.className = 'stat-card';
          div.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value ?? '—'}</div>`;
          grid.appendChild(div);
        });
    }

    async function renderLog(accountId, charName) {
      const logEl = wrap.querySelector('#activity-log');
      if (!accountId) { logEl.textContent = 'Wähle einen Account, um das Log zu sehen.'; return; }
      const lines = await ctx.fetchJSON(`/api/account/${encodeURIComponent(accountId)}/logs`);
      if (!lines.length) { logEl.textContent = 'Keine Log-Einträge gefunden.'; return; }
      logEl.innerHTML = lines.map(l => `<div class="line">${highlightCharName(escapeHtml(l), charName)}</div>`).join('');
    }

    let lastAccounts = [];
    function getCurrentProfileId() {
      const accountId = ctx.getAccountId();
      const current = lastAccounts.find(a => a.id === accountId);
      return current ? current.profileId : null;
    }

    async function renderEquipment(profileId) {
      const el = wrap.querySelector('#equipment-body');
      if (!profileId) { el.textContent = 'Wähle einen Account, um die Ausrüstung zu sehen.'; return; }
      el.textContent = 'Lade Ausrüstung…';
      try {
        const data = await ctx.fetchJSON(`/api/equipment/${encodeURIComponent(profileId)}`);
        if (!data.items.length) { el.textContent = 'Keine Ausrüstung gefunden.'; return; }
        el.innerHTML = `<div class="equip-grid">${data.items.map(item => `
          <div class="equip-slot">
            <div class="equip-slot-name">${escapeHtml(item.slot)}</div>
            <div class="equip-slot-type">${escapeHtml(item.itemType)}</div>
            <div class="equip-slot-attrs">${Object.entries(item.attributes).map(([k, v]) => `${escapeHtml(k)}: ${v}`).join('<br>') || '—'}</div>
            <div class="equip-slot-meta">Qualität ${item.itemQuality} · +${item.upgradeCount}</div>
          </div>`).join('')}</div>`;
      } catch (err) {
        el.textContent = 'Fehler: ' + err.message;
      }
    }

    async function render() {
      const accounts = await ctx.fetchJSON('/api/accounts');
      lastAccounts = accounts;
      wrap.querySelector('#no-data-card').style.display = accounts.length ? 'none' : 'block';
      const accountId = ctx.getAccountId();
      await renderAccountsTable(accounts);
      const current = accounts.find(a => a.id === accountId);
      renderStatCards(current);
      await renderLog(accountId, current ? current.charName : null);
    }

    render().then(() => renderEquipment(getCurrentProfileId()));
    const unsub = ctx.onAccountChange(render);
    const interval = setInterval(render, 5000);

    const unsubEquipment = ctx.onAccountChange(() => renderEquipment(getCurrentProfileId()));
    wrap.querySelector('#equipment-refresh-btn').addEventListener('click', () => renderEquipment(getCurrentProfileId()));

    return () => { unsub(); unsubEquipment(); clearInterval(interval); };
  }
};
