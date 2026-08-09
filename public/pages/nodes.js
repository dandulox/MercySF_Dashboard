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
      .nodes-page .node-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px 14px; margin-bottom: 10px; }
      .nodes-page .node-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
      .nodes-page .node-info { flex: 1; min-width: 200px; }
      .nodes-page .node-name-row { display: flex; align-items: center; gap: 8px; }
      .nodes-page .node-name { font-weight: 600; font-size: 14px; }
      .nodes-page .rename-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 0; }
      .nodes-page .rename-btn:hover { color: var(--text); }
      .nodes-page .node-meta { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
      .nodes-page .node-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .nodes-page .node-actions button { width: auto; padding: 6px 12px; font-size: 12px; }
      .nodes-page .node-updates { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
      .nodes-page .update-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
      .nodes-page .update-row .update-label { color: var(--muted); }
      .nodes-page .update-row button { width: auto; padding: 3px 10px; font-size: 11px; }
      .nodes-page .icon-btn-tiny { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px; padding: 2px; }
      .nodes-page .icon-btn-tiny:hover { color: var(--text); }
      .nodes-page .btn-danger { background: transparent; border: 1px solid var(--red); color: var(--red); border-radius: 8px; cursor: pointer; }
      .nodes-page .btn-secondary { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; cursor: pointer; }
      .nodes-page .status-wrap { display: flex; align-items: center; gap: 6px; }
      .nodes-page .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
      .nodes-page .status-dot.online { background: var(--green); box-shadow: 0 0 6px var(--green); }
      .nodes-page .status-dot.offline { background: var(--red); }
      .nodes-page .empty-hint { color: var(--muted); font-size: 13px; padding: 20px 0; text-align: center; }
      @media (max-width: 480px) {
        .nodes-page .field input { min-width: 0; width: 100%; }
        .nodes-page .add-form { flex-direction: column; align-items: stretch; }
        .nodes-page .add-btn { width: 100%; }
      }
    `;
    ctx.injectStyleOnce('nodes', css);

    const wrap = document.createElement('div');
    wrap.className = 'nodes-page';
    wrap.innerHTML = `
      <h1 class="page-title">Nodes</h1>
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
      list.innerHTML = nodes.map(n => `
        <div class="node-card" data-id="${n.id}">
          <div class="node-head">
            <div class="status-wrap">
              <span class="status-dot ${n.lastStatus === 'online' ? 'online' : 'offline'}" data-role="dot"></span>
            </div>
            <div class="node-info">
              <div class="node-name-row">
                <span class="node-name char-name" data-role="name">${escapeHtml(n.name)}</span>
                <button class="rename-btn" data-action="rename" title="${t('nodes.renameTitle')}">✏️</button>
              </div>
              <div class="node-meta" data-role="meta">${t('nodes.metaLine', { host: escapeHtml(n.host), port: n.port, count: n.accountCount, accountWord: n.accountCount === 1 ? 'Account' : 'Accounts', lastSeen: fmtRelTime(n.lastSeen) })}</div>
            </div>
            <div class="node-actions">
              <button class="btn-secondary" data-action="ping">Ping</button>
              <button class="btn-danger" data-action="remove">${t('nodes.removeBtn')}</button>
            </div>
          </div>
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
        </div>
      `).join('');

      list.querySelectorAll('.node-card').forEach(card => {
        const id = card.dataset.id;
        const node = nodes.find(n => n.id === id);

        card.querySelector('[data-action="rename"]').addEventListener('click', async () => {
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
          try {
            const result = await ctx.fetchJSON(`/api/nodes/${encodeURIComponent(id)}/ping`, { method: 'POST' });
            dot.className = 'status-dot ' + (result.online ? 'online' : 'offline');
          } catch (err) {
            dot.className = 'status-dot offline';
          }
        });

        card.querySelector('[data-action="remove"]').addEventListener('click', async () => {
          if (!confirm(t('nodes.confirmRemove', { name: node.name }))) return;
          await ctx.fetchJSON(`/api/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' });
          await loadNodes();
        });

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
