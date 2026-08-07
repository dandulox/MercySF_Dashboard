// Gemeinsame xterm.js/WebSocket-Anbindung, genutzt von der globalen Konsolen-Seite
// und von der Account-Verwaltung (jeweils eine eigene PTY-Session pro Profil-ID).

export function ensureXterm() {
  if (window.Terminal) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/vendor/xterm.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = '/vendor/xterm.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('xterm.js konnte nicht geladen werden'));
    document.head.appendChild(script);
  });
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const CHAR_LIST_RE = /\[(\d+)\]\s+([^\n@]+?)\s+@\s+(\S+)/g;

function detectPrompt(plainText) {
  if (/Select character index:/i.test(plainText)) {
    const characters = [];
    let m;
    CHAR_LIST_RE.lastIndex = 0;
    while ((m = CHAR_LIST_RE.exec(plainText))) {
      characters.push({ index: m[1], name: m[2].trim(), url: m[3] });
    }
    if (characters.length) return { kind: 'character-index', characters };
  }
  if (/Password:\s*$/i.test(plainText.trimEnd())) {
    return { kind: 'password' };
  }
  return null;
}

// Ersetzt bekannte Namen (Charaktername, Username, Spitzname) im Terminal-Text durch Blöcke,
// wenn der Anonym-Modus aktiv ist — geprüft live bei jedem Datenpaket, reagiert also sofort
// auf den Umschalter oben rechts, auch während das Terminal schon offen ist.
function redact(text, terms) {
  if (!terms || !terms.length || !document.body.classList.contains('anon-mode')) return text;
  let out = text;
  for (const term of terms) {
    if (!term || term.length < 2) continue;
    out = out.split(term).join('█'.repeat(Math.min(term.length, 14)));
  }
  return out;
}

/**
 * Verbindet ein DOM-Element mit einer PTY-Session über WebSocket.
 * @param {Object} opts
 * @param {HTMLElement} opts.container
 * @param {string} [opts.profileId] - fehlt = Standard-/globale Konsole
 * @param {(status: {running: boolean, lastExitInfo: any}) => void} [opts.onStatus]
 * @param {(prompt: {kind: 'password'} | {kind: 'character-index', characters: Array}) => void} [opts.onPrompt]
 * @param {string[]} [opts.redactTerms] - Begriffe, die im Anonym-Modus durch Blöcke ersetzt werden
 * @returns {{ dispose(): void, restart(): void, write(data: string): void }}
 */
const TERM_FONT_SIZE = 13;

// Kein Fit-Addon im Vendor-Bundle — grobe Zeichenmetrik-Näherung reicht, um das Terminal an die
// tatsächliche Kartengröße anzupassen (wichtig auf Mobile, wo die Karte deutlich schmaler ist als
// die früher fest angenommenen 80 Spalten).
function computeFitSize(container) {
  const charWidth = TERM_FONT_SIZE * 0.6;
  const charHeight = TERM_FONT_SIZE * 1.2;
  const cols = Math.max(20, Math.floor(container.clientWidth / charWidth) - 1);
  const rows = Math.max(8, Math.floor(container.clientHeight / charHeight) - 1);
  return { cols, rows };
}

export function connectTerminal({ container, profileId, onStatus, onPrompt, redactTerms }) {
  let ws = null;
  let term = null;
  let disposed = false;
  let promptBuffer = '';
  let lastPromptKind = null;
  let resizeObserver = null;

  function applyFit() {
    if (!term || !container.clientWidth || !container.clientHeight) return;
    const { cols, rows } = computeFitSize(container);
    if (cols !== term.cols || rows !== term.rows) {
      term.resize(cols, rows);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    }
  }

  ensureXterm().then(() => {
    if (disposed) return;
    container.textContent = '';
    term = new window.Terminal({
      theme: { background: '#0b0c10', foreground: '#e7e9ee' },
      fontSize: TERM_FONT_SIZE,
      cursorBlink: true,
    });
    term.open(container);

    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => applyFit());
      resizeObserver.observe(container);
    }

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const query = profileId ? `?profile=${encodeURIComponent(profileId)}` : '';
    ws = new WebSocket(`${proto}://${location.host}/api/console/ws${query}`);

    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'data') {
        term.write(redact(msg.data, redactTerms));
        if (onPrompt) {
          // Größeres Fenster (war 2000) — bei Logins mit vielen Charakteren fiel sonst die
          // erste Zeile der Auswahlliste ("[0] ...") aus dem Puffer, bevor der Prompt vollständig
          // erkannt wurde. Gleicher Fix wie server-seitig in ptyManager.js.
          promptBuffer = (promptBuffer + msg.data.replace(ANSI_RE, '')).slice(-8000);
          const prompt = detectPrompt(promptBuffer);
          const kind = prompt ? prompt.kind : null;
          if (kind && kind !== lastPromptKind) {
            lastPromptKind = kind;
            onPrompt(prompt);
          } else if (!kind) {
            lastPromptKind = null;
          }
        }
      }
      if (msg.type === 'status' && onStatus) onStatus(msg);
    };
    term.onData(data => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
      // Manuelle Eingabe im Terminal selbst räumt eine evtl. offene Login-Hilfe wieder ab.
      promptBuffer = '';
      lastPromptKind = null;
    });
    ws.onopen = () => {
      const { cols, rows } = computeFitSize(container);
      term.resize(cols, rows);
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    };
    ws.onclose = () => { if (onStatus) onStatus({ running: null, lastExitInfo: null }); };
  });

  return {
    dispose() {
      disposed = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (ws) ws.close();
      if (term) term.dispose();
    },
    restart() {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'restart' }));
    },
    write(data) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
      promptBuffer = '';
      lastPromptKind = null;
    },
  };
}
