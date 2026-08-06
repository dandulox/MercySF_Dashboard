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
      <section class="card">
        <div class="card-header">📜 Activity Log</div>
        <div id="activity-log" class="activity-log">Wähle einen Account, um das Log zu sehen.</div>
      </section>
    `;
    container.appendChild(wrap);

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

    async function render() {
      const accounts = await ctx.fetchJSON('/api/accounts');
      wrap.querySelector('#no-data-card').style.display = accounts.length ? 'none' : 'block';
      const accountId = ctx.getAccountId();
      await renderAccountsTable(accounts);
      const current = accounts.find(a => a.id === accountId);
      renderStatCards(current);
      await renderLog(accountId, current ? current.charName : null);
    }

    render();
    const unsub = ctx.onAccountChange(render);
    const interval = setInterval(render, 5000);
    return () => { unsub(); clearInterval(interval); };
  }
};
