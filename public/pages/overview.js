function fmt(n) {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// CLI/API liefern den Geldwert in Silber, im Spiel wird aber in Gold gerechnet (100 Silber = 1 Gold).
function toGold(silver) {
  if (silver === undefined || silver === null) return null;
  return Math.round(silver / 100);
}

function fmtDuration(sec) {
  if (!sec) return '0 Min';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} Std ${m} Min` : `${m} Min`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightCharName(escapedLine, charName) {
  if (!charName) return escapedLine;
  const re = new RegExp(escapeRegExp(escapeHtml(charName)), 'g');
  return escapedLine.replace(re, m => `<span class="char-name">${m}</span>`);
}

function makeCollapsible(cardEl, storageKey) {
  const header = cardEl.querySelector('.card-header');
  if (!header) return;
  const chevron = document.createElement('span');
  chevron.className = 'card-chevron';
  chevron.textContent = '▾';
  header.appendChild(chevron);

  if (localStorage.getItem(`mercy-card-collapsed-${storageKey}`) === '1') {
    cardEl.classList.add('collapsed');
  }

  header.addEventListener('click', (ev) => {
    if (ev.target.closest('button')) return;
    cardEl.classList.toggle('collapsed');
    localStorage.setItem(`mercy-card-collapsed-${storageKey}`, cardEl.classList.contains('collapsed') ? '1' : '0');
  });
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
      <section class="card collapsible-card" id="nodes-overview-card" style="display:none">
        <div class="card-header">
          <span>🖧 Nodes</span>
          <span id="nodes-overview-count" class="muted"></span>
        </div>
        <div id="nodes-overview-list"></div>
      </section>
      <section class="card collapsible-card accounts-card" id="accounts-card">
        <div class="card-header">
          <span>👥 Accounts</span>
          <span id="accounts-running" class="muted"></span>
        </div>
        <div class="table-scroll">
          <table class="accounts-table">
            <thead>
              <tr>
                <th>ACCOUNT</th><th>SERVER</th><th>LEVEL</th><th>GOLD</th><th>PILZE</th>
                <th>EHRE</th><th>RANG</th><th>ARENA HEUTE</th><th>DUNGEON HEUTE</th>
              </tr>
            </thead>
            <tbody id="accounts-table-body"></tbody>
          </table>
        </div>
        <div class="accounts-pagination">
          <div class="pagination-pagesize">
            <label for="accounts-pagesize">Pro Seite</label>
            <select id="accounts-pagesize">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="all">Alle</option>
            </select>
          </div>
          <div class="pagination-controls">
            <button type="button" class="icon-btn" id="accounts-prev-btn" title="Vorherige Seite">‹</button>
            <span id="accounts-page-label" class="muted"></span>
            <button type="button" class="icon-btn" id="accounts-next-btn" title="Nächste Seite">›</button>
          </div>
        </div>
      </section>
      <div class="gamestate-grid">
        <section class="card collapsible-card" id="character-card">
          <div class="card-header">
            <span>🧙 Charakter</span>
            <button class="icon-btn" id="gamestate-refresh-btn" title="Ausrüstung, Gilde, Taverne & Mail aktualisieren">⟳</button>
          </div>
          <div class="stat-grid" id="stat-grid"></div>
          <div id="daily-earnings-body" class="daily-earnings"></div>
        </section>
        <section class="card collapsible-card" id="equipment-card">
          <div class="card-header"><span>🛡 Ausrüstung</span></div>
          <div id="equipment-body" class="muted">Wähle einen Account, um die Ausrüstung zu sehen.</div>
        </section>
        <section class="card collapsible-card span-2" id="tavern-card">
          <div class="card-header"><span>🍺 Taverne</span></div>
          <div id="tavern-body" class="muted">Wähle einen Account, um Tavernendaten zu sehen.</div>
        </section>
        <section class="card collapsible-card" id="guild-card">
          <div class="card-header"><span>🏰 Gilde</span></div>
          <div id="guild-body" class="muted">Wähle einen Account, um Gildendaten zu sehen.</div>
        </section>
        <section class="card collapsible-card" id="mail-card">
          <div class="card-header"><span>✉ Mail</span></div>
          <div id="mail-body" class="muted">Wähle einen Account, um die Mail zu sehen.</div>
        </section>
      </div>
      <section class="card collapsible-card" id="battle-history-card">
        <div class="card-header">
          <span>⚔ Kampfhistorie</span>
          <button class="icon-btn" id="battle-history-refresh-btn" title="Kampfhistorie aktualisieren">⟳</button>
        </div>
        <div id="battle-history-body" class="muted">Wähle einen Account, um die Kampfhistorie zu sehen.</div>
      </section>
      <section class="card collapsible-card" id="activity-log-card">
        <div class="card-header"><span>📜 Activity Log</span></div>
        <div id="activity-log" class="activity-log">Wähle einen Account, um das Log zu sehen.</div>
      </section>
    `;
    container.appendChild(wrap);

    ctx.injectStyleOnce('overview-gamestate', `
      .gamestate-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
      .gamestate-grid .span-2 { grid-column: 1 / -1; }
      .gamestate-grid .stat-grid { grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); margin-bottom: 0; }
      @media (max-width: 900px) {
        .gamestate-grid { grid-template-columns: 1fr; }
      }

      .accounts-pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; }
      .pagination-pagesize { display: flex; align-items: center; gap: 6px; color: var(--muted); }
      .pagination-pagesize select { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 3px 6px; font-size: 12px; }
      .pagination-controls { display: flex; align-items: center; gap: 8px; }
      .pagination-controls .icon-btn { width: 26px; height: 26px; }
      .pagination-controls .icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

      .collapsible-card .card-header { cursor: pointer; user-select: none; }
      .collapsible-card .card-chevron { margin-left: auto; opacity: 0.6; font-size: 11px; transition: transform .15s; }
      .collapsible-card.collapsed .card-chevron { transform: rotate(-90deg); }
      .collapsible-card.collapsed > *:not(.card-header) { display: none; }

      .alu-bar-wrap { margin-bottom: 12px; }
      .alu-bar-label { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 5px; }
      .alu-bar-track { background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; height: 10px; overflow: hidden; }
      .alu-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent, #4f8cff), #7a5cff); border-radius: 6px; transition: width .3s; }

      .equip-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
      .equip-slot { background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px; min-width: 0; overflow-wrap: break-word; }
      .equip-slot-name { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
      .equip-slot-type { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
      .equip-slot-attrs { font-size: 12px; color: var(--text); line-height: 1.5; }
      .equip-slot-meta { font-size: 11px; color: var(--muted); margin-top: 6px; }

      .guild-summary, .tavern-summary, .mail-summary { font-size: 13px; margin-bottom: 10px; overflow-wrap: break-word; }
      .guild-member-list { max-height: 320px; overflow-y: auto; }
      .guild-member-row, .tavern-quest-row, .mail-row {
        display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 10px; font-size: 13px;
        padding: 6px 0; border-bottom: 1px solid var(--border);
      }
      .guild-member-row span, .tavern-quest-row span, .mail-row span { overflow-wrap: break-word; min-width: 0; }
      .guild-member-row:last-child, .tavern-quest-row:last-child, .mail-row:last-child { border-bottom: none; }
      .mail-row.unread { font-weight: 600; }
      .link-btn-inline { background: none; border: none; color: var(--accent, #4f8cff); cursor: pointer; font-size: 12px; padding: 8px 0 0; text-decoration: underline; text-underline-offset: 2px; }

      .daily-earnings { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); }
      .daily-earnings-title { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
      .daily-earnings-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .daily-earnings-table th {
        text-align: right; color: var(--muted); font-size: 10px; text-transform: uppercase;
        letter-spacing: 0.03em; font-weight: 600; padding: 0 6px 6px;
      }
      .daily-earnings-table th:first-child { text-align: left; }
      .daily-earnings-table td {
        text-align: right; padding: 6px; border-top: 1px solid var(--border); font-weight: 600; white-space: nowrap;
      }
      .daily-earnings-table td.de-label { text-align: left; color: var(--muted); font-weight: 400; }
      .daily-levelups { margin-top: 10px; font-size: 12.5px; color: var(--muted); }
      .battle-history-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
      .battle-history-table th {
        text-align: left; color: var(--muted); font-weight: 600; font-size: 11px;
        letter-spacing: 0.03em; padding: 6px 10px; border-bottom: 1px solid var(--border);
      }
      .battle-history-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
      .battle-history-table tr:last-child td { border-bottom: none; }
      .battle-result { font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 999px; }
      .battle-result.win { background: rgba(53,201,143,0.15); color: var(--green); }
      .battle-result.loss { background: rgba(239,85,99,0.15); color: var(--red); }
      .battle-history-note { font-size: 11px; color: var(--muted); margin-top: 8px; }
      .positive { color: var(--green); }
      .negative { color: var(--red); }

      .node-overview-row {
        display: flex; align-items: center; gap: 12px; padding: 10px 4px; cursor: pointer;
        border-bottom: 1px solid var(--border);
      }
      .node-overview-row:last-child { border-bottom: none; }
      .node-overview-row:hover { background: var(--panel-2); }
      .node-overview-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
      .node-overview-dot.online { background: var(--green); box-shadow: 0 0 6px var(--green); }
      .node-overview-dot.offline { background: var(--red); }
      .node-overview-name { font-weight: 600; font-size: 13.5px; flex: 1; }
      .node-overview-meta { font-size: 11.5px; color: var(--muted); }
      .node-overview-caret { font-size: 11px; color: var(--muted); transition: transform .15s; }
      .node-overview-row.expanded .node-overview-caret { transform: rotate(90deg); }
      .node-overview-accounts { display: none; padding: 0 4px 10px 24px; }
      .node-overview-accounts.open { display: block; }
      .node-overview-accounts table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
      .node-overview-accounts th { text-align: left; color: var(--muted); font-size: 10.5px; text-transform: uppercase; padding: 4px 8px; }
      .node-overview-accounts td { padding: 4px 8px; }
      .node-overview-empty { padding: 4px 8px; color: var(--muted); font-size: 12px; }
    `);

    let accountsPage = 0;
    let accountsPageSize = localStorage.getItem('mercy-accounts-pagesize') || '5';

    function totalAccountsPages(total) {
      if (accountsPageSize === 'all') return 1;
      return Math.max(1, Math.ceil(total / parseInt(accountsPageSize, 10)));
    }

    async function renderAccountsTable(accounts) {
      const body = wrap.querySelector('#accounts-table-body');
      wrap.querySelector('#accounts-running').textContent = `${accounts.length} Account(s)`;

      const totalPages = totalAccountsPages(accounts.length);
      if (accountsPage >= totalPages) accountsPage = totalPages - 1;
      if (accountsPage < 0) accountsPage = 0;

      const pageItems = accountsPageSize === 'all'
        ? accounts
        : accounts.slice(accountsPage * parseInt(accountsPageSize, 10), (accountsPage + 1) * parseInt(accountsPageSize, 10));

      body.innerHTML = '';
      pageItems.forEach(acc => {
        const s = acc.stats || {};
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="acc-name char-name">${acc.charName}</td>
          <td>${acc.server}</td>
          <td>${s.level ?? '—'}</td>
          <td>${fmt(toGold(s.silver))}</td>
          <td>${s.mushrooms ?? '—'}</td>
          <td>${fmt(s.honor)}</td>
          <td>${fmt(s.rank)}</td>
          <td>${s.arena_fights_today ?? '—'}</td>
          <td>${s.dungeon_fights_today ?? '—'}</td>
        `;
        body.appendChild(tr);
      });

      const pageLabel = wrap.querySelector('#accounts-page-label');
      const prevBtn = wrap.querySelector('#accounts-prev-btn');
      const nextBtn = wrap.querySelector('#accounts-next-btn');
      pageLabel.textContent = accountsPageSize === 'all' ? '' : `Seite ${accountsPage + 1} / ${totalPages}`;
      prevBtn.disabled = accountsPage <= 0 || accountsPageSize === 'all';
      nextBtn.disabled = accountsPage >= totalPages - 1 || accountsPageSize === 'all';
    }

    function renderStatCards(account) {
      const grid = wrap.querySelector('#stat-grid');
      grid.innerHTML = '';
      if (!account || !account.stats) return;
      const s = account.stats;
      [['LEVEL', s.level], ['GOLD', fmt(toGold(s.silver))], ['PILZE', s.mushrooms], ['EHRE', fmt(s.honor)], ['RANG', fmt(s.rank)]]
        .forEach(([label, value]) => {
          const div = document.createElement('div');
          div.className = 'stat-card';
          div.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value ?? '—'}</div>`;
          grid.appendChild(div);
        });
    }

    function signed(n) {
      return `${n >= 0 ? '+' : ''}${n}`;
    }

    function mondayOf(date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    function fmtDateISO(d) {
      return d.toISOString().slice(0, 10);
    }

    async function renderDailyEarnings(accountId) {
      const el = wrap.querySelector('#daily-earnings-body');
      if (!accountId) { el.innerHTML = ''; return; }
      try {
        const daily = await ctx.fetchJSON(`/api/stats/${encodeURIComponent(accountId)}/daily?days=15`);
        const todayDate = new Date().toISOString().slice(0, 10);
        const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const empty = { expGained: 0, silverGained: 0, honorGained: 0, levelsGained: 0 };
        const today = daily.find(d => d.date === todayDate) || empty;
        const yesterday = daily.find(d => d.date === yesterdayDate) || empty;

        const now = new Date();
        const thisMonday = fmtDateISO(mondayOf(now));
        const lastMonday = fmtDateISO((() => { const d = mondayOf(now); d.setDate(d.getDate() - 7); return d; })());
        const tomorrow = fmtDateISO(new Date(now.getTime() + 86400000));

        function sumRange(field, fromInclusive, toExclusive) {
          return daily
            .filter(d => d.date >= fromInclusive && d.date < toExclusive)
            .reduce((acc, d) => acc + (d[field] || 0), 0);
        }

        function tableRow(field, label, convert) {
          const conv = convert || (n => n);
          const heute = conv(today[field]);
          const gestern = conv(yesterday[field]);
          const dieseWoche = conv(sumRange(field, thisMonday, tomorrow));
          const letzteWoche = conv(sumRange(field, lastMonday, thisMonday));
          return `<tr>
            <td class="de-label">${label}</td>
            <td>${signed(heute)}</td>
            <td>${signed(gestern)}</td>
            <td>${signed(dieseWoche)}</td>
            <td>${signed(letzteWoche)}</td>
          </tr>`;
        }

        el.innerHTML = `
          <div class="daily-earnings-title">📅 Erträge</div>
          <div class="table-scroll">
            <table class="daily-earnings-table">
              <thead>
                <tr><th></th><th>Heute</th><th>Gestern</th><th>Diese Woche</th><th>Letzte Woche</th></tr>
              </thead>
              <tbody>
                ${tableRow('expGained', 'EP')}
                ${tableRow('silverGained', 'Gold', toGold)}
                ${tableRow('honorGained', 'Ehre')}
              </tbody>
            </table>
          </div>
          <div class="daily-levelups">Level-Ups heute: <strong>${today.levelsGained}</strong></div>
        `;
      } catch (err) {
        el.textContent = 'Fehler: ' + err.message;
      }
    }

    async function renderLog(accountId, charName) {
      const logEl = wrap.querySelector('#activity-log');
      if (!accountId) { logEl.textContent = 'Wähle einen Account, um das Log zu sehen.'; return; }
      const lines = await ctx.fetchJSON(`/api/account/${encodeURIComponent(accountId)}/logs`);
      if (!lines.length) { logEl.textContent = 'Keine Log-Einträge gefunden.'; return; }
      logEl.innerHTML = lines.map(l => `<div class="line">${highlightCharName(escapeHtml(l), charName)}</div>`).join('');
    }

    const BATTLE_KIND_LABELS = { arena: 'Arena', dungeon: 'Dungeon', scrapbook: 'Sammelalbum' };

    async function renderBattleHistory(accountId) {
      const el = wrap.querySelector('#battle-history-body');
      if (!accountId) { el.textContent = 'Wähle einen Account, um die Kampfhistorie zu sehen.'; return; }
      el.textContent = 'Lade…';
      try {
        const data = await ctx.fetchJSON(`/api/history/${encodeURIComponent(accountId)}?limit=20`);
        if (!data.battles.length) { el.textContent = 'Noch keine Kämpfe aufgezeichnet.'; return; }
        el.innerHTML = `
          <div class="table-scroll">
            <table class="battle-history-table">
              <thead><tr><th>Zeit</th><th>Gegner</th><th>Typ</th><th>Ergebnis</th><th>EP</th><th>Silber</th><th>Ehre</th></tr></thead>
              <tbody>${data.battles.map(b => `
                <tr>
                  <td class="muted">${new Date(b.timestamp).toLocaleString('de-DE')}</td>
                  <td class="char-name">${escapeHtml(b.enemy_name || '—')}</td>
                  <td>${BATTLE_KIND_LABELS[b.kind] || escapeHtml(b.kind || '—')}</td>
                  <td><span class="battle-result ${b.won ? 'win' : 'loss'}">${b.won ? 'Sieg' : 'Niederlage'}</span></td>
                  <td class="${b.xp >= 0 ? 'positive' : 'negative'}">${b.xp >= 0 ? '+' : ''}${b.xp}</td>
                  <td class="${b.silver >= 0 ? 'positive' : 'negative'}">${b.silver >= 0 ? '+' : ''}${b.silver}</td>
                  <td class="${b.honor >= 0 ? 'positive' : 'negative'}">${b.honor >= 0 ? '+' : ''}${b.honor}</td>
                </tr>`).join('')}</tbody>
            </table>
          </div>
          <div class="battle-history-note">${data.returned} von ${data.total} aufgezeichneten Kämpfen — lokal von der CLI erfasst, nicht vom Spieleserver.</div>
        `;
      } catch (err) {
        el.textContent = 'Fehler: ' + err.message;
      }
    }

    const expandedNodes = new Set();

    async function renderNodesOverview(accounts) {
      const card = wrap.querySelector('#nodes-overview-card');
      const list = wrap.querySelector('#nodes-overview-list');
      let nodes;
      try {
        nodes = await ctx.fetchJSON('/api/nodes');
      } catch (err) {
        card.style.display = 'none';
        return;
      }
      if (!nodes.length) { card.style.display = 'none'; return; }
      card.style.display = '';
      wrap.querySelector('#nodes-overview-count').textContent = `${nodes.length} Node${nodes.length === 1 ? '' : 's'}`;

      list.innerHTML = nodes.map(n => {
        const nodeAccounts = accounts.filter(a => a.nodeId === n.id);
        const expanded = expandedNodes.has(n.id);
        return `
          <div class="node-overview-row ${expanded ? 'expanded' : ''}" data-id="${n.id}">
            <span class="node-overview-caret">▸</span>
            <span class="node-overview-dot ${n.lastStatus === 'online' ? 'online' : 'offline'}"></span>
            <span class="node-overview-name char-name">${escapeHtml(n.name)}</span>
            <span class="node-overview-meta">${nodeAccounts.length} Account${nodeAccounts.length === 1 ? '' : 's'}</span>
          </div>
          <div class="node-overview-accounts ${expanded ? 'open' : ''}" data-accounts-for="${n.id}">
            ${nodeAccounts.length ? `
              <table>
                <thead><tr><th>Account</th><th>Level</th><th>Gold</th><th>Ehre</th></tr></thead>
                <tbody>${nodeAccounts.map(a => `
                  <tr>
                    <td class="char-name">${escapeHtml(a.charName)}</td>
                    <td>${a.stats?.level ?? '—'}</td>
                    <td>${fmt(toGold(a.stats?.silver))}</td>
                    <td>${fmt(a.stats?.honor)}</td>
                  </tr>`).join('')}</tbody>
              </table>` : '<div class="node-overview-empty">Noch keine Daten von diesem Node — Account dort starten, um Statistiken zu sehen.</div>'}
          </div>
        `;
      }).join('');

      list.querySelectorAll('.node-overview-row').forEach(row => {
        row.addEventListener('click', () => {
          const id = row.dataset.id;
          const accountsEl = list.querySelector(`[data-accounts-for="${id}"]`);
          if (expandedNodes.has(id)) {
            expandedNodes.delete(id);
            row.classList.remove('expanded');
            accountsEl.classList.remove('open');
          } else {
            expandedNodes.add(id);
            row.classList.add('expanded');
            accountsEl.classList.add('open');
          }
        });
      });
    }

    let lastAccounts = [];
    function getCurrentProfileId() {
      const accountId = ctx.getAccountId();
      const current = lastAccounts.find(a => a.id === accountId);
      return current ? current.profileId : null;
    }

    function renderEquipmentBody(items) {
      const el = wrap.querySelector('#equipment-body');
      if (!items.length) { el.textContent = 'Keine Ausrüstung gefunden.'; return; }
      el.innerHTML = `<div class="equip-grid">${items.map(item => `
        <div class="equip-slot">
          <div class="equip-slot-name">${escapeHtml(item.slot)}</div>
          <div class="equip-slot-type">${escapeHtml(item.itemType)}</div>
          <div class="equip-slot-attrs">${Object.entries(item.attributes).map(([k, v]) => `${escapeHtml(k)}: ${v}`).join('<br>') || '—'}</div>
          <div class="equip-slot-meta">Qualität ${item.itemQuality} · +${item.upgradeCount}</div>
        </div>`).join('')}</div>`;
    }

    function renderGuildMemberRows(members) {
      return members.map(m => `
        <div class="guild-member-row">
          <span>${escapeHtml(m.name)}</span>
          <span class="muted">Lvl ${m.level} · ${escapeHtml(m.guildRank)}</span>
        </div>`).join('');
    }

    function renderGuildBody(guild) {
      const el = wrap.querySelector('#guild-body');
      if (!guild) { el.textContent = 'Kein Gildenmitglied.'; return; }
      const VISIBLE = 8;
      const hiddenCount = Math.max(0, guild.members.length - VISIBLE);
      el.innerHTML = `
        <div class="guild-summary"><strong>${escapeHtml(guild.name)}</strong> · Ehre ${fmt(guild.honor)} · Rang ${guild.rank} · ${guild.memberCount} Mitglieder</div>
        <div class="guild-member-list" id="guild-member-list">${renderGuildMemberRows(guild.members.slice(0, VISIBLE))}</div>
        ${hiddenCount > 0 ? `<button type="button" class="link-btn-inline" id="guild-show-all-btn">+${hiddenCount} weitere anzeigen</button>` : ''}
      `;
      const showAllBtn = el.querySelector('#guild-show-all-btn');
      if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
          el.querySelector('#guild-member-list').innerHTML = renderGuildMemberRows(guild.members);
          showAllBtn.remove();
        });
      }
    }

    function renderTavernBody(tavern) {
      const el = wrap.querySelector('#tavern-body');
      const action = escapeHtml((tavern.currentAction || '').split(' ')[0] || '—');
      const aluPct = tavern.adventurePointsMax
        ? Math.max(0, Math.min(100, Math.round((tavern.adventurePoints / tavern.adventurePointsMax) * 100)))
        : 0;
      el.innerHTML = `
        <div class="alu-bar-wrap">
          <div class="alu-bar-label"><span>⚡ Abenteuerlust</span><span>${tavern.adventurePoints}/${tavern.adventurePointsMax}</span></div>
          <div class="alu-bar-track"><div class="alu-bar-fill" style="width:${aluPct}%"></div></div>
        </div>
        <div class="tavern-summary">🍺 ${tavern.beerDrunk}/${tavern.beerMax} · Aktion: ${action}</div>
        ${tavern.quests.map(q => `
          <div class="tavern-quest-row">
            <span>${escapeHtml(q.location)}</span>
            <span class="muted">${fmt(toGold(q.baseSilver))} Gold · ${fmt(q.baseExperience)} XP · ${fmtDuration(q.baseLengthSec)}</span>
          </div>`).join('')}
      `;
    }

    function renderMailBody(mail) {
      const el = wrap.querySelector('#mail-body');
      if (!mail.recent.length) { el.textContent = `Postfach leer (0/${mail.inboxCapacity}).`; return; }
      el.innerHTML = `
        <div class="mail-summary">${mail.unreadCount} ungelesen · ${mail.recent.length}/${mail.inboxCapacity} im Postfach</div>
        ${mail.recent.map(entry => `
          <div class="mail-row ${entry.read ? '' : 'unread'}">
            <span>${escapeHtml(entry.title || '(kein Betreff)')}</span>
            <span class="muted">von ${escapeHtml(entry.from)} · ${new Date(entry.date).toLocaleString('de-DE')}</span>
          </div>`).join('')}
      `;
    }

    async function renderGameState(profileId) {
      const equipEl = wrap.querySelector('#equipment-body');
      const guildEl = wrap.querySelector('#guild-body');
      const tavernEl = wrap.querySelector('#tavern-body');
      const mailEl = wrap.querySelector('#mail-body');
      if (!profileId) {
        equipEl.textContent = 'Wähle einen Account, um die Ausrüstung zu sehen.';
        guildEl.textContent = 'Wähle einen Account, um Gildendaten zu sehen.';
        tavernEl.textContent = 'Wähle einen Account, um Tavernendaten zu sehen.';
        mailEl.textContent = 'Wähle einen Account, um die Mail zu sehen.';
        return;
      }
      equipEl.textContent = 'Lade…';
      guildEl.textContent = 'Lade…';
      tavernEl.textContent = 'Lade…';
      mailEl.textContent = 'Lade…';
      try {
        const data = await ctx.fetchJSON(`/api/gamestate/${encodeURIComponent(profileId)}`);
        renderEquipmentBody(data.equipment);
        renderGuildBody(data.guild);
        renderTavernBody(data.tavern);
        renderMailBody(data.mail);
      } catch (err) {
        const msg = 'Fehler: ' + err.message;
        equipEl.textContent = msg;
        guildEl.textContent = msg;
        tavernEl.textContent = msg;
        mailEl.textContent = msg;
      }
    }

    async function render() {
      const accounts = await ctx.fetchJSON('/api/accounts');
      lastAccounts = accounts;
      wrap.querySelector('#no-data-card').style.display = accounts.length ? 'none' : 'block';
      const accountId = ctx.getAccountId();
      await renderAccountsTable(accounts);
      await renderNodesOverview(accounts);
      const current = accounts.find(a => a.id === accountId);
      renderStatCards(current);
      await renderDailyEarnings(accountId);
      await renderLog(accountId, current ? current.charName : null);
    }

    render().then(() => renderGameState(getCurrentProfileId()));
    const unsub = ctx.onAccountChange(render);
    const interval = setInterval(render, 5000);

    const unsubGameState = ctx.onAccountChange(() => renderGameState(getCurrentProfileId()));
    wrap.querySelector('#gamestate-refresh-btn').addEventListener('click', () => renderGameState(getCurrentProfileId()));

    // Eigener Login-Roundtrip pro Abruf (CLI --history) — bewusst nicht Teil des 5s-Polls von
    // render(), sonst würde bei offener Overview-Seite alle 5 Sekunden neu eingeloggt.
    renderBattleHistory(ctx.getAccountId());
    const unsubBattleHistory = ctx.onAccountChange(renderBattleHistory);
    wrap.querySelector('#battle-history-refresh-btn').addEventListener('click', () => renderBattleHistory(ctx.getAccountId()));

    const pageSizeSelect = wrap.querySelector('#accounts-pagesize');
    pageSizeSelect.value = accountsPageSize;
    pageSizeSelect.addEventListener('change', () => {
      accountsPageSize = pageSizeSelect.value;
      localStorage.setItem('mercy-accounts-pagesize', accountsPageSize);
      accountsPage = 0;
      renderAccountsTable(lastAccounts);
    });
    wrap.querySelector('#accounts-prev-btn').addEventListener('click', () => {
      accountsPage -= 1;
      renderAccountsTable(lastAccounts);
    });
    wrap.querySelector('#accounts-next-btn').addEventListener('click', () => {
      accountsPage += 1;
      renderAccountsTable(lastAccounts);
    });

    wrap.querySelectorAll('.collapsible-card').forEach(cardEl => makeCollapsible(cardEl, cardEl.id));

    return () => { unsub(); unsubGameState(); unsubBattleHistory(); clearInterval(interval); };
  }
};
