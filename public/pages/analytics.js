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
    `;
    ctx.injectStyleOnce('analytics', css);

    const wrap = document.createElement('div');
    wrap.className = 'analytics-page';
    wrap.innerHTML = `<h1 class="page-title">Analysen</h1><div id="analytics-body">Lade...</div>`;
    container.appendChild(wrap);

    const charts = [];
    function destroyCharts() { charts.forEach(c => c.destroy()); charts.length = 0; }

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
      } catch (err) {
        body.textContent = 'Fehler: ' + err.message;
      }
    }

    load();
    const unsub = ctx.onAccountChange(load);
    return () => { unsub(); destroyCharts(); };
  }
};
