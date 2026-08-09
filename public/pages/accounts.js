import { connectTerminal } from '/lib/terminal.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function serverFromUrl(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

function fmtUptime(startedAt) {
  if (!startedAt) return null;
  const secs = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtRelTime(iso) {
  if (!iso) return '';
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `vor ${secs}s`;
  if (secs < 3600) return `vor ${Math.floor(secs / 60)}m`;
  return `vor ${Math.floor(secs / 3600)}h`;
}

export default {
  id: 'accounts',
  label: 'Account-Verwaltung',
  icon: '🗂',
  mount(container, ctx) {
    const css = `
      .accounts-page .add-card {
        background: linear-gradient(180deg, var(--panel), var(--panel-2));
        border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 14px;
        position: relative; overflow: hidden;
      }
      .accounts-page .add-card::before {
        content: ''; position: absolute; top: -60px; left: -60px; width: 160px; height: 160px;
        background: radial-gradient(circle, rgba(79,140,255,0.18), transparent 70%); pointer-events: none;
      }
      .accounts-page .add-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; position: relative; }
      .accounts-page .add-icon {
        width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px;
        background: linear-gradient(135deg, var(--accent), #7a5cff);
        display: flex; align-items: center; justify-content: center; font-size: 18px;
        box-shadow: 0 4px 12px rgba(79,140,255,0.3);
      }
      .accounts-page .add-title { font-weight: 700; font-size: 15px; }
      .accounts-page .add-subtitle { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
      .accounts-page .add-form { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; position: relative; }
      .accounts-page .field { display: flex; flex-direction: column; gap: 6px; }
      .accounts-page .field label { font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
      .accounts-page .field input {
        background: var(--input-bg); border: 1px solid var(--border); color: var(--text);
        border-radius: var(--radius-lg); padding: 9px 12px; font-size: 13px; min-width: 200px;
        transition: border-color .15s, box-shadow .15s;
      }
      .accounts-page .field input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,140,255,0.18); }
      .accounts-page .field select {
        background: var(--input-bg); border: 1px solid var(--border); color: var(--text);
        border-radius: var(--radius-lg); padding: 9px 12px; font-size: 13px; min-width: 160px;
      }
      .accounts-page .node-select {
        background: var(--panel-2); border: 1px solid var(--border); color: var(--text);
        border-radius: 8px; padding: 5px 8px; font-size: 12px;
      }
      .accounts-page .node-badge { display: inline-block; font-size: 10.5px; color: var(--accent); border: 1px solid var(--accent); border-radius: 6px; padding: 1px 6px; margin-left: 6px; }
      .accounts-page .password-wrap { position: relative; }
      .accounts-page .password-wrap input { padding-right: 38px; }
      .accounts-page .password-toggle {
        position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
        background: none; border: none; cursor: pointer; font-size: 15px; opacity: 0.6; padding: 4px; line-height: 1;
      }
      .accounts-page .password-toggle:hover { opacity: 1; }
      .accounts-page .add-btn {
        width: auto; padding: 10px 20px; border: none; border-radius: 10px; font-weight: 700;
        background: linear-gradient(135deg, var(--accent), #7a5cff); color: #fff;
        box-shadow: 0 6px 16px rgba(79,140,255,0.28); cursor: pointer; transition: transform .1s, box-shadow .15s;
      }
      .accounts-page .add-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(79,140,255,0.38); }
      .accounts-page .add-hint { font-size: 11px; color: var(--muted); margin-top: 8px; position: relative; }
      .accounts-page .profile-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: 10px; overflow: hidden; }
      .accounts-page .profile-head { display: flex; align-items: center; gap: 12px; padding: 12px 14px; flex-wrap: wrap; }
      .accounts-page .profile-info { flex: 1; min-width: 160px; }
      .accounts-page .profile-nickname-row { display: flex; align-items: center; gap: 6px; }
      .accounts-page .profile-nickname { font-weight: 600; font-size: 14px; }
      .accounts-page .rename-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 0; }
      .accounts-page .rename-btn:hover { color: var(--text); }
      .accounts-page .profile-meta { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
      .accounts-page .profile-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .accounts-page .profile-actions button { width: auto; padding: 6px 12px; font-size: 12px; }
      .accounts-page .btn-danger { background: transparent; border: 1px solid var(--red); color: var(--red); border-radius: 8px; cursor: pointer; }
      .accounts-page .btn-secondary { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; cursor: pointer; }
      .accounts-page .btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }
      .accounts-page .status-wrap { display: flex; align-items: center; gap: 6px; }
      .accounts-page .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
      .accounts-page .status-dot.running { background: var(--green); box-shadow: 0 0 6px var(--green); }
      .accounts-page .status-dot.logged_in { background: var(--accent); box-shadow: 0 0 6px var(--accent); }
      .accounts-page .status-dot.connecting { background: var(--yellow); }
      .accounts-page .status-dot.offline { background: var(--muted); }
      .accounts-page .status-text { font-size: 11px; color: var(--muted); white-space: nowrap; }
      .accounts-page .profile-term { display: none; border-top: 1px solid var(--border); padding: 10px; background: var(--surface-sunken); height: 420px; }
      .accounts-page .profile-term.open { display: block; }
      .accounts-page .profile-details { display: flex; gap: 18px; flex-wrap: wrap; padding: 0 16px 14px; font-size: 11.5px; }
      .accounts-page .detail-block { min-width: 160px; flex: 1; }
      .accounts-page .detail-block h4 { margin: 0 0 6px; font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }
      .accounts-page .stat-line { color: var(--text); line-height: 1.7; }
      .accounts-page .stat-line b { color: var(--muted); font-weight: 500; }
      .accounts-page .mini-list { list-style: none; margin: 0; padding: 0; }
      .accounts-page .mini-list li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 8px; padding: 2px 0; color: var(--text); }
      .accounts-page .mini-list li span:first-child { min-width: 0; overflow-wrap: break-word; }
      .accounts-page .mini-list .mini-time { color: var(--muted); flex-shrink: 0; }
      .accounts-page .mini-empty { color: var(--muted); }
      .accounts-page .empty-hint { color: var(--muted); font-size: 13px; padding: 20px 0; text-align: center; }
      .accounts-page .login-helper { display: none; padding: 12px 16px; border-top: 1px solid var(--border); background: var(--panel-2); }
      .accounts-page .login-helper.visible { display: block; }
      .accounts-page .login-helper-label { font-size: 11.5px; color: var(--muted); margin-bottom: 8px; }
      .accounts-page .login-helper-row { display: flex; gap: 8px; align-items: center; }
      .accounts-page .login-helper input[type="password"], .accounts-page .login-helper input[type="text"] { flex: 1; background: var(--panel); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 7px 10px; font-size: 13px; }
      .accounts-page .char-btn { display: block; width: 100%; text-align: left; background: var(--panel); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 9px 12px; cursor: pointer; margin-bottom: 6px; font-size: 13px; }
      .accounts-page .char-btn:last-child { margin-bottom: 0; }
      .accounts-page .char-btn:hover { background: var(--panel-hover); border-color: var(--accent); }
      .accounts-page .char-btn .char-url { color: var(--muted); font-size: 11px; margin-left: 6px; }
      .accounts-page .login-group { margin-bottom: 20px; }
      .accounts-page .login-group-header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px 10px 0 0; flex-wrap: wrap; }
      .accounts-page .login-group-title { font-weight: 600; font-size: 13px; flex: 1; }
      .accounts-page .login-group-count { font-size: 11px; color: var(--muted); font-weight: 400; }
      .accounts-page .login-group-actions { display: flex; gap: 6px; flex-wrap: wrap; }
      .accounts-page .login-group-actions button { width: auto; padding: 5px 10px; font-size: 11px; }
      .accounts-page .login-group-body { border: 1px solid var(--border); border-top: none; border-radius: 0 0 10px 10px; padding: 10px; }
      .accounts-page .login-group-body .profile-card:last-child { margin-bottom: 0; }
      .accounts-page .login-group-status { font-size: 11px; color: var(--muted); width: 100%; margin-top: 4px; }
      @media (max-width: 480px) {
        .accounts-page .profile-term { height: 320px; }
        .accounts-page .field input { min-width: 0; width: 100%; }
        .accounts-page .add-form { flex-direction: column; align-items: stretch; }
        .accounts-page .add-btn { width: 100%; }
      }
    `;
    ctx.injectStyleOnce('accounts', css);

    const wrap = document.createElement('div');
    wrap.className = 'accounts-page';
    wrap.innerHTML = `
      <h1 class="page-title">Account-Verwaltung</h1>
      <div class="add-card">
        <div class="add-header">
          <div class="add-icon">➕</div>
          <div>
            <div class="add-title">Neuen Account hinzufügen</div>
            <div class="add-subtitle">Einmal einloggen — alle Charaktere dieses Logins werden automatisch gefunden</div>
          </div>
        </div>
        <div class="add-form">
          <div class="field">
            <label for="acc-username">S&amp;F-Username</label>
            <input type="text" id="acc-username" placeholder="Username" autocomplete="off" />
          </div>
          <div class="field">
            <label for="acc-password">Passwort</label>
            <input type="password" id="acc-password" placeholder="Passwort" autocomplete="off" />
          </div>
          <div class="field">
            <label for="acc-node">Node</label>
            <select id="acc-node"><option value="">Lokal (dieser Server)</option></select>
          </div>
          <button class="add-btn" id="acc-add-btn">Account hinzufügen</button>
        </div>
        <div class="add-hint">Wir loggen einmal automatisiert ein, um alle Charaktere dieses Logins zu finden, und legen für jeden ein fertiges Profil an. Das Passwort wird verschlüsselt gespeichert (AES-256), damit künftige Starts vollautomatisch ablaufen — nie im Klartext, nie im Browser.</div>
        <div class="add-hint" id="acc-add-status"></div>
      </div>
      <div id="profiles-list"></div>
    `;
    container.appendChild(wrap);

    (function addPasswordToggle() {
      const input = wrap.querySelector('#acc-password');
      const fieldWrap = document.createElement('div');
      fieldWrap.className = 'password-wrap';
      input.parentNode.insertBefore(fieldWrap, input);
      fieldWrap.appendChild(input);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'password-toggle';
      btn.textContent = '👁';
      btn.setAttribute('aria-label', 'Passwort anzeigen');
      btn.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? '🙈' : '👁';
      });
      fieldWrap.appendChild(btn);
    })();

    let nodesById = new Map();

    async function loadNodeOptions() {
      let nodes = [];
      try { nodes = await ctx.fetchJSON('/api/nodes'); } catch (e) { /* Nodes-Feature evtl. nicht verfügbar, still lokal weiterlaufen */ }
      nodesById = new Map(nodes.map(n => [n.id, n]));
      const select = wrap.querySelector('#acc-node');
      const current = select.value;
      select.innerHTML = '<option value="">Lokal (dieser Server)</option>' +
        nodes.map(n => `<option value="${n.id}">${escapeHtml(n.name)}</option>`).join('');
      select.value = current;
      return nodes;
    }

    function nodeOptionsHtml(selectedId) {
      return '<option value="">Lokal (dieser Server)</option>' +
        [...nodesById.values()].map(n => `<option value="${n.id}" ${n.id === selectedId ? 'selected' : ''}>${escapeHtml(n.name)}</option>`).join('');
    }

    const openTerminals = new Map(); // profileId -> { handle }

    function closeTerminal(id) {
      const t = openTerminals.get(id);
      if (t) { t.handle.dispose(); openTerminals.delete(id); }
    }

    function metaLine(p) {
      const nodeBadge = p.nodeId ? `<span class="node-badge">🖧 ${escapeHtml(nodesById.get(p.nodeId)?.name || '?')}</span>` : '';
      const classBadge = p.characterClass ? `<span class="node-badge">${escapeHtml(p.characterClass)}</span>` : '';
      if (p.server && p.characterName) {
        return `${escapeHtml(p.username)} · ${escapeHtml(p.characterName)} @ ${escapeHtml(p.server)}${classBadge}${nodeBadge}`;
      }
      return `${escapeHtml(p.username)} · noch nicht eingeloggt${nodeBadge}`;
    }

    function statusInfo(botState, currentActivity) {
      switch (botState) {
        case 'running': return { cls: 'running', text: currentActivity ? `Running · ${currentActivity}` : 'Running' };
        case 'logged_in': return { cls: 'logged_in', text: 'Eingeloggt' };
        case 'connecting': return { cls: 'connecting', text: 'Verbindet...' };
        default: return { cls: 'offline', text: 'Offline' };
      }
    }

    // Klasse wird einmalig automatisch ermittelt (sf-api-bridge-Login), nacheinander statt
    // parallel, um nicht mehrere echte Spiele-Logins gleichzeitig auszulösen. Best-effort:
    // Fehler (z. B. Bridge gerade offline) werden ignoriert, die Karte zeigt dann weiterhin
    // keine Klasse an, der manuelle "🔄 Klasse"-Button bleibt als Fallback.
    let backfillRunning = false;
    async function backfillMissingClasses(profiles) {
      if (backfillRunning) return;
      const targets = profiles.filter(p => p.server && p.characterName && p.hasPassword && !p.characterClass);
      if (!targets.length) return;
      backfillRunning = true;
      let any = false;
      for (const p of targets) {
        try {
          await ctx.fetchJSON(`/api/gamestate/${encodeURIComponent(p.id)}`);
          any = true;
        } catch (err) { /* still-offline bridge or login failure — retry next page visit */ }
      }
      backfillRunning = false;
      if (any) await loadProfiles();
    }

    async function loadProfiles() {
      const list = wrap.querySelector('#profiles-list');
      await loadNodeOptions();
      let profiles;
      try {
        profiles = await ctx.fetchJSON('/api/profiles');
      } catch (err) {
        list.innerHTML = `<p class="empty-hint">Fehler: ${escapeHtml(err.message)}</p>`;
        return;
      }
      if (!profiles.length) {
        list.innerHTML = `<p class="empty-hint">Noch keine Accounts angelegt. Leg oben einen an, um ihn einzeln starten zu können.</p>`;
        return;
      }

      const groups = new Map();
      profiles.forEach(p => {
        if (!groups.has(p.username)) groups.set(p.username, []);
        groups.get(p.username).push(p);
      });

      function detailsHtml(p) {
        if (!p.status.running) return '';
        const uptime = fmtUptime(p.status.startedAt);
        const history = p.activityHistory || [];
        const scouted = p.scoutedPlayers || [];
        return `
          <div class="profile-details">
            <div class="detail-block">
              <h4>Session</h4>
              <div class="stat-line">
                ${uptime ? `<b>Laufzeit:</b> ${uptime}<br>` : ''}
                <b>Befehle gesendet:</b> ${p.status.commandsSent ?? 0}<br>
                <b>Fehler/Warnungen:</b> ${p.status.errorsSeen ?? 0}
              </div>
            </div>
            <div class="detail-block">
              <h4>Letzte Aktionen</h4>
              ${history.length ? `<ul class="mini-list">${history.map(h =>
                `<li><span>${escapeHtml(h.label)}</span><span class="mini-time">${fmtRelTime(h.at)}</span></li>`).join('')}</ul>`
                : '<div class="mini-empty">Noch keine erfasst</div>'}
            </div>
            <div class="detail-block">
              <h4>Zuletzt gescoutet</h4>
              ${scouted.length ? `<ul class="mini-list">${scouted.map(s =>
                `<li><span>${escapeHtml(s.name)}</span><span class="mini-time">${fmtRelTime(s.at)}</span></li>`).join('')}</ul>`
                : '<div class="mini-empty">Noch niemand</div>'}
            </div>
          </div>`;
      }

      function profileCardHtml(p) {
        const hasCharacter = !!(p.server && p.characterName);
        const paused = (p.pausedKeys || []).length > 0;
        const st = statusInfo(p.status.botState, p.currentActivity);
        return `
        <div class="profile-card" data-id="${p.id}">
          <div class="profile-head">
            <div class="status-wrap">
              <span class="status-dot ${st.cls}" data-role="dot"></span>
              <span class="status-text" data-role="status-text">${st.text}</span>
            </div>
            <div class="profile-info">
              <div class="profile-nickname-row">
                <span class="profile-nickname char-name" data-role="nickname">${escapeHtml(p.nickname)}</span>
                <button class="rename-btn" data-action="rename" title="Umbenennen">✏️</button>
              </div>
              <div class="profile-meta char-name" data-role="meta">${metaLine(p)}</div>
            </div>
            <div class="profile-actions">
              <button class="btn btn-primary" data-action="start" ${p.status.running ? 'disabled' : ''}>Start</button>
              <button class="btn-secondary" data-action="stop" ${p.status.running ? '' : 'disabled'}>Stop</button>
              <button class="btn-secondary" data-action="pause" ${hasCharacter && !paused ? '' : 'disabled'} title="Schaltet alle Automatisierungen aus (kein garantierter Sofort-Effekt, nur Konfiguration)">${paused ? 'Pausiert' : 'Pause'}</button>
              <button class="btn-secondary" data-action="resume" ${paused ? '' : 'disabled'}>Fortsetzen</button>
              <button class="btn-secondary" data-action="claim" ${hasCharacter && p.hasPassword ? '' : 'disabled'} title="Kalender, Tagesaufgaben und ausstehende Freischaltungen abholen">Einlösen</button>
              <button class="btn-secondary" data-action="detect-class" ${hasCharacter && p.hasPassword ? '' : 'disabled'} title="Spielklasse abrufen (für die Account-Analyse)">🔄 Klasse</button>
              <button class="btn-secondary" data-action="toggle-term">Konsole</button>
              <select class="node-select" data-action="move-node" title="Auf einen anderen Node verschieben">${nodeOptionsHtml(p.nodeId)}</select>
              <button class="btn-danger" data-action="delete">Löschen</button>
            </div>
          </div>
          ${detailsHtml(p)}
          <div class="login-helper" data-role="login-helper"></div>
          <div class="profile-term" data-role="term-container"></div>
        </div>
      `;
      }

      list.innerHTML = [...groups.entries()].map(([username, members]) => `
        <div class="login-group" data-username="${escapeHtml(username)}">
          <div class="login-group-header">
            <span class="login-group-title char-name">${escapeHtml(username)} <span class="login-group-count">(${members.length} Charakter${members.length === 1 ? '' : 'e'})</span></span>
            <div class="login-group-actions">
              <button class="btn-secondary" data-group-action="refresh">⟳ Neue Charaktere suchen</button>
              <button class="btn-secondary" data-group-action="start-all">Alle starten</button>
              <button class="btn-secondary" data-group-action="stop-all">Alle stoppen</button>
              <button class="btn-secondary" data-group-action="pause-all">Alle pausieren</button>
              <button class="btn-danger" data-group-action="remove-login">Account entfernen</button>
            </div>
            <div class="login-group-status" data-role="group-status"></div>
          </div>
          <div class="login-group-body">
            ${members.map(profileCardHtml).join('')}
          </div>
        </div>
      `).join('');

      list.querySelectorAll('.profile-card').forEach(card => {
        const id = card.dataset.id;
        const profile = profiles.find(p => p.id === id);

        async function renameProfile(nickname) {
          const trimmed = (nickname || '').trim();
          if (!trimmed) return;
          try {
            await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/nickname`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nickname: trimmed }),
            });
            profile.nickname = trimmed;
            card.querySelector('[data-role="nickname"]').textContent = trimmed;
          } catch (err) {
            alert('Umbenennen fehlgeschlagen: ' + err.message);
          }
        }

        card.querySelector('[data-action="rename"]').addEventListener('click', () => {
          const next = prompt('Neuer Spitzname:', profile.nickname);
          if (next !== null) renameProfile(next);
        });

        card.querySelector('[data-action="start"]').addEventListener('click', async () => {
          await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/start`, { method: 'POST' });
          await loadProfiles();
        });
        card.querySelector('[data-action="stop"]').addEventListener('click', async () => {
          closeTerminal(id);
          await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/stop`, { method: 'POST' });
          await loadProfiles();
        });
        card.querySelector('[data-action="pause"]').addEventListener('click', async () => {
          try {
            await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/pause`, { method: 'POST' });
            await loadProfiles();
          } catch (err) {
            alert('Pausieren fehlgeschlagen: ' + err.message);
          }
        });
        card.querySelector('[data-action="resume"]').addEventListener('click', async () => {
          try {
            await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/resume`, { method: 'POST' });
            await loadProfiles();
          } catch (err) {
            alert('Fortsetzen fehlgeschlagen: ' + err.message);
          }
        });
        const claimBtn = card.querySelector('[data-action="claim"]');
        if (claimBtn) {
          claimBtn.addEventListener('click', async () => {
            const original = claimBtn.textContent;
            claimBtn.disabled = true;
            claimBtn.textContent = 'Löse ein…';
            try {
              await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/claim`, { method: 'POST' });
              claimBtn.textContent = 'Eingelöst ✓';
            } catch (err) {
              claimBtn.textContent = original;
              alert('Einlösen fehlgeschlagen: ' + err.message);
            } finally {
              setTimeout(() => { claimBtn.disabled = false; claimBtn.textContent = original; }, 2500);
            }
          });
        }

        const detectClassBtn = card.querySelector('[data-action="detect-class"]');
        if (detectClassBtn) {
          detectClassBtn.addEventListener('click', async () => {
            const original = detectClassBtn.textContent;
            detectClassBtn.disabled = true;
            detectClassBtn.textContent = 'Erkenne…';
            try {
              await ctx.fetchJSON(`/api/gamestate/${encodeURIComponent(id)}`);
              await loadProfiles();
            } catch (err) {
              detectClassBtn.textContent = original;
              alert('Klassenerkennung fehlgeschlagen: ' + err.message);
            } finally {
              detectClassBtn.disabled = !(hasCharacter && p.hasPassword);
            }
          });
        }

        card.querySelector('[data-action="move-node"]').addEventListener('change', async (ev) => {
          const nodeId = ev.target.value || null;
          const targetName = nodeId ? (nodesById.get(nodeId)?.name || nodeId) : 'lokal (diesen Server)';
          if (!confirm(`Account "${profile.nickname}" auf ${targetName} verschieben? Läuft er gerade, wird er dabei gestoppt und muss dort neu gestartet werden.`)) {
            ev.target.value = profile.nodeId || '';
            return;
          }
          closeTerminal(id);
          try {
            await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/node`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nodeId }),
            });
            await loadProfiles();
          } catch (err) {
            alert('Verschieben fehlgeschlagen: ' + err.message);
            ev.target.value = profile.nodeId || '';
          }
        });

        card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          if (!confirm(`Account-Profil "${profile.nickname}" wirklich löschen? Läuft die CLI gerade, wird sie gestoppt. Deine Spieldaten (Statistiken, Kampfhistorie) bleiben erhalten, verschwinden aber aus der Übersicht.`)) return;
          closeTerminal(id);
          await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
          await loadProfiles();
        });

        // Konsole ist eine reine Anzeige, unabhängig von Start/Stop — das CLI-Fenster wird
        // nur sichtbar, wenn man das hier explizit anklickt.
        card.querySelector('[data-action="toggle-term"]').addEventListener('click', () => {
          const termEl = card.querySelector('[data-role="term-container"]');
          const helperEl = card.querySelector('[data-role="login-helper"]');
          if (termEl.classList.contains('open')) {
            termEl.classList.remove('open');
            helperEl.classList.remove('visible');
            helperEl.innerHTML = '';
            closeTerminal(id);
            return;
          }
          termEl.classList.add('open');
          const dot = card.querySelector('[data-role="dot"]');
          const statusTextEl = card.querySelector('[data-role="status-text"]');

          function showPasswordHelper() {
            helperEl.classList.add('visible');
            helperEl.innerHTML = `
              <div class="login-helper-label">Passwort für <span class="char-name">${escapeHtml(profile.nickname)}</span> (wird nirgends gespeichert)</div>
              <div class="login-helper-row">
                <input type="password" data-role="pw-input" placeholder="Passwort" autocomplete="off" />
                <button class="btn btn-primary" data-role="pw-submit" style="width:auto;padding:7px 16px;">Einloggen</button>
              </div>
            `;
            const input = helperEl.querySelector('[data-role="pw-input"]');
            const submit = () => {
              if (!input.value) return;
              handle.write(input.value + '\r');
              input.value = '';
              helperEl.classList.remove('visible');
              helperEl.innerHTML = '';
            };
            helperEl.querySelector('[data-role="pw-submit"]').addEventListener('click', submit);
            input.addEventListener('keydown', ev => { if (ev.key === 'Enter') submit(); });
            input.focus();
          }

          function showCharacterHelper(characters) {
            helperEl.classList.add('visible');
            helperEl.innerHTML = `
              <div class="login-helper-label">Charakter wählen</div>
              ${characters.map(c => `
                <button class="char-btn" data-index="${c.index}" data-name="${escapeHtml(c.name)}" data-url="${escapeHtml(c.url)}">
                  <span class="char-name">${escapeHtml(c.name)}</span>
                  <span class="char-url">${escapeHtml(c.url)}</span>
                </button>`).join('')}
            `;
            helperEl.querySelectorAll('.char-btn').forEach(btn => {
              btn.addEventListener('click', () => showNicknameStep(btn.dataset.index, btn.dataset.name, btn.dataset.url));
            });
          }

          function showNicknameStep(index, charName, url) {
            helperEl.innerHTML = `
              <div class="login-helper-label">Spitzname für <span class="char-name">${escapeHtml(charName)}</span></div>
              <div class="login-helper-row">
                <input type="text" data-role="nick-input" value="${escapeHtml(charName)}" />
                <button class="btn btn-primary" data-role="nick-submit" style="width:auto;padding:7px 16px;">Bestätigen</button>
              </div>
            `;
            const input = helperEl.querySelector('[data-role="nick-input"]');
            const submit = async () => {
              const nickname = input.value.trim() || charName;
              try {
                await ctx.fetchJSON(`/api/profiles/${encodeURIComponent(id)}/character`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ nickname, server: serverFromUrl(url), characterName: charName }),
                });
              } catch (e) { /* Login trotzdem fortsetzen, auch wenn das Speichern scheitert */ }
              handle.write(index + '\r');
              helperEl.classList.remove('visible');
              helperEl.innerHTML = '';
            };
            helperEl.querySelector('[data-role="nick-submit"]').addEventListener('click', submit);
            input.addEventListener('keydown', ev => { if (ev.key === 'Enter') submit(); });
            input.select();
          }

          // Ist bereits ein Passwort gespeichert UND der Charakter bekannt, läuft der Login
          // serverseitig voll automatisch (siehe ptyManager) — die Login-Hilfe würde sonst kurz
          // aufblitzen, obwohl der Server die Eingabe längst selbst erledigt hat.
          const needsManualHelp = !(profile.hasPassword && profile.characterName);

          const handle = connectTerminal({
            container: termEl,
            profileId: id,
            redactTerms: [profile.username, profile.characterName, profile.nickname].filter(Boolean),
            onStatus: (status) => {
              if (!status.botState) return; // WS getrennt, kein PTY-Status bekannt
              const info = statusInfo(status.botState);
              dot.className = 'status-dot ' + info.cls;
              statusTextEl.textContent = info.text;
            },
            onPrompt: needsManualHelp ? (prompt) => {
              if (prompt.kind === 'password') showPasswordHelper();
              else if (prompt.kind === 'character-index') showCharacterHelper(prompt.characters);
            } : undefined,
          });
          openTerminals.set(id, { handle });
        });
      });

      list.querySelectorAll('.login-group').forEach(group => {
        const username = group.dataset.username;
        const memberIds = [...group.querySelectorAll('.profile-card')].map(c => c.dataset.id);
        const statusEl = group.querySelector('[data-role="group-status"]');

        group.querySelector('[data-group-action="refresh"]').addEventListener('click', async () => {
          statusEl.textContent = 'Suche neue Charaktere...';
          try {
            const result = await ctx.fetchJSON(`/api/logins/${encodeURIComponent(username)}/refresh`, { method: 'POST' });
            statusEl.textContent = result.created.length
              ? `${result.created.length} neue(r) Charakter gefunden: ${result.created.map(p => p.characterName).join(', ')}`
              : `Keine neuen Charaktere (insgesamt ${result.totalFound} bekannt).`;
            await loadProfiles();
          } catch (err) {
            statusEl.textContent = 'Fehler: ' + err.message;
          }
        });

        group.querySelector('[data-group-action="start-all"]').addEventListener('click', async () => {
          statusEl.textContent = 'Starte alle...';
          await Promise.all(memberIds.map(mid =>
            ctx.fetchJSON(`/api/profiles/${encodeURIComponent(mid)}/start`, { method: 'POST' }).catch(() => {})));
          statusEl.textContent = '';
          await loadProfiles();
        });

        group.querySelector('[data-group-action="stop-all"]').addEventListener('click', async () => {
          statusEl.textContent = 'Stoppe alle...';
          memberIds.forEach(closeTerminal);
          await Promise.all(memberIds.map(mid =>
            ctx.fetchJSON(`/api/profiles/${encodeURIComponent(mid)}/stop`, { method: 'POST' }).catch(() => {})));
          statusEl.textContent = '';
          await loadProfiles();
        });

        group.querySelector('[data-group-action="pause-all"]').addEventListener('click', async () => {
          statusEl.textContent = 'Pausiere alle...';
          await Promise.all(memberIds.map(mid =>
            ctx.fetchJSON(`/api/profiles/${encodeURIComponent(mid)}/pause`, { method: 'POST' }).catch(() => {})));
          statusEl.textContent = '';
          await loadProfiles();
        });

        group.querySelector('[data-group-action="remove-login"]').addEventListener('click', async () => {
          if (!confirm(`Account "${username}" komplett entfernen? Alle ${memberIds.length} Charakter-Profile und das gespeicherte Passwort werden gelöscht. Deine Spieldaten bleiben erhalten, verschwinden aber aus der Übersicht.`)) return;
          memberIds.forEach(closeTerminal);
          await ctx.fetchJSON(`/api/logins/${encodeURIComponent(username)}`, { method: 'DELETE' });
          await loadProfiles();
        });
      });

      backfillMissingClasses(profiles);
    }

    wrap.querySelector('#acc-add-btn').addEventListener('click', async () => {
      const username = wrap.querySelector('#acc-username').value.trim();
      const password = wrap.querySelector('#acc-password').value;
      const nodeId = wrap.querySelector('#acc-node').value || undefined;
      const status = wrap.querySelector('#acc-add-status');
      if (!username || !password) {
        status.textContent = 'Bitte Username und Passwort angeben.';
        return;
      }
      status.textContent = 'Logge testweise ein, suche Charaktere...';
      try {
        const result = await ctx.fetchJSON('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, nodeId }),
        });
        wrap.querySelector('#acc-username').value = '';
        wrap.querySelector('#acc-password').value = '';
        const names = result.created.map(p => p.characterName).join(', ');
        status.textContent = result.created.length
          ? `${result.created.length} Charakter(e) angelegt: ${names}`
          : 'Keine neuen Charaktere (evtl. schon vorhanden).';
        await loadProfiles();
      } catch (err) {
        status.textContent = 'Fehler: ' + err.message;
      }
    });

    loadProfiles();
    const interval = setInterval(() => {
      // Nur Status aktualisieren, keine offenen Terminals stören
      if (openTerminals.size === 0) loadProfiles();
    }, 5000);

    return () => {
      clearInterval(interval);
      openTerminals.forEach(t => t.handle.dispose());
    };
  }
};
