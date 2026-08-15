import { t } from '/lib/i18n.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtRelTime(iso) {
  if (!iso) return t('nodes.never');
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return t('nodes.secsAgo', { secs });
  if (secs < 3600) return t('nodes.minsAgo', { mins: Math.floor(secs / 60) });
  return t('nodes.hoursAgo', { hours: Math.floor(secs / 3600) });
}

export default {
  id: 'nodes',
  label: 'Nodes',
  icon: '🖧',
  mount(container, ctx) {
    const css = `
      .nodes-page .add-card {
        background: linear-gradient(180deg, var(--panel), var(--panel-2));
        border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 14px;
      }
      .nodes-page .add-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
      .nodes-page .add-icon {
        width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px;
        background: linear-gradient(135deg, var(--accent), #7a5cff);
        display: flex; align-items: center; justify-content: center; font-size: 18px;
      }
      .nodes-page .add-title { font-weight: 700; font-size: 15px; }
      .nodes-page .add-subtitle { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
      .nodes-page .add-form { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
      .nodes-page .field { display: flex; flex-direction: column; gap: 6px; }
      .nodes-page .field label { font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
      .nodes-page .field input {
        background: var(--input-bg); border: 1px solid var(--border); color: var(--text);
        border-radius: var(--radius-lg); padding: 9px 12px; font-size: 13px; min-width: 160px;
      }
      .nodes-page .field input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,140,255,0.18); }
      .nodes-page .field.code input { min-width: 120px; text-transform: uppercase; letter-spacing: 0.08em; }
      .nodes-page .add-btn {
        width: auto; padding: 10px 20px; border: none; border-radius: 10px; font-weight: 700;
        background: linear-gradient(135deg, var(--accent), #7a5cff); color: #fff; cursor: pointer;
      }
      .nodes-page .add-hint { font-size: 11px; color: var(--muted); margin-top: 8px; }

      .nodes-page #nodes-list {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; align-items: start;
      }
      .nodes-page .node-card {
        background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg);
        padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0;
      }
      .nodes-page .node-head { display: flex; align-items: flex-start; gap: 10px; }
      .nodes-page .node-info { flex: 1; min-width: 0; }
      .nodes-page .node-name-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .nodes-page .node-name { font-weight: 600; font-size: 14px; overflow-wrap: anywhere; }
      .nodes-page .rename-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 0; flex-shrink: 0; }
      .nodes-page .rename-btn:hover { color: var(--text); }
      .nodes-page .node-meta { font-size: 11px; color: var(--muted); margin-top: 2px; overflow-wrap: anywhere; }
      .nodes-page .node-ping-row { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
      .nodes-page .node-ping-row button { width: auto; padding: 4px 10px; font-size: 11px; }
      .nodes-page .vpn-status-badge { color: var(--red); border-color: var(--red); }
      .nodes-page .vpn-status-badge.vpn-active { color: var(--green); border-color: var(--green); }
      .nodes-page .ping-result { font-size: 10.5px; color: var(--muted); white-space: nowrap; }
      .nodes-page .node-stats {
        display: flex; gap: 10px; flex-wrap: wrap; padding-top: 10px; border-top: 1px solid var(--border);
        font-size: 11px; color: var(--muted);
      }
      .nodes-page .node-updates { display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px solid var(--border); }
      .nodes-page .update-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
      .nodes-page .update-row .update-label { color: var(--muted); width: 74px; flex-shrink: 0; }
      .nodes-page .update-row button { width: auto; padding: 3px 10px; font-size: 11px; margin-left: auto; }
      .nodes-page .icon-btn-tiny { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 2px; }
      .nodes-page .icon-btn-tiny:hover { color: var(--text); }
      .nodes-page .node-badge-local { display: inline-block; font-size: 10px; color: var(--accent); border: 1px solid var(--accent); border-radius: 6px; padding: 1px 6px; flex-shrink: 0; }
      .nodes-page .node-quick-actions { padding-top: 10px; border-top: 1px solid var(--border); }
      .nodes-page .quick-actions-label { font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 6px; display: block; }
      .nodes-page .quick-actions-buttons { display: flex; gap: 6px; flex-wrap: wrap; }
      .nodes-page .node-quick-actions button { width: auto; padding: 5px 10px; font-size: 11px; }
      .nodes-page .node-quick-actions .btn-warn { background: rgba(240,180,41,0.12); border: 1px solid var(--yellow); color: var(--yellow); border-radius: 8px; cursor: pointer; }
      .nodes-page .quick-action-result { font-size: 10.5px; color: var(--muted); margin-top: 4px; display: block; }
      .nodes-page .node-footer { display: flex; justify-content: flex-end; }
      .nodes-page .btn-danger { background: transparent; border: 1px solid var(--red); color: var(--red); border-radius: 8px; cursor: pointer; width: auto; padding: 5px 10px; font-size: 11px; }
      .nodes-page .btn-secondary { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; cursor: pointer; }
      .nodes-page .status-wrap { display: flex; align-items: center; padding-top: 2px; flex-shrink: 0; }
      .nodes-page .status-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
      .nodes-page .status-dot.online { background: var(--green); box-shadow: 0 0 6px var(--green); }
      .nodes-page .status-dot.offline { background: var(--red); }
      .nodes-page .empty-hint { color: var(--muted); font-size: 13px; padding: 20px 0; text-align: center; }
      @media (max-width: 480px) {
        .nodes-page #nodes-list { grid-template-columns: 1fr; }
        .nodes-page .field input { min-width: 0; width: 100%; }
        .nodes-page .add-form { flex-direction: column; align-items: stretch; }
        .nodes-page .add-btn { width: 100%; }
      }
    `;
    ctx.injectStyleOnce('nodes', css);

    const wrap = document.createElement('div');
    wrap.className = 'nodes-page';
    wrap.innerHTML = `
      <h1 class="page-title">${t('nodes.title')}</h1>
      <div class="add-card">
        <div class="add-header">
          <div class="add-icon">🖧</div>
          <div>
            <div class="add-title">${t('nodes.pairTitle')}</div>
            <div class="add-subtitle">${t('nodes.pairSubtitle')}</div>
          </div>
        </div>
        <div class="add-form">
          <div class="field">
            <label for="node-name">${t('nodes.nameLabel')}</label>
            <input type="text" id="node-name" placeholder="${t('nodes.namePlaceholder')}" autocomplete="off" />
          </div>
          <div class="field">
            <label for="node-host">${t('nodes.hostLabel')}</label>
            <input type="text" id="node-host" placeholder="203.0.113.10" autocomplete="off" />
          </div>
          <div class="field">
            <label for="node-port">Port</label>
            <input type="text" id="node-port" placeholder="8090" value="8090" autocomplete="off" />
          </div>
          <div class="field code">
            <label for="node-code">${t('nodes.codeLabel')}</label>
            <input type="text" id="node-code" placeholder="ABCD1234" autocomplete="off" maxlength="8" />
          </div>
          <button class="add-btn" id="node-add-btn">${t('nodes.pairBtn')}</button>
        </div>
        <div class="add-hint">${t('nodes.pairHint')}</div>
        <div class="add-hint" id="node-add-status"></div>
      </div>
      <div id="nodes-list"></div>
    `;
    container.appendChild(wrap);

    async function loadNodes() {
      const list = wrap.querySelector('#nodes-list');
      let nodes;
      try {
        nodes = await ctx.fetchJSON('/api/nodes');
      } catch (err) {
        list.innerHTML = `<p class="empty-hint">${t('analytics.loadError', { message: escapeHtml(err.message) })}</p>`;
        return;
      }
      if (!nodes.length) {
        list.innerHTML = `<p class="empty-hint">${t('nodes.emptyHint')}</p>`;
        return;
      }
      // Best-effort: die Node-Ansicht darf auch funktionieren, wenn die VPN-API mal nicht
      // erreichbar ist — dann bleibt der VPN-Badge einfach im "unbekannt"-Zustand.
      const vpnTargets = await ctx.fetchJSON('/api/vpn/targets').catch(() => []);
      const vpnByTarget = new Map(vpnTargets.map(vt => [vt.targetId, vt]));

      list.innerHTML = nodes.map(n => {
        const vpn = vpnByTarget.get(n.id);
        const vpnConnected = !!vpn?.lastStatus?.connected;
        return `
        <div class="node-card" data-id="${n.id}">
          <div class="node-head">
            <div class="status-wrap">
              <span class="status-dot ${n.lastStatus === 'online' ? 'online' : 'offline'}" data-role="dot"></span>
            </div>
            <div class="node-info">
              <div class="node-name-row">
                <span class="node-name char-name" data-role="name">${escapeHtml(n.name)}${n.isLocal ? ' ' + t('nodes.localDashboardSuffix') : ''}</span>
                ${n.isLocal ? `<span class="node-badge-local">${t('nodes.localBadge')}</span>` : `<button class="rename-btn" data-action="rename" title="${t('nodes.renameTitle')}">✏️</button>`}
              </div>
              <div class="node-meta" data-role="meta">${n.isLocal
                ? `${n.accountCount} ${n.accountCount === 1 ? 'Account' : 'Accounts'}`
                : t('nodes.metaLine', { host: escapeHtml(n.host), port: n.port, count: n.accountCount, accountWord: n.accountCount === 1 ? 'Account' : 'Accounts', lastSeen: fmtRelTime(n.lastSeen) })}</div>
            </div>
            <div class="node-ping-row">
              <button class="btn-secondary vpn-status-badge${vpnConnected ? ' vpn-active' : ''}" data-action="vpn-status" title="${t('nodes.vpnStatusTitle')}">${vpnConnected ? t('nodes.vpnActive') : t('nodes.vpnInactive')}</button>
              <button class="btn-secondary" data-action="ping">${t('nodes.pingBtn')}</button>
            </div>
          </div>
          <div class="ping-result" data-role="ping-result"></div>
          <div class="node-stats" data-role="stats">${t('nodes.statsUnavailable')}</div>
          <div class="node-updates">
            <div class="update-row">
              <span class="update-label">CLI</span>
              <span class="pill pill-off" data-role="cli-pill">${t('sidebar.checking')}</span>
              <button class="icon-btn-tiny" data-action="cli-check" title="${t('sidebar.forceCheckTitle')}">⟳</button>
              <button class="btn btn-primary" data-action="cli-apply" style="display:none;">Update</button>
            </div>
            <div class="update-row">
              <span class="update-label">Node-Agent</span>
              <span class="pill pill-off" data-role="agent-pill">${t('sidebar.checking')}</span>
              <button class="icon-btn-tiny" data-action="agent-check" title="${t('sidebar.forceCheckTitle')}">⟳</button>
              <button class="btn btn-primary" data-action="agent-apply" style="display:none;">Update</button>
            </div>
          </div>
          <div class="node-quick-actions">
            <span class="quick-actions-label">${t('nodes.quickActionsTitle')}</span>
            <div class="quick-actions-buttons">
              <button class="btn-secondary" data-action="restart-bots">${t('nodes.restartBotsBtn')}</button>
              <button class="btn-secondary" data-action="restart-service">${t('nodes.restartServiceBtn')}</button>
              <button class="btn-warn" data-action="reboot">${t('nodes.rebootBtn')}</button>
            </div>
            <span class="quick-action-result" data-role="quick-action-result"></span>
          </div>
          ${n.isLocal ? '' : `<div class="node-footer"><button class="btn-danger" data-action="remove">${t('nodes.removeBtn')}</button></div>`}
        </div>
      `;
      }).join('');

      list.querySelectorAll('.node-card').forEach(card => {
        const id = card.dataset.id;
        const node = nodes.find(n => n.id === id);

        card.querySelector('[data-action="rename"]')?.addEventListener('click', async () => {
          const next = prompt(t('nodes.renamePrompt'), node.name);
          if (next === null || !next.trim()) return;
          try {
            await ctx.fetchJSON(`/api/nodes/${encodeURIComponent(id)}/rename`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: next.trim() }),
            });
            await loadNodes();
          } catch (err) {
            alert(t('nodes.renameFailed', { message: err.message }));
          }
        });

        card.querySelector('[data-action="ping"]').addEventListener('click', async () => {
          const dot = card.querySelector('[data-role="dot"]');
          const resultEl = card.querySelector('[data-role="ping-result"]');
          resultEl.textContent = t('nodes.pingChecking');
          const startedAt = performance.now();
          try {
            const result = await ctx.fetchJSON(`/api/nodes/${encodeURIComponent(id)}/ping`, { method: 'POST' });
            const ms = Math.round(performance.now() - startedAt);
            dot.className = 'status-dot ' + (result.online ? 'online' : 'offline');
            resultEl.textContent = result.online ? t('nodes.pingOnline', { ms }) : t('nodes.pingOfflineWithReason', { message: result.error || t('nodes.pingOffline') });
          } catch (err) {
            dot.className = 'status-dot offline';
            resultEl.textContent = t('nodes.pingOfflineWithReason', { message: err.message });
          }
        });

        card.querySelector('[data-action="vpn-status"]').addEventListener('click', async () => {
          const badge = card.querySelector('[data-action="vpn-status"]');
          const original = badge.textContent;
          badge.textContent = t('common.loading');
          try {
            const status = await ctx.fetchJSON(`/api/vpn/targets/${encodeURIComponent(id)}/status`);
            badge.classList.toggle('vpn-active', !!status.connected);
            badge.textContent = status.connected ? t('nodes.vpnActive') : t('nodes.vpnInactive');
          } catch (err) {
            badge.textContent = original;
            alert(t('analytics.loadError', { message: err.message }));
          }
        });

        card.querySelector('[data-action="remove"]')?.addEventListener('click', async () => {
          if (!confirm(t('nodes.confirmRemove', { name: node.name }))) return;
          await ctx.fetchJSON(`/api/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' });
          await loadNodes();
        });

        // Grober Auslastungs-Überblick (CPU-Load/Kernanzahl, RAM%, Uptime) — best-effort, ein
        // nicht erreichbarer Node zeigt einfach "nicht verfügbar" statt die Karte kaputtzumachen.
        (async () => {
          const statsEl = card.querySelector('[data-role="stats"]');
          try {
            const s = await ctx.fetchJSON(`/api/nodes/${encodeURIComponent(id)}/system/stats`);
            const load = (s.loadAvg && s.loadAvg[0] != null) ? s.loadAvg[0].toFixed(2) : '?';
            const h = Math.floor(s.uptimeSec / 3600);
            const m = Math.floor((s.uptimeSec % 3600) / 60);
            const uptime = h ? `${h}h ${m}m` : `${m}m`;
            statsEl.innerHTML = `
              <span>🧠 ${t('nodes.statsCpu', { load, cores: s.cpuCount })}</span>
              <span>💾 ${t('nodes.statsRam', { percent: s.memUsedPercent })}</span>
              <span>⏱ ${t('nodes.statsUptime', { uptime })}</span>
            `;
          } catch (err) {
            statsEl.textContent = t('nodes.statsUnavailable');
          }
        })();

        function wireQuickAction(action, endpoint, confirmMsg, resultText) {
          const btn = card.querySelector(`[data-action="${action}"]`);
          const resultEl = card.querySelector('[data-role="quick-action-result"]');
          btn.addEventListener('click', async () => {
            if (confirmMsg && !confirm(confirmMsg)) return;
            btn.disabled = true;
            try {
              const result = await ctx.fetchJSON(`/api/nodes/${encodeURIComponent(id)}${endpoint}`, { method: 'POST' });
              resultEl.textContent = resultText(result);
            } catch (err) {
              resultEl.textContent = t('nodes.actionFailed', { message: err.message });
            } finally {
              btn.disabled = false;
              setTimeout(() => { resultEl.textContent = ''; }, 8000);
            }
          });
        }

        wireQuickAction('restart-bots', '/bots/restart', t('nodes.restartBotsConfirm', { name: node.name }),
          result => t('nodes.restartBotsResult', { count: result.restarted ?? 0 }));
        wireQuickAction('restart-service', '/service/restart', t('nodes.restartServiceConfirm', { name: node.name }),
          () => t('nodes.restartServiceResult'));
        wireQuickAction('reboot', '/system/reboot', t('nodes.rebootConfirm', { name: node.name }),
          () => t('nodes.rebootResult'));

        function wireUpdateBlock({ statusPath, checkPath, applyPath, pillSelector, checkSelector, applySelector, applyConfirm, versionLabel }) {
          const pill = card.querySelector(pillSelector);
          const checkBtn = card.querySelector(checkSelector);
          const applyBtn = card.querySelector(applySelector);

          function render(status) {
            if (status.applying) {
              pill.textContent = t('router.installing');
              pill.className = 'pill pill-warn';
              applyBtn.style.display = 'none';
            } else if (status.updateAvailable) {
              pill.textContent = t('nodes.updateAvailable');
              pill.className = 'pill pill-warn';
              applyBtn.style.display = '';
              applyBtn.disabled = false;
              applyBtn.textContent = 'Update';
            } else if (status.lastError) {
              pill.textContent = t('nodes.errorLabel');
              pill.className = 'pill pill-warn';
              pill.title = status.lastError;
              applyBtn.style.display = 'none';
            } else {
              pill.textContent = versionLabel(status);
              pill.className = 'pill pill-on';
              applyBtn.style.display = 'none';
            }
          }

          async function load() {
            try {
              render(await ctx.fetchJSON(`/api/nodes/${encodeURIComponent(id)}${statusPath}`));
            } catch (err) {
              pill.textContent = t('nodes.nodeUnreachable');
              pill.className = 'pill pill-off';
              applyBtn.style.display = 'none';
            }
          }

          checkBtn.addEventListener('click', async () => {
            checkBtn.classList.add('spinning');
            try {
              render(await ctx.fetchJSON(`/api/nodes/${encodeURIComponent(id)}${checkPath}`, { method: 'POST' }));
            } catch (err) {
              alert(t('router.checkFailed', { message: err.message }));
            } finally {
              checkBtn.classList.remove('spinning');
            }
          });

          applyBtn.addEventListener('click', async () => {
            if (applyConfirm && !confirm(applyConfirm)) return;
            applyBtn.disabled = true;
            applyBtn.textContent = t('router.installing');
            try {
              await ctx.fetchJSON(`/api/nodes/${encodeURIComponent(id)}${applyPath}`, { method: 'POST' });
              await load();
            } catch (err) {
              alert(t('router.updateFailed', { message: err.message }));
              applyBtn.disabled = false;
              applyBtn.textContent = 'Update';
            }
          });

          load();
        }

        wireUpdateBlock({
          statusPath: '/cli/status', checkPath: '/cli/check', applyPath: '/cli/apply',
          pillSelector: '[data-role="cli-pill"]', checkSelector: '[data-action="cli-check"]', applySelector: '[data-action="cli-apply"]',
          applyConfirm: t('nodes.confirmCliUpdate'),
          versionLabel: status => status.currentHash ? t('nodes.currentWithValue', { value: status.currentHash.slice(0, 8) }) : t('nodes.unknown'),
        });

        wireUpdateBlock({
          statusPath: '/self-update/status', checkPath: '/self-update/check', applyPath: '/self-update/apply',
          pillSelector: '[data-role="agent-pill"]', checkSelector: '[data-action="agent-check"]', applySelector: '[data-action="agent-apply"]',
          applyConfirm: t('nodes.confirmAgentUpdate'),
          versionLabel: status => status.currentVersion ? t('nodes.currentWithValue', { value: status.currentVersion }) : t('nodes.current'),
        });
      });

      // Live-Status direkt nach dem Laden abfragen statt auf den nächsten manuellen Ping zu warten.
      nodes.forEach(n => {
        ctx.fetchJSON(`/api/nodes/${encodeURIComponent(n.id)}/ping`, { method: 'POST' })
          .then(result => {
            const dot = list.querySelector(`.node-card[data-id="${n.id}"] [data-role="dot"]`);
            if (dot) dot.className = 'status-dot ' + (result.online ? 'online' : 'offline');
          })
          .catch(() => {});
      });
    }

    wrap.querySelector('#node-add-btn').addEventListener('click', async () => {
      const name = wrap.querySelector('#node-name').value.trim();
      const host = wrap.querySelector('#node-host').value.trim();
      const port = wrap.querySelector('#node-port').value.trim();
      const code = wrap.querySelector('#node-code').value.trim();
      const status = wrap.querySelector('#node-add-status');
      if (!host || !port || !code) {
        status.textContent = t('nodes.pairValidation');
        return;
      }
      status.textContent = t('console.connecting');
      try {
        await ctx.fetchJSON('/api/nodes/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name || undefined, host, port, code }),
        });
        wrap.querySelector('#node-name').value = '';
        wrap.querySelector('#node-host').value = '';
        wrap.querySelector('#node-code').value = '';
        status.textContent = t('nodes.pairSuccess');
        await loadNodes();
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    });

    loadNodes();
    const interval = setInterval(loadNodes, 15000);
    return () => clearInterval(interval);
  }
};
