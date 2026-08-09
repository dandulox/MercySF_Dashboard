import { t } from '/lib/i18n.js';

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

// Deterministische Farbpalette statt Zufallsfarben, damit Serien beim Neuladen/Ändern stabil
// erkennbar bleiben (Chart.js hat keine eingebaute Kategorie-Palette für Liniendiagramme).
const SERIES_COLORS = [
  '#4f8cff', '#35c98f', '#f0b429', '#ff6b6b', '#a875ff', '#2dd4d4', '#ff9f43', '#e879f9',
];

let nextSeriesUid = 1;

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
      .analytics-compare-page .series-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
      .analytics-compare-page .series-row { display: flex; gap: 8px; align-items: center; background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; flex-wrap: wrap; }
      .analytics-compare-page .series-swatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
      .analytics-compare-page .series-remove { margin-left: auto; background: none; border: none; color: var(--muted); cursor: pointer; font-size: 15px; padding: 2px 6px; }
      .analytics-compare-page .series-remove:hover { color: var(--red); }
      .analytics-compare-page .add-series-btn { padding: 7px 14px; border-radius: 8px; border: 1px dashed var(--border); background: none; color: var(--accent); cursor: pointer; font-size: 13px; }
      .analytics-compare-page .chart-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px; }
      .analytics-compare-page canvas { max-height: 420px; }
      .analytics-compare-page .empty-hint { color: var(--muted); font-size: 13px; }
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
          <label style="margin-left:16px;"><input type="checkbox" id="normalize-toggle"> ${t('analyticsCompare.normalizeLabel')}</label>
        </div>
        <div class="series-list" id="series-list"></div>
        <button class="add-series-btn" id="add-series-btn">${t('analyticsCompare.addSeriesBtn')}</button>
      </div>
      <div class="chart-card">
        <canvas id="compare-chart"></canvas>
        <div class="empty-hint" id="compare-empty" hidden>${t('analyticsCompare.emptyHint')}</div>
      </div>
    `;
    container.appendChild(wrap);

    let accounts = [];
    let classes = [];
    // Jede Serie: { uid, type: 'account'|'class', targetId, field }
    let seriesDefs = [];
    let chart = null;

    function destroyChart() {
      if (chart) { chart.destroy(); chart = null; }
    }

    function applyChartTheme() {
      if (!chart) return;
      const muted = themeVar('--muted');
      const border = themeVar('--border');
      if (chart.options.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = muted;
      for (const scale of Object.values(chart.options.scales || {})) {
        if (scale.ticks) scale.ticks.color = muted;
        if (scale.grid) scale.grid.color = border;
      }
      chart.update();
    }
    window.addEventListener('mercy-theme-change', applyChartTheme);

    function targetOptionsHtml(type, selected) {
      if (type === 'class') {
        return classes.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
      }
      return accounts.map(a => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${a.charName} (${a.server})</option>`).join('');
    }

    function fieldOptionsHtml(selected) {
      const labels = fieldLabels();
      return FIELD_KEYS.map(f => `<option value="${f}" ${f === selected ? 'selected' : ''}>${labels[f]}</option>`).join('');
    }

    function renderSeriesList() {
      const list = wrap.querySelector('#series-list');
      list.innerHTML = seriesDefs.map((s, idx) => `
        <div class="series-row" data-uid="${s.uid}">
          <span class="series-swatch" style="background:${SERIES_COLORS[idx % SERIES_COLORS.length]}"></span>
          <select data-role="type">
            <option value="account" ${s.type === 'account' ? 'selected' : ''}>${t('analyticsCompare.typeAccount')}</option>
            <option value="class" ${s.type === 'class' ? 'selected' : ''}>${t('analyticsCompare.typeClass')}</option>
          </select>
          <select data-role="target">${targetOptionsHtml(s.type, s.targetId)}</select>
          <select data-role="field">${fieldOptionsHtml(s.field)}</select>
          <button class="series-remove" data-role="remove" title="${t('analyticsCompare.removeSeriesTitle')}">✕</button>
        </div>
      `).join('');

      list.querySelectorAll('.series-row').forEach(row => {
        const uid = Number(row.dataset.uid);
        const def = seriesDefs.find(s => s.uid === uid);
        row.querySelector('[data-role="type"]').addEventListener('change', (ev) => {
          def.type = ev.target.value;
          def.targetId = def.type === 'class' ? (classes[0] || '') : (accounts[0]?.id || '');
          renderSeriesList();
          loadAndRender();
        });
        row.querySelector('[data-role="target"]').addEventListener('change', (ev) => {
          def.targetId = ev.target.value;
          loadAndRender();
        });
        row.querySelector('[data-role="field"]').addEventListener('change', (ev) => {
          def.field = ev.target.value;
          loadAndRender();
        });
        row.querySelector('[data-role="remove"]').addEventListener('click', () => {
          seriesDefs = seriesDefs.filter(s => s.uid !== uid);
          renderSeriesList();
          loadAndRender();
        });
      });
    }

    function addSeries() {
      const type = 'account';
      seriesDefs.push({ uid: nextSeriesUid++, type, targetId: accounts[0]?.id || '', field: 'level' });
      renderSeriesList();
      loadAndRender();
    }
    wrap.querySelector('#add-series-btn').addEventListener('click', addSeries);

    wrap.querySelector('#range-select').addEventListener('change', loadAndRender);
    wrap.querySelector('#normalize-toggle').addEventListener('change', (ev) => {
      ev.target.dataset.userTouched = '1';
      renderChartFromLastResponse();
    });

    let lastResponse = null;

    function normalizeValues(values) {
      const firstReal = values.find(v => typeof v === 'number');
      if (!firstReal) return values.map(() => null);
      return values.map(v => (typeof v === 'number' ? Math.round((v / firstReal) * 10000) / 100 : null));
    }

    function renderChartFromLastResponse() {
      const emptyHint = wrap.querySelector('#compare-empty');
      const canvas = wrap.querySelector('#compare-chart');
      if (!lastResponse || !lastResponse.series.length) {
        destroyChart();
        emptyHint.textContent = t('analyticsCompare.emptyHint');
        emptyHint.hidden = false;
        canvas.hidden = true;
        return;
      }
      emptyHint.hidden = true;
      canvas.hidden = false;

      const distinctFields = new Set(lastResponse.series.map(s => s.field));
      const normalizeCheckbox = wrap.querySelector('#normalize-toggle');
      if (distinctFields.size > 1 && !normalizeCheckbox.dataset.userTouched) {
        normalizeCheckbox.checked = true;
      }
      const normalize = normalizeCheckbox.checked;

      destroyChart();
      const labels = lastResponse.buckets.map(t => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
      const datasets = lastResponse.series.map((s, idx) => {
        const targetLabel = s.type === 'class' ? `${s.targetLabel} (Σ)` : s.targetLabel;
        const color = SERIES_COLORS[idx % SERIES_COLORS.length];
        return {
          label: `${targetLabel} – ${fieldLabels()[s.field]}`,
          data: normalize ? normalizeValues(s.values) : s.values,
          borderColor: color,
          backgroundColor: color + '26',
          tension: 0.2,
          pointRadius: 0,
          spanGaps: true,
        };
      });

      chart = new window.Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: themeVar('--muted') } } },
          scales: {
            x: { ticks: { color: themeVar('--muted') }, grid: { color: themeVar('--border') } },
            y: { ticks: { color: themeVar('--muted') }, grid: { color: themeVar('--border') } },
          },
        },
      });
    }

    async function loadAndRender() {
      if (!seriesDefs.length) {
        lastResponse = null;
        renderChartFromLastResponse();
        return;
      }
      await ensureChartJs();
      const range = wrap.querySelector('#range-select').value;
      const body = {
        range,
        series: seriesDefs
          .filter(s => s.targetId)
          .map(s => ({ type: s.type, id: s.targetId, field: s.field })),
      };
      if (!body.series.length) {
        lastResponse = null;
        renderChartFromLastResponse();
        return;
      }
      try {
        lastResponse = await ctx.fetchJSON('/api/analytics-compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        renderChartFromLastResponse();
      } catch (err) {
        destroyChart();
        const emptyHint = wrap.querySelector('#compare-empty');
        emptyHint.textContent = t('analytics.loadError', { message: err.message });
        emptyHint.hidden = false;
        wrap.querySelector('#compare-chart').hidden = true;
      }
    }

    async function init() {
      accounts = await ctx.fetchJSON('/api/accounts');
      classes = [...new Set(accounts.map(a => a.characterClass).filter(Boolean))].sort();
      if (!seriesDefs.length && accounts.length) {
        addSeries();
      } else {
        renderSeriesList();
        loadAndRender();
      }
    }

    init();

    return () => {
      window.removeEventListener('mercy-theme-change', applyChartTheme);
      destroyChart();
    };
  },
};
