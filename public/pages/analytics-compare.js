import { t, getLanguage } from '/lib/i18n.js';

function ensureChartJs() {
  if (window.Chart) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/chart.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(t('analytics.chartLoadError')));
    document.head.appendChild(script);
  });
}

function themeVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fieldLabels() {
  return {
    level: t('analytics.fieldLevel'),
    silver: t('analytics.fieldSilver'),
    honor: t('analytics.fieldHonor'),
    rank: t('analytics.fieldRank'),
    mushrooms: t('analytics.fieldMushrooms'),
    armor: t('analytics.fieldArmor'),
    experience: t('analytics.fieldExperience'),
  };
}
function rangeLabels() {
  return {
    '24h': t('analyticsCompare.range24h'),
    '7d': t('analyticsCompare.range7d'),
    '30d': t('analyticsCompare.range30d'),
  };
}
const FIELD_KEYS = ['level', 'silver', 'honor', 'rank', 'mushrooms', 'armor', 'experience'];

// Deterministische Farbpalette statt Zufallsfarben, damit ein Charakter/eine Klasse über alle
// Feld-Charts hinweg und über Auswahl-Änderungen hinweg immer dieselbe Farbe behält (siehe
// colorForTarget — Index basiert auf der festen Reihenfolge aller bekannten Ziele, nicht auf der
// aktuellen Auswahl).
const SERIES_COLORS = [
  '#4f8cff', '#35c98f', '#f0b429', '#ff6b6b', '#a875ff', '#2dd4d4', '#ff9f43', '#e879f9',
];

export default {
  id: 'analytics-compare',
  label: 'Account-Analyse',
  icon: '🧬',
  mount(container, ctx) {
    const css = `
      .analytics-compare-page .filter-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px; margin-bottom: 12px; }
      .analytics-compare-page .filter-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
      .analytics-compare-page .filter-row label { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-right: 4px; }
      .analytics-compare-page select { background: var(--input-bg); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 6px 10px; font-size: 13px; }
      .analytics-compare-page .filter-chip {
        display: inline-flex; align-items: center; gap: 4px; background: var(--panel-2); border: 1px solid var(--border);
        border-radius: 20px; padding: 4px 10px; font-size: 11.5px; cursor: pointer; user-select: none; color: var(--muted);
      }
      .analytics-compare-page .filter-chip.active { color: var(--text); border-color: var(--accent); }
      .analytics-compare-page .target-section { margin-top: 10px; }
      .analytics-compare-page .target-section h3 { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 8px; }
      .analytics-compare-page .target-checks { display: flex; flex-wrap: wrap; gap: 8px; }
      .analytics-compare-page .target-chip {
        display: flex; align-items: center; gap: 6px; background: var(--panel-2); border: 1px solid var(--border);
        border-radius: 20px; padding: 5px 12px 5px 8px; font-size: 12.5px; cursor: pointer; user-select: none; color: var(--text);
      }
      .analytics-compare-page .target-chip.active { border-width: 2px; padding: 4px 11px 4px 7px; }
      .analytics-compare-page .target-chip-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; background: var(--border); }
      .analytics-compare-page .empty-classes-hint { color: var(--muted); font-size: 12px; }
      .analytics-compare-page #charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .analytics-compare-page .chart-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px; min-width: 0; }
      .analytics-compare-page .chart-card h3 { margin: 0 0 8px; font-size: 13px; }
      .analytics-compare-page canvas { max-height: 220px; }
      .analytics-compare-page .empty-hint { color: var(--muted); font-size: 13px; }
      @media (max-width: 900px) {
        .analytics-compare-page #charts-grid { grid-template-columns: 1fr; }
      }
    `;
    ctx.injectStyleOnce('analytics-compare', css);

    const wrap = document.createElement('div');
    wrap.className = 'analytics-compare-page';
    wrap.innerHTML = `
      <h1 class="page-title">${t('analyticsCompare.title')}</h1>
      <div class="filter-card">
        <div class="filter-row">
          <label>${t('analyticsCompare.rangeLabel')}</label>
          <select id="range-select">
            ${Object.entries(rangeLabels()).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <div class="filter-row">
          <label>${t('analyticsCompare.sortLabel')}</label>
          <select id="sort-select">
            <option value="name">${t('analyticsCompare.sortName')}</option>
            <option value="class">${t('analyticsCompare.sortClass')}</option>
            <option value="server">${t('analyticsCompare.sortServer')}</option>
          </select>
        </div>
        <div class="target-section">
          <h3>${t('analyticsCompare.filterServerLabel')}</h3>
          <div class="target-checks" id="server-filter-checks"></div>
        </div>
        <div class="target-section">
          <h3>${t('analyticsCompare.filterClassLabel')}</h3>
          <div class="target-checks" id="class-filter-checks"></div>
        </div>
        <div class="target-section">
          <h3>${t('analyticsCompare.charactersLabel')}</h3>
          <div class="target-checks" id="account-checks"></div>
        </div>
        <div class="target-section">
          <h3>${t('analyticsCompare.classesLabel')}</h3>
          <div class="target-checks" id="class-checks"></div>
        </div>
      </div>
      <div id="charts-grid"></div>
      <div class="empty-hint" id="compare-empty" hidden>${t('analyticsCompare.emptyHint')}</div>
    `;
    container.appendChild(wrap);

    let accounts = [];
    let classes = [];
    let servers = [];
    const selectedAccounts = new Set();
    const selectedClasses = new Set();
    const visibleServers = new Set();
    const visibleClasses = new Set();
    let charts = [];

    function destroyCharts() {
      charts.forEach(c => c.destroy());
      charts = [];
    }

    function applyChartTheme() {
      const muted = themeVar('--muted');
      const border = themeVar('--border');
      charts.forEach(chart => {
        if (chart.options.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = muted;
        for (const scale of Object.values(chart.options.scales || {})) {
          if (scale.ticks) scale.ticks.color = muted;
          if (scale.grid) scale.grid.color = border;
        }
        chart.update();
      });
    }
    window.addEventListener('mercy-theme-change', applyChartTheme);

    // Feste Reihenfolge aller bekannten Ziele (unabhängig von der aktuellen Auswahl) — ein
    // Charakter/eine Klasse behält so über Auswahl-Änderungen hinweg immer dieselbe Farbe.
    function allTargetKeysOrdered() {
      return [...accounts.map(a => `account:${a.id}`), ...classes.map(c => `class:${c}`)];
    }
    function colorForTarget(key) {
      const idx = allTargetKeysOrdered().indexOf(key);
      return SERIES_COLORS[Math.max(idx, 0) % SERIES_COLORS.length];
    }

    function renderFilterChecks() {
      const serverWrap = wrap.querySelector('#server-filter-checks');
      serverWrap.innerHTML = servers.map(s => `
        <button type="button" class="filter-chip${visibleServers.has(s) ? ' active' : ''}" data-filter="server" data-value="${escapeHtml(s)}">${escapeHtml(s)}</button>
      `).join('') || `<span class="empty-classes-hint">${t('analyticsCompare.noAccountsHint')}</span>`;

      const classWrap = wrap.querySelector('#class-filter-checks');
      classWrap.innerHTML = classes.length
        ? classes.map(c => `
          <button type="button" class="filter-chip${visibleClasses.has(c) ? ' active' : ''}" data-filter="class" data-value="${escapeHtml(c)}">${escapeHtml(c)}</button>
        `).join('')
        : `<span class="empty-classes-hint">${t('analyticsCompare.noClassesHint')}</span>`;

      wrap.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const set = btn.dataset.filter === 'server' ? visibleServers : visibleClasses;
          const value = btn.dataset.value;
          if (set.has(value)) set.delete(value); else set.add(value);
          renderFilterChecks();
          renderTargetChecks();
        });
      });
    }

    function sortedFilteredAccounts() {
      const sortMode = wrap.querySelector('#sort-select')?.value || 'name';
      const visible = accounts.filter(a =>
        visibleServers.has(a.server) && (!a.characterClass || visibleClasses.has(a.characterClass)));
      const sorters = {
        name: (a, b) => a.charName.localeCompare(b.charName),
        class: (a, b) => (a.characterClass || '').localeCompare(b.characterClass || '') || a.charName.localeCompare(b.charName),
        server: (a, b) => a.server.localeCompare(b.server) || a.charName.localeCompare(b.charName),
      };
      return [...visible].sort(sorters[sortMode] || sorters.name);
    }

    function renderTargetChecks() {
      const accWrap = wrap.querySelector('#account-checks');
      accWrap.innerHTML = sortedFilteredAccounts().map(a => {
        const key = `account:${a.id}`;
        const active = selectedAccounts.has(a.id);
        const color = colorForTarget(key);
        return `<button type="button" class="target-chip${active ? ' active' : ''}" data-type="account" data-id="${a.id}" style="${active ? `border-color:${color}` : ''}">
          <span class="target-chip-dot" style="background:${active ? color : 'transparent'}"></span>${escapeHtml(a.charName)} (${escapeHtml(a.server)})
        </button>`;
      }).join('') || `<span class="empty-classes-hint">${t('analyticsCompare.noAccountsHint')}</span>`;

      const classWrap = wrap.querySelector('#class-checks');
      classWrap.innerHTML = classes.length
        ? classes.map(c => {
          const key = `class:${c}`;
          const active = selectedClasses.has(c);
          const color = colorForTarget(key);
          return `<button type="button" class="target-chip${active ? ' active' : ''}" data-type="class" data-id="${c}" style="${active ? `border-color:${color}` : ''}">
            <span class="target-chip-dot" style="background:${active ? color : 'transparent'}"></span>${escapeHtml(c)} (Σ)
          </button>`;
        }).join('')
        : `<span class="empty-classes-hint">${t('analyticsCompare.noClassesHint')}</span>`;

      wrap.querySelectorAll('.target-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const set = btn.dataset.type === 'class' ? selectedClasses : selectedAccounts;
          const id = btn.dataset.id;
          if (set.has(id)) set.delete(id); else set.add(id);
          renderTargetChecks();
          loadAndRender();
        });
      });
    }

    wrap.querySelector('#range-select').addEventListener('change', loadAndRender);
    wrap.querySelector('#sort-select').addEventListener('change', renderTargetChecks);

    function renderCharts(requestSeries, response) {
      destroyCharts();
      const grid = wrap.querySelector('#charts-grid');
      const emptyHint = wrap.querySelector('#compare-empty');
      if (!requestSeries || !response) {
        grid.innerHTML = '';
        emptyHint.hidden = false;
        return;
      }
      emptyHint.hidden = true;

      const labels = fieldLabels();
      grid.innerHTML = FIELD_KEYS.map(f => `
        <div class="chart-card">
          <h3>${labels[f]}</h3>
          <canvas id="chart-field-${f}"></canvas>
        </div>`).join('');

      const locale = getLanguage() === 'en' ? 'en-US' : 'de-DE';
      const bucketLabels = response.buckets.map(ts => new Date(ts).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));

      for (const field of FIELD_KEYS) {
        const datasets = [];
        requestSeries.forEach((reqS, idx) => {
          if (reqS.field !== field) return;
          const respS = response.series[idx];
          const color = colorForTarget(`${reqS.type}:${reqS.id}`);
          const label = reqS.type === 'class' ? `${respS.targetLabel} (Σ)` : respS.targetLabel;
          datasets.push({
            label,
            data: respS.values,
            borderColor: color,
            backgroundColor: color + '26',
            tension: 0.2,
            pointRadius: 0,
            spanGaps: true,
          });
        });
        const canvasCtx = wrap.querySelector(`#chart-field-${field}`).getContext('2d');
        const chart = new window.Chart(canvasCtx, {
          type: 'line',
          data: { labels: bucketLabels, datasets },
          options: {
            responsive: true,
            plugins: { legend: { display: datasets.length > 1, labels: { color: themeVar('--muted') } } },
            scales: {
              x: { ticks: { color: themeVar('--muted') }, grid: { color: themeVar('--border') } },
              y: { ticks: { color: themeVar('--muted') }, grid: { color: themeVar('--border') } },
            },
          },
        });
        charts.push(chart);
      }
    }

    async function loadAndRender() {
      const targets = [
        ...[...selectedAccounts].map(id => ({ type: 'account', id })),
        ...[...selectedClasses].map(id => ({ type: 'class', id })),
      ];
      if (!targets.length) {
        renderCharts(null, null);
        return;
      }
      await ensureChartJs();
      const range = wrap.querySelector('#range-select').value;
      const requestSeries = targets.flatMap(target => FIELD_KEYS.map(field => ({ type: target.type, id: target.id, field })));
      try {
        const response = await ctx.fetchJSON('/api/analytics-compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ range, series: requestSeries }),
        });
        renderCharts(requestSeries, response);
      } catch (err) {
        destroyCharts();
        const grid = wrap.querySelector('#charts-grid');
        const emptyHint = wrap.querySelector('#compare-empty');
        grid.innerHTML = '';
        emptyHint.textContent = t('analytics.loadError', { message: err.message });
        emptyHint.hidden = false;
      }
    }

    async function init() {
      accounts = await ctx.fetchJSON('/api/accounts');
      classes = [...new Set(accounts.map(a => a.characterClass).filter(Boolean))].sort();
      servers = [...new Set(accounts.map(a => a.server).filter(Boolean))].sort();
      servers.forEach(s => visibleServers.add(s));
      classes.forEach(c => visibleClasses.add(c));
      if (accounts.length) selectedAccounts.add(accounts[0].id);
      renderFilterChecks();
      renderTargetChecks();
      loadAndRender();
    }

    init();

    return () => {
      window.removeEventListener('mercy-theme-change', applyChartTheme);
      destroyCharts();
    };
  },
};
