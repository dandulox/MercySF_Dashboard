function ensureChartJs() {
  if (window.Chart) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/chart.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Chart.js konnte nicht geladen werden'));
    document.head.appendChild(script);
  });
}

export default {
  id: 'analytics',
  label: 'Analysen',
  icon: '📈',
  mount(container, ctx) {
    const css = `
      .analytics-page #analytics-body { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
      .analytics-page .chart-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; min-width: 0; }
      .analytics-page .chart-card h3 { margin: 0 0 8px; font-size: 13px; }
      .analytics-page canvas { max-height: 200px; }
      @media (max-width: 900px) {
        .analytics-page #analytics-body { grid-template-columns: 1fr; }
      }
      .analytics-page .earnings-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-top: 16px; }
      .analytics-page .earnings-card h3 { margin: 0 0 8px; font-size: 13px; }
      .analytics-page .earnings-chart canvas { max-height: 220px; }
      .analytics-page .actions-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
      .analytics-page .actions-table th { text-align: left; color: var(--muted); font-size: 11px; padding: 6px 8px; border-bottom: 1px solid var(--border); }
      .analytics-page .actions-table td { padding: 6px 8px; border-bottom: 1px solid var(--border); }
      .analytics-page .positive { color: var(--green); }
      .analytics-page .negative { color: var(--red); }
    `;
    ctx.injectStyleOnce('analytics', css);

    const wrap = document.createElement('div');
    wrap.className = 'analytics-page';
    wrap.innerHTML = `
      <h1 class="page-title">Analysen</h1>
      <div id="analytics-body">Lade...</div>
      <div class="earnings-card">
        <h3>📊 Tägliche Erträge (letzte 14 Tage)</h3>
        <div class="earnings-chart"><canvas id="earnings-chart"></canvas></div>
      </div>
      <div class="earnings-card">
        <h3>⚔ Erkannte Aktionen</h3>
        <div id="actions-body">Lade...</div>
      </div>
    `;
    container.appendChild(wrap);

    const charts = [];
    let earningsChart = null;
    function destroyCharts() {
      charts.forEach(c => c.destroy());
      charts.length = 0;
      if (earningsChart) { earningsChart.destroy(); earningsChart = null; }
    }

    async function loadEarnings(accountId) {
      const daily = await ctx.fetchJSON(`/api/stats/${encodeURIComponent(accountId)}/daily?days=14`);
      if (earningsChart) { earningsChart.destroy(); earningsChart = null; }
      const canvasCtx = wrap.querySelector('#earnings-chart').getContext('2d');
      earningsChart = new window.Chart(canvasCtx, {
        type: 'bar',
        data: {
          labels: daily.map(d => d.date),
          datasets: [
            { label: 'EP', data: daily.map(d => d.expGained), backgroundColor: 'rgba(79,140,255,0.6)' },
            { label: 'Silber', data: daily.map(d => d.silverGained), backgroundColor: 'rgba(53,201,143,0.6)' },
            { label: 'Ehre', data: daily.map(d => d.honorGained), backgroundColor: 'rgba(240,180,41,0.6)' },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: '#8a8f9c' } } },
          scales: {
            x: { ticks: { color: '#8a8f9c' }, grid: { color: '#262a35' } },
            y: { ticks: { color: '#8a8f9c' }, grid: { color: '#262a35' } },
          },
        },
      });
    }

    async function loadActions(accountId) {
      const el = wrap.querySelector('#actions-body');
      const windows = await ctx.fetchJSON(`/api/stats/${encodeURIComponent(accountId)}/actions?limit=30`);
      if (!windows.length) { el.textContent = 'Noch keine Kämpfe erkannt.'; return; }
      el.innerHTML = `<div class="table-scroll"><table class="actions-table">
        <thead><tr><th>Zeit</th><th>Typ</th><th>EP</th><th>Silber</th><th>Ehre</th><th>Befehle im Fenster</th></tr></thead>
        <tbody>${windows.map(w => `
          <tr>
            <td>${new Date(w.windowEnd).toLocaleString('de-DE')}</td>
            <td>${w.fightType === 'arena' ? 'Arena' : 'Dungeon'}</td>
            <td class="${w.expDelta >= 0 ? 'positive' : 'negative'}">${w.expDelta >= 0 ? '+' : ''}${w.expDelta}</td>
            <td class="${w.silverDelta >= 0 ? 'positive' : 'negative'}">${w.silverDelta >= 0 ? '+' : ''}${w.silverDelta}</td>
            <td class="${w.honorDelta >= 0 ? 'positive' : 'negative'}">${w.honorDelta >= 0 ? '+' : ''}${w.honorDelta}</td>
            <td>${w.commands.join(', ')}</td>
          </tr>`).join('')}</tbody>
      </table></div>`;
    }

    async function load() {
      const accountId = ctx.getAccountId();
      const body = wrap.querySelector('#analytics-body');
      if (!accountId) { body.textContent = 'Kein Account ausgewählt.'; return; }
      try {
        await ensureChartJs();
        const data = await ctx.fetchJSON(`/api/analytics/${encodeURIComponent(accountId)}`);
        destroyCharts();
        const labelMap = { level: 'Level', silver: 'Silber', honor: 'Ehre', rank: 'Rang', mushrooms: 'Pilze', armor: 'Rüstung', experience: 'Erfahrung' };
        body.innerHTML = Object.keys(data.series).map(f => `
          <div class="chart-card">
            <h3>${labelMap[f] || f}</h3>
            <canvas id="chart-${f}"></canvas>
          </div>`).join('');
        for (const field of Object.keys(data.series)) {
          const points = data.series[field];
          const canvasCtx = wrap.querySelector(`#chart-${field}`).getContext('2d');
          const chart = new window.Chart(canvasCtx, {
            type: 'line',
            data: {
              labels: points.map(p => new Date(p.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })),
              datasets: [{ label: labelMap[field] || field, data: points.map(p => p.v), borderColor: '#4f8cff', backgroundColor: 'rgba(79,140,255,0.15)', tension: 0.2, pointRadius: 0 }],
            },
            options: {
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { color: '#8a8f9c' }, grid: { color: '#262a35' } },
                y: { ticks: { color: '#8a8f9c' }, grid: { color: '#262a35' } },
              },
            },
          });
          charts.push(chart);
        }
        await loadEarnings(accountId);
        await loadActions(accountId);
      } catch (err) {
        body.textContent = 'Fehler: ' + err.message;
      }
    }

    load();
    const unsub = ctx.onAccountChange(load);
    return () => { unsub(); destroyCharts(); };
  }
};
