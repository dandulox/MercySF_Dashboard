import { connectTerminal } from '/lib/terminal.js';

function fmtExitInfo(info) {
  if (!info) return '';
  const time = new Date(info.at).toLocaleTimeString('de-DE');
  if (info.reason === 'spawn_failed') return `Start fehlgeschlagen (${time}): ${info.message}`;
  return `Beendet (${time}), exitCode=${info.exitCode}${info.signal ? ', signal=' + info.signal : ''}`;
}

export default {
  id: 'console',
  label: 'Konsole',
  icon: '⌨',
  mount(container, ctx) {
    const css = `
      .console-page .term-card { background: #0b0c10; border: 1px solid var(--border); border-radius: 12px; padding: 10px; height: 560px; }
      .console-page #term-container { width: 100%; height: 100%; }
      .console-page .status-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-bottom: 10px; }
      .console-page .status-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
      .console-page .status-dot.connected { background: var(--green); box-shadow: 0 0 6px var(--green); }
      .console-page .status-dot.disconnected { background: var(--red); box-shadow: 0 0 6px var(--red); }
      .console-page .status-dot.connecting { background: var(--yellow); }
      .console-page .status-text { font-size: 13px; color: var(--muted); }
      .console-page .status-detail { font-size: 12px; color: var(--muted); margin-left: auto; overflow-wrap: break-word; }
      .console-page .btn-restart { width: auto; padding: 6px 14px; font-size: 12px; }
      @media (max-width: 480px) {
        .console-page .term-card { height: 420px; }
      }
    `;
    ctx.injectStyleOnce('console', css);

    const wrap = document.createElement('div');
    wrap.className = 'console-page';
    wrap.innerHTML = `
      <h1 class="page-title">Konsole</h1>
      <p class="muted" style="margin: -6px 0 12px; font-size: 12px;">Globale Standard-Konsole. Für einzelne Accounts siehe <a href="#/accounts">Account-Verwaltung</a>.</p>
      <div class="status-bar">
        <span class="status-dot connecting" id="status-dot"></span>
        <span class="status-text" id="status-text">Verbinde...</span>
        <span class="status-detail" id="status-detail"></span>
        <button class="btn btn-primary btn-restart" id="restart-btn">CLI neu starten</button>
      </div>
      <div class="term-card"><div id="term-container">Lade Terminal...</div></div>
    `;
    container.appendChild(wrap);

    function setStatus(state, text, detail) {
      const dot = wrap.querySelector('#status-dot');
      dot.className = 'status-dot ' + state;
      wrap.querySelector('#status-text').textContent = text;
      wrap.querySelector('#status-detail').textContent = detail || '';
    }

    const termHandle = connectTerminal({
      container: wrap.querySelector('#term-container'),
      onStatus: (status) => {
        if (status.running === true) setStatus('connected', 'Verbunden — CLI läuft');
        else if (status.running === false) setStatus('disconnected', 'CLI läuft nicht', fmtExitInfo(status.lastExitInfo));
        else setStatus('disconnected', 'Nicht verbunden (WebSocket getrennt)');
      },
    });

    wrap.querySelector('#restart-btn').addEventListener('click', async () => {
      setStatus('connecting', 'Starte CLI neu...');
      try {
        await ctx.fetchJSON('/api/console/restart', { method: 'POST' });
      } catch (err) {
        setStatus('disconnected', 'Neustart fehlgeschlagen: ' + err.message);
      }
    });

    return () => termHandle.dispose();
  }
};
