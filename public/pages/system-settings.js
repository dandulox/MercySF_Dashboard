import { t } from '/lib/i18n.js';
import nodesPage from './nodes.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const GATE_KEYS = ['off', 'block', 'auto-connect'];
function gateLabels() {
  return {
    off: t('systemSettings.vpnGateOff'),
    block: t('systemSettings.vpnGateBlock'),
    'auto-connect': t('systemSettings.vpnGateAutoConnect'),
  };
}

const TABS = ['general', 'node', 'vpn'];

export default {
  id: 'system-settings',
  label: 'System-Einstellungen',
  icon: '🖥',
  mount(container, ctx) {
    const css = `
      .system-settings-page .settings-tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid var(--border); }
      .system-settings-page .settings-tab {
        background: none; border: none; padding: 8px 12px; margin-bottom: -1px; border-bottom: 2px solid transparent;
        color: var(--muted); cursor: pointer; font-size: 13px; font-weight: 600;
      }
      .system-settings-page .settings-tab.active { color: var(--text); border-bottom-color: var(--accent); }
      .system-settings-page .settings-tab-panel[hidden] { display: none; }
      .system-settings-page .settings-tab-panel[data-panel="node"] .page-title { display: none; }
      .system-settings-page .panel-settings-card, .system-settings-page .vpn-profiles-card {
        background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px 14px; margin-bottom: 14px;
      }
      .system-settings-page .panel-settings-card h3, .system-settings-page .vpn-profiles-card h3, .system-settings-page .vpn-targets-title { margin: 0 0 4px; font-size: 13px; }
      .system-settings-page .panel-settings-desc, .system-settings-page .vpn-profiles-desc { font-size: 11.5px; color: var(--muted); margin-bottom: 10px; line-height: 1.4; }
      .system-settings-page .vpn-profiles-desc a { color: var(--accent); }
      .system-settings-page .panel-settings-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .system-settings-page select, .system-settings-page input[type="text"] {
        background: var(--input-bg); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 6px 10px; font-size: 13px;
      }
      .system-settings-page #panel-settings-status, .system-settings-page #vpn-profile-add-status { font-size: 11.5px; color: var(--muted); }
      .system-settings-page .vpn-profile-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
      .system-settings-page .vpn-profile-row:last-child { border-bottom: none; }
      .system-settings-page .vpn-profile-row .interface-name { color: var(--muted); font-size: 11px; }
      .system-settings-page .vpn-profile-row button { margin-left: auto; width: auto; padding: 4px 10px; font-size: 11px; }
      .system-settings-page .vpn-profile-add-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
      .system-settings-page .vpn-targets-title { margin-bottom: 10px; }
      .system-settings-page #vpn-targets-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
      .system-settings-page .vpn-target-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
      .system-settings-page .vpn-target-name { font-weight: 600; font-size: 14px; }
      .system-settings-page .vpn-target-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .system-settings-page .vpn-target-status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
      .system-settings-page .status-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
      .system-settings-page .status-dot.connected { background: var(--green); box-shadow: 0 0 6px var(--green); }
      .system-settings-page .vpn-target-actions { display: flex; gap: 6px; flex-wrap: wrap; }
      .system-settings-page .vpn-target-actions button { width: auto; padding: 5px 10px; font-size: 11px; }
      .system-settings-page .vpn-warning { font-size: 11px; color: var(--yellow); }
      @media (max-width: 480px) {
        .system-settings-page #vpn-targets-list { grid-template-columns: 1fr; }
      }
    `;
    ctx.injectStyleOnce('system-settings', css);

    const wrap = document.createElement('div');
    wrap.className = 'system-settings-page';
    wrap.innerHTML = `
      <h1 class="page-title">${t('systemSettings.title')}</h1>
      <div class="settings-tabs">
        <button class="settings-tab active" data-tab="general">${t('systemSettings.tabGeneral')}</button>
        <button class="settings-tab" data-tab="node">${t('systemSettings.tabNode')}</button>
        <button class="settings-tab" data-tab="vpn">${t('systemSettings.tabVpn')}</button>
      </div>
      <div class="settings-tab-panel" data-panel="general">
        <div class="panel-settings-card">
          <h3>${t('systemSettings.panelSettingsTitle')}</h3>
          <div class="panel-settings-desc">${t('systemSettings.panelSettingsDesc')}</div>
          <div class="panel-settings-row">
            <select id="gamestate-interval-select"><option>${t('common.loading')}</option></select>
            <button class="btn btn-primary" id="gamestate-interval-save" style="width:auto;padding:7px 16px;">${t('systemSettings.applyBtn')}</button>
            <span id="panel-settings-status"></span>
          </div>
        </div>
      </div>
      <div class="settings-tab-panel" data-panel="node" hidden></div>
      <div class="settings-tab-panel" data-panel="vpn" hidden>
        <div class="vpn-profiles-card">
          <h3>${t('systemSettings.vpnProfilesTitle')}</h3>
          <div class="vpn-profiles-desc">${t('systemSettings.vpnProfilesDesc')}</div>
          <div id="vpn-profiles-list">${t('common.loading')}</div>
          <div class="vpn-profile-add-row">
            <input type="text" id="vpn-profile-label" placeholder="${t('systemSettings.vpnProfileLabelPlaceholder')}" />
            <input type="file" id="vpn-profile-file" accept=".conf,text/plain" />
            <button class="btn btn-primary" id="vpn-profile-add-btn" style="width:auto;padding:7px 16px;">${t('systemSettings.vpnProfileAddBtn')}</button>
          </div>
          <div id="vpn-profile-add-status"></div>
        </div>
        <h3 class="vpn-targets-title">${t('systemSettings.vpnTargetsTitle')}</h3>
        <div id="vpn-targets-list">${t('common.loading')}</div>
      </div>
    `;
    container.appendChild(wrap);

    // --- Tabs ---
    const tabButtons = wrap.querySelectorAll('.settings-tab');
    const panels = wrap.querySelectorAll('.settings-tab-panel');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.toggle('active', b === btn));
        panels.forEach(p => { p.hidden = p.dataset.panel !== btn.dataset.tab; });
      });
    });

    // --- Node-Tab: bestehende nodes.js-Seite wiederverwendet, unverändert — mount() ist bereits
    // so gebaut, dass es in einen beliebigen Container gerendert werden kann (kein Sonderfall
    // nötig für "innerhalb eines Tabs statt als eigene Route").
    const nodeUnmount = nodesPage.mount(wrap.querySelector('[data-panel="node"]'), ctx);

    // --- Panel-Einstellungen ---
    async function loadPanelSettings() {
      const select = wrap.querySelector('#gamestate-interval-select');
      const status = wrap.querySelector('#panel-settings-status');
      try {
        const data = await ctx.fetchJSON('/api/panel-settings');
        select.innerHTML = data.presets.map(p =>
          `<option value="${p.key}" ${p.key === data.current ? 'selected' : ''}>${p.label}</option>`).join('');
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    }

    wrap.querySelector('#gamestate-interval-save').addEventListener('click', async () => {
      const select = wrap.querySelector('#gamestate-interval-select');
      const status = wrap.querySelector('#panel-settings-status');
      status.textContent = t('systemSettings.saving');
      try {
        await ctx.fetchJSON('/api/panel-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset: select.value }),
        });
        status.textContent = t('systemSettings.applied');
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    });

    // --- VPN-Profile ---
    let vpnProfiles = [];

    async function loadVpnProfiles() {
      const list = wrap.querySelector('#vpn-profiles-list');
      try {
        vpnProfiles = await ctx.fetchJSON('/api/vpn/profiles');
      } catch (err) {
        list.textContent = t('analytics.loadError', { message: err.message });
        return;
      }
      list.innerHTML = vpnProfiles.length
        ? vpnProfiles.map(p => `
          <div class="vpn-profile-row" data-id="${p.id}">
            <span>${escapeHtml(p.label)}</span>
            <span class="interface-name">${escapeHtml(p.interfaceName)}${p.endpointHost ? ' · ' + escapeHtml(p.endpointHost) : ''}</span>
            <button class="btn-danger" data-action="delete-profile">${t('systemSettings.vpnProfileDeleteBtn')}</button>
          </div>`).join('')
        : `<span>${t('systemSettings.vpnProfilesEmpty')}</span>`;

      list.querySelectorAll('[data-action="delete-profile"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.closest('.vpn-profile-row').dataset.id;
          if (!confirm(t('systemSettings.vpnProfileDeleteConfirm'))) return;
          try {
            await ctx.fetchJSON(`/api/vpn/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
            await loadVpnProfiles();
            await loadVpnTargets();
          } catch (err) {
            alert(err.message);
          }
        });
      });
    }

    wrap.querySelector('#vpn-profile-add-btn').addEventListener('click', async () => {
      const labelInput = wrap.querySelector('#vpn-profile-label');
      const fileInput = wrap.querySelector('#vpn-profile-file');
      const status = wrap.querySelector('#vpn-profile-add-status');
      const file = fileInput.files[0];
      if (!labelInput.value.trim()) {
        status.textContent = t('systemSettings.vpnLabelMissingHint');
        return;
      }
      if (!file) {
        status.textContent = t('systemSettings.vpnFileMissingHint');
        return;
      }
      status.textContent = t('systemSettings.vpnProfileAdding');
      try {
        const configContent = await file.text();
        await ctx.fetchJSON('/api/vpn/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: labelInput.value.trim(), configContent }),
        });
        status.textContent = t('systemSettings.vpnProfileAdded');
        labelInput.value = '';
        fileInput.value = '';
        await loadVpnProfiles();
        await loadVpnTargets();
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    });

    // --- VPN-Ziele ---
    function profileOptionsHtml(selected) {
      return `<option value="">${t('systemSettings.vpnProfileSelectNone')}</option>` +
        vpnProfiles.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('');
    }

    function gateOptionsHtml(selected) {
      const labels = gateLabels();
      return GATE_KEYS.map(g => `<option value="${g}" ${g === selected ? 'selected' : ''}>${labels[g]}</option>`).join('');
    }

    function statusText(target) {
      if (!target.lastStatus || !target.lastStatus.updatedAt) return t('systemSettings.vpnStatusNever');
      if (!target.lastStatus.connected) return t('systemSettings.vpnStatusDisconnected');
      const profile = vpnProfiles.find(p => p.id === target.vpnProfileId);
      return t('systemSettings.vpnStatusConnected', {
        interface: target.lastStatus.interfaceName || '',
        ip: profile?.endpointHost || '?',
      });
    }

    async function loadVpnTargets() {
      const list = wrap.querySelector('#vpn-targets-list');
      let targets;
      try {
        targets = await ctx.fetchJSON('/api/vpn/targets');
      } catch (err) {
        list.textContent = t('analytics.loadError', { message: err.message });
        return;
      }
      const duplicateProfileIds = new Set(
        Object.entries(targets.filter(t2 => t2.vpnProfileId).reduce((acc, t2) => {
          acc[t2.vpnProfileId] = (acc[t2.vpnProfileId] || 0) + 1;
          return acc;
        }, {})).filter(([, count]) => count > 1).map(([id]) => id),
      );

      list.innerHTML = targets.map(target => `
        <div class="vpn-target-card" data-id="${target.targetId}">
          <div class="vpn-target-name">${escapeHtml(target.label)}</div>
          ${duplicateProfileIds.has(target.vpnProfileId) ? `<div class="vpn-warning">${t('systemSettings.vpnDuplicateWarning')}</div>` : ''}
          <div class="vpn-target-row">
            <select data-role="profile">${profileOptionsHtml(target.vpnProfileId)}</select>
            <select data-role="gate">${gateOptionsHtml(target.gate)}</select>
            <button class="btn-secondary" data-role="save">${t('systemSettings.vpnSaveBtn')}</button>
          </div>
          <div class="vpn-target-status">
            <span class="status-dot ${target.lastStatus?.connected ? 'connected' : ''}"></span>
            <span data-role="status-text">${statusText(target)}</span>
          </div>
          <div class="vpn-target-actions">
            <button class="btn btn-primary" data-role="connect">${t('systemSettings.vpnConnectBtn')}</button>
            <button class="btn-secondary" data-role="disconnect">${t('systemSettings.vpnDisconnectBtn')}</button>
            <button class="btn-secondary" data-role="refresh">${t('systemSettings.vpnRefreshBtn')}</button>
          </div>
        </div>
      `).join('');

      list.querySelectorAll('.vpn-target-card').forEach(card => {
        const id = card.dataset.id;

        // Speichert die aktuelle Dropdown-Auswahl (Profil + Gate) für dieses Ziel.
        async function saveTargetConfig() {
          const vpnProfileId = card.querySelector('[data-role="profile"]').value || null;
          const gate = card.querySelector('[data-role="gate"]').value;
          await ctx.fetchJSON(`/api/vpn/targets/${encodeURIComponent(id)}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vpnProfileId, gate }),
          });
        }

        card.querySelector('[data-role="save"]').addEventListener('click', async () => {
          try {
            await saveTargetConfig();
            await loadVpnTargets();
          } catch (err) {
            alert(err.message);
          }
        });

        // "Verbinden" speichert die aktuelle Dropdown-Auswahl automatisch mit, statt einen
        // separaten "erst Speichern, dann Verbinden"-Schritt vom Nutzer zu verlangen — ein
        // gewähltes, aber nicht explizit gespeichertes Profil führte sonst zu "Kein VPN-Profil
        // für dieses Ziel zugewiesen", obwohl im Dropdown längst eins ausgewählt war.
        card.querySelector('[data-role="connect"]').addEventListener('click', async () => {
          const statusEl = card.querySelector('[data-role="status-text"]');
          statusEl.textContent = t('common.loading');
          try {
            await saveTargetConfig();
            await ctx.fetchJSON(`/api/vpn/targets/${encodeURIComponent(id)}/connect`, { method: 'POST' });
            await loadVpnTargets();
          } catch (err) {
            statusEl.textContent = t('analytics.loadError', { message: err.message });
          }
        });

        function wireAction(role, path, method) {
          card.querySelector(`[data-role="${role}"]`).addEventListener('click', async () => {
            const statusEl = card.querySelector('[data-role="status-text"]');
            statusEl.textContent = t('common.loading');
            try {
              await ctx.fetchJSON(`/api/vpn/targets/${encodeURIComponent(id)}${path}`, { method });
              await loadVpnTargets();
            } catch (err) {
              statusEl.textContent = t('analytics.loadError', { message: err.message });
            }
          });
        }
        wireAction('disconnect', '/disconnect', 'POST');
        wireAction('refresh', '/status', 'GET');
      });
    }

    loadPanelSettings();
    loadVpnProfiles().then(loadVpnTargets);

    return () => {
      if (typeof nodeUnmount === 'function') nodeUnmount();
    };
  },
};
