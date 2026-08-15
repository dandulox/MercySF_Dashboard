import { t } from '/lib/i18n.js';

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
  if (!sec) return t('overview.zeroMin');
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? t('overview.durationHM', { h, m }) : t('overview.durationM', { m });
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
      <h1 class="page-title">${t('overview.title')}</h1>
      <section class="card" id="no-data-card" style="display:none">
        <p>${t('overview.noDataHint')}</p>
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
                <th>ACCOUNT</th><th>SERVER</th><th>LEVEL</th><th>GOLD</th><th>${t('overview.colMushrooms')}</th>
                <th>${t('overview.colHonor')}</th><th>${t('overview.colRank')}</th><th>${t('overview.colArenaToday')}</th><th>${t('overview.colDungeonToday')}</th>
              </tr>
            </thead>
            <tbody id="accounts-table-body"></tbody>
          </table>
        </div>
        <div class="accounts-pagination">
          <div class="pagination-pagesize">
            <label for="accounts-pagesize">${t('overview.perPageLabel')}</label>
            <select id="accounts-pagesize">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="all">${t('overview.allOption')}</option>
            </select>
          </div>
          <div class="pagination-controls">
            <button type="button" class="icon-btn" id="accounts-prev-btn" title="${t('overview.prevPageTitle')}">‹</button>
            <span id="accounts-page-label" class="muted"></span>
            <button type="button" class="icon-btn" id="accounts-next-btn" title="${t('overview.nextPageTitle')}">›</button>
          </div>
        </div>
      </section>
      <div class="gamestate-grid">
        <section class="card collapsible-card" id="character-card">
          <div class="card-header">
            <span>${t('overview.characterTitle')}</span>
            <button class="icon-btn" id="gamestate-refresh-btn" title="${t('overview.refreshGamestateTitle')}">⟳</button>
          </div>
          <div class="stat-grid" id="stat-grid"></div>
          <div id="daily-earnings-body" class="daily-earnings"></div>
        </section>
        <section class="card collapsible-card" id="equipment-card">
          <div class="card-header"><span>${t('overview.equipmentTitle')}</span></div>
          <div id="equipment-body" class="muted">${t('overview.selectAccountEquip')}</div>
        </section>
        <section class="card collapsible-card span-2" id="tavern-card">
          <div class="card-header"><span>${t('overview.tavernTitle')}</span></div>
          <div id="tavern-body" class="muted">${t('overview.selectAccountTavern')}</div>
        </section>
        <section class="card collapsible-card" id="guild-card">
          <div class="card-header"><span>${t('overview.guildTitle')}</span></div>
          <div id="guild-body" class="muted">${t('overview.selectAccountGuild')}</div>
        </section>
        <section class="card collapsible-card" id="mail-card">
          <div class="card-header"><span>${t('overview.mailTitle')}</span></div>
          <div id="mail-body" class="muted">${t('overview.selectAccountMail')}</div>
        </section>
      </div>
      <section class="card collapsible-card" id="battle-history-card">
        <div class="card-header">
          <span>${t('overview.battleHistoryTitle')}</span>
          <button class="icon-btn" id="battle-history-refresh-btn" title="${t('overview.refreshBattleHistoryTitle')}">⟳</button>
        </div>
        <div id="battle-history-body" class="muted">${t('overview.selectAccountBattleHistory')}</div>
      </section>
      <section class="card collapsible-card" id="activity-log-card">
        <div class="card-header"><span>📜 Activity Log</span></div>
        <div id="activity-log" class="activity-log">${t('overview.selectAccountLog')}</div>
      </section>
    `;
    container.appendChild(wrap);

    ctx.injectStyleOnce('overview-gamestate', `
      .gamestate-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
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

      .equip-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
      .equip-slot { background: var(--panel-2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 10px; min-width: 0; overflow-wrap: break-word; }
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
      pageLabel.textContent = accountsPageSize === 'all' ? '' : t('overview.pageLabel', { page: accountsPage + 1, total: totalPages });
      prevBtn.disabled = accountsPage <= 0 || accountsPageSize === 'all';
      nextBtn.disabled = accountsPage >= totalPages - 1 || accountsPageSize === 'all';
    }

    function renderStatCards(account) {
      const grid = wrap.querySelector('#stat-grid');
      grid.innerHTML = '';
      if (!account || !account.stats) return;
      const s = account.stats;
      [['LEVEL', s.level], ['GOLD', fmt(toGold(s.silver))], [t('overview.colMushrooms'), s.mushrooms], [t('overview.colHonor'), fmt(s.honor)], [t('overview.colRank'), fmt(s.rank)]]
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
          <div class="daily-earnings-title">${t('overview.earningsTitle')}</div>
          <div class="table-scroll">
            <table class="daily-earnings-table">
              <thead>
                <tr><th></th><th>${t('overview.todayLabel')}</th><th>${t('overview.yesterdayLabel')}</th><th>${t('overview.thisWeekLabel')}</th><th>${t('overview.lastWeekLabel')}</th></tr>
              </thead>
              <tbody>
                ${tableRow('expGained', t('analytics.epLabel'))}
                ${tableRow('silverGained', 'Gold', toGold)}
                ${tableRow('honorGained', t('analytics.honorLabel'))}
              </tbody>
            </table>
          </div>
          <div class="daily-levelups">${t('overview.levelUpsTodayLabel')} <strong>${today.levelsGained}</strong></div>
        `;
      } catch (err) {
        el.textContent = t('analytics.loadError', { message: err.message });
      }
    }

    async function renderLog(accountId, charName) {
      const logEl = wrap.querySelector('#activity-log');
      if (!accountId) { logEl.textContent = t('overview.selectAccountLog'); return; }
      const lines = await ctx.fetchJSON(`/api/account/${encodeURIComponent(accountId)}/logs`);
      if (!lines.length) { logEl.textContent = t('overview.noLogEntries'); return; }
      logEl.innerHTML = lines.map(l => `<div class="line">${highlightCharName(escapeHtml(l), charName)}</div>`).join('');
    }

    function battleKindLabels() {
      return { arena: 'Arena', dungeon: 'Dungeon', scrapbook: t('overview.kindScrapbook') };
    }

    async function renderBattleHistory(accountId) {
      const el = wrap.querySelector('#battle-history-body');
      if (!accountId) { el.textContent = t('overview.selectAccountBattleHistory'); return; }
      el.textContent = t('overview.loadingEllipsis');
      try {
        const data = await ctx.fetchJSON(`/api/history/${encodeURIComponent(accountId)}?limit=20`);
        if (!data.battles.length) { el.textContent = t('overview.noBattlesRecorded'); return; }
        const kindLabels = battleKindLabels();
        el.innerHTML = `
          <div class="table-scroll">
            <table class="battle-history-table">
              <thead><tr><th>${t('analytics.colTime')}</th><th>${t('overview.colEnemy')}</th><th>${t('analytics.colType')}</th><th>${t('overview.colResult')}</th><th>${t('analytics.epLabel')}</th><th>${t('overview.colSilver')}</th><th>${t('analytics.honorLabel')}</th></tr></thead>
              <tbody>${data.battles.map(b => `
                <tr>
                  <td class="muted">${new Date(b.timestamp).toLocaleString('de-DE')}</td>
                  <td class="char-name">${escapeHtml(b.enemy_name || '—')}</td>
                  <td>${kindLabels[b.kind] || escapeHtml(b.kind || '—')}</td>
                  <td><span class="battle-result ${b.won ? 'win' : 'loss'}">${b.won ? t('overview.win') : t('overview.loss')}</span></td>
                  <td class="${b.xp >= 0 ? 'positive' : 'negative'}">${b.xp >= 0 ? '+' : ''}${b.xp}</td>
                  <td class="${b.silver >= 0 ? 'positive' : 'negative'}">${b.silver >= 0 ? '+' : ''}${b.silver}</td>
                  <td class="${b.honor >= 0 ? 'positive' : 'negative'}">${b.honor >= 0 ? '+' : ''}${b.honor}</td>
                </tr>`).join('')}</tbody>
            </table>
          </div>
          <div class="battle-history-note">${t('overview.battleHistoryNote', { returned: data.returned, total: data.total })}</div>
        `;
      } catch (err) {
        el.textContent = t('analytics.loadError', { message: err.message });
      }
    }

    let lastAccounts = [];
    function getCurrentProfileId() {
      const accountId = ctx.getAccountId();
      const current = lastAccounts.find(a => a.id === accountId);
      return current ? current.profileId : null;
    }

    function renderEquipmentBody(items) {
      const el = wrap.querySelector('#equipment-body');
      if (!items.length) { el.textContent = t('overview.noEquipmentFound'); return; }
      el.innerHTML = `<div class="equip-grid">${items.map(item => `
        <div class="equip-slot">
          <div class="equip-slot-name">${escapeHtml(item.slot)}</div>
          <div class="equip-slot-type">${escapeHtml(item.itemType)}</div>
          <div class="equip-slot-attrs">${Object.entries(item.attributes).map(([k, v]) => `${escapeHtml(k)}: ${v}`).join('<br>') || '—'}</div>
          <div class="equip-slot-meta">${t('overview.qualityLabel', { quality: item.itemQuality, upgrade: item.upgradeCount })}</div>
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
      if (!guild) { el.textContent = t('overview.noGuildMember'); return; }
      const VISIBLE = 8;
      const hiddenCount = Math.max(0, guild.members.length - VISIBLE);
      el.innerHTML = `
        <div class="guild-summary"><strong>${escapeHtml(guild.name)}</strong> · ${t('analytics.honorLabel')} ${fmt(guild.honor)} · ${t('overview.colRank')} ${guild.rank} · ${guild.memberCount} ${t('overview.membersLabel')}</div>
        <div class="guild-member-list" id="guild-member-list">${renderGuildMemberRows(guild.members.slice(0, VISIBLE))}</div>
        ${hiddenCount > 0 ? `<button type="button" class="link-btn-inline" id="guild-show-all-btn">${t('overview.showMoreMembers', { count: hiddenCount })}</button>` : ''}
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
          <div class="alu-bar-label"><span>${t('overview.adventureLust')}</span><span>${tavern.adventurePoints}/${tavern.adventurePointsMax}</span></div>
          <div class="alu-bar-track"><div class="alu-bar-fill" style="width:${aluPct}%"></div></div>
        </div>
        <div class="tavern-summary">🍺 ${tavern.beerDrunk}/${tavern.beerMax} · ${t('overview.tavernActionLabel', { action })}</div>
        ${tavern.quests.map(q => `
          <div class="tavern-quest-row">
            <span>${escapeHtml(q.location)}</span>
            <span class="muted">${fmt(toGold(q.baseSilver))} Gold · ${fmt(q.baseExperience)} XP · ${fmtDuration(q.baseLengthSec)}</span>
          </div>`).join('')}
      `;
    }

    function renderMailBody(mail) {
      const el = wrap.querySelector('#mail-body');
      if (!mail.recent.length) { el.textContent = t('overview.mailboxEmpty', { cap: mail.inboxCapacity }); return; }
      el.innerHTML = `
        <div class="mail-summary">${t('overview.mailSummary', { unread: mail.unreadCount, count: mail.recent.length, cap: mail.inboxCapacity })}</div>
        ${mail.recent.map(entry => `
          <div class="mail-row ${entry.read ? '' : 'unread'}">
            <span>${escapeHtml(entry.title || t('overview.noSubject'))}</span>
            <span class="muted">${t('overview.mailFrom', { from: escapeHtml(entry.from) })} · ${new Date(entry.date).toLocaleString('de-DE')}</span>
          </div>`).join('')}
      `;
    }

    async function renderGameState(profileId) {
      const equipEl = wrap.querySelector('#equipment-body');
      const guildEl = wrap.querySelector('#guild-body');
      const tavernEl = wrap.querySelector('#tavern-body');
      const mailEl = wrap.querySelector('#mail-body');
      if (!profileId) {
        equipEl.textContent = t('overview.selectAccountEquip');
        guildEl.textContent = t('overview.selectAccountGuild');
        tavernEl.textContent = t('overview.selectAccountTavern');
        mailEl.textContent = t('overview.selectAccountMail');
        return;
      }
      equipEl.textContent = t('overview.loadingEllipsis');
      guildEl.textContent = t('overview.loadingEllipsis');
      tavernEl.textContent = t('overview.loadingEllipsis');
      mailEl.textContent = t('overview.loadingEllipsis');
      try {
        const data = await ctx.fetchJSON(`/api/gamestate/${encodeURIComponent(profileId)}`);
        renderEquipmentBody(data.equipment);
        renderGuildBody(data.guild);
        renderTavernBody(data.tavern);
        renderMailBody(data.mail);
      } catch (err) {
        const msg = t('analytics.loadError', { message: err.message });
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
