import { t } from '/lib/i18n.js';

export default {
  id: 'marketplace',
  label: 'Marktplatz',
  icon: '🌐',
  mount(container, ctx) {
    const css = `
      .marketplace-page .marketplace-desc { font-size: 11.5px; color: var(--muted); margin-bottom: 10px; line-height: 1.4; }
      .marketplace-page .marketplace-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
      .marketplace-page .marketplace-filters input[type="text"], .marketplace-page .marketplace-filters select { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 6px 10px; font-size: 12.5px; width: auto; }
      .marketplace-page #marketplace-status { font-size: 11.5px; color: var(--muted); margin-bottom: 8px; }
      .marketplace-page .marketplace-empty { color: var(--muted); font-size: 12.5px; }
      .marketplace-page .marketplace-item { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; background: var(--panel); }
      .marketplace-page .marketplace-item:last-child { margin-bottom: 0; }
      .marketplace-page .marketplace-item-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
      .marketplace-page .marketplace-item-title { font-weight: 600; font-size: 13px; }
      .marketplace-page .marketplace-item-desc { font-size: 11.5px; color: var(--muted); margin: 4px 0; }
      .marketplace-page .marketplace-item-meta { font-size: 11px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
      .marketplace-page .marketplace-tag { display: inline-block; background: var(--panel-2); border-radius: 10px; padding: 1px 8px; font-size: 10.5px; margin-right: 4px; }
      .marketplace-page .marketplace-rating-stars { cursor: pointer; }
      .marketplace-page .marketplace-rating-stars .star { opacity: 0.35; }
      .marketplace-page .marketplace-rating-stars .star.filled { opacity: 1; }
      .marketplace-page .marketplace-item-stats { font-size: 11px; color: var(--green); margin-top: 4px; }
    `;
    ctx.injectStyleOnce('marketplace', css);

    const wrap = document.createElement('div');
    wrap.className = 'marketplace-page';
    wrap.innerHTML = `
      <h1 class="page-title">${t('settings.marketplaceTitle')}</h1>
      <div class="marketplace-desc">${t('settings.marketplaceDesc')}</div>
      <div class="marketplace-filters">
        <input type="text" id="marketplace-search" placeholder="${t('settings.marketplaceSearchPlaceholder')}" />
        <select id="marketplace-class-filter"><option value="">${t('settings.marketplaceClassAll')}</option></select>
        <input type="text" id="marketplace-tag-filter" placeholder="${t('settings.marketplaceTagPlaceholder')}" />
        <select id="marketplace-sort">
          <option value="new">${t('settings.marketplaceSortNew')}</option>
          <option value="rating">${t('settings.marketplaceSortRating')}</option>
          <option value="downloads">${t('settings.marketplaceSortDownloads')}</option>
        </select>
      </div>
      <div id="marketplace-status"></div>
      <div id="marketplace-list">${t('common.loading')}</div>
    `;
    container.appendChild(wrap);

    function escapeHtml(s) {
      return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    let marketplaceInstanceId = null;
    ctx.fetchJSON('/api/marketplace-identity').then(data => { marketplaceInstanceId = data.instanceId; });

    const MARKETPLACE_URL = 'https://data.poslab.cc/api/marketplace';
    let marketplaceClassesLoaded = false;

    function starsHtml(itemId, ratingAvg) {
      const rounded = ratingAvg != null ? Math.round(ratingAvg) : 0;
      let html = `<span class="marketplace-rating-stars" data-id="${itemId}">`;
      for (let i = 1; i <= 5; i++) {
        html += `<span class="star${i <= rounded ? ' filled' : ''}" data-stars="${i}">★</span>`;
      }
      html += '</span>';
      return html;
    }

    async function loadMarketplace() {
      const listEl = wrap.querySelector('#marketplace-list');
      const status = wrap.querySelector('#marketplace-status');
      const q = wrap.querySelector('#marketplace-search').value.trim();
      const characterClass = wrap.querySelector('#marketplace-class-filter').value;
      const tag = wrap.querySelector('#marketplace-tag-filter').value.trim();
      const sort = wrap.querySelector('#marketplace-sort').value;

      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (characterClass) params.set('characterClass', characterClass);
      if (tag) params.set('tag', tag);
      if (sort) params.set('sort', sort);

      let items;
      try {
        const res = await fetch(`${MARKETPLACE_URL}/templates?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        items = await res.json();
      } catch (err) {
        status.textContent = t('settings.marketplaceLoadError', { message: err.message });
        return;
      }
      status.textContent = '';

      if (!marketplaceClassesLoaded) {
        const classSelect = wrap.querySelector('#marketplace-class-filter');
        const classes = [...new Set(items.map(i => i.characterClass).filter(Boolean))].sort();
        classSelect.innerHTML = `<option value="">${t('settings.marketplaceClassAll')}</option>` +
          classes.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        marketplaceClassesLoaded = true;
      }

      listEl.innerHTML = items.length
        ? items.map(item => `
          <div class="marketplace-item" data-id="${item.id}">
            <div class="marketplace-item-head">
              <span class="marketplace-item-title">${escapeHtml(item.title)}</span>
              <button class="btn-secondary" data-action="import" style="width:auto;padding:5px 12px;font-size:11.5px;">${t('settings.marketplaceImportBtn')}</button>
            </div>
            ${item.description ? `<div class="marketplace-item-desc">${escapeHtml(item.description)}</div>` : ''}
            <div class="marketplace-item-meta">
              ${item.characterClass ? `<span>${escapeHtml(item.characterClass)}</span>` : ''}
              ${item.tags.map(tg => `<span class="marketplace-tag">${escapeHtml(tg)}</span>`).join('')}
              <span>${t('settings.marketplaceDownloadsLabel', { count: item.downloads })}</span>
              ${item.displayName ? `<span>${escapeHtml(item.displayName)}</span>` : ''}
            </div>
            <div class="marketplace-item-meta">
              <span>${t('settings.marketplaceRatingLabel')}</span>
              ${starsHtml(item.id, item.ratingAvg)}
              ${item.ratingCount ? `<span>(${item.ratingAvg} · ${item.ratingCount})</span>` : ''}
            </div>
            ${item.avgStats ? `
              <div class="marketplace-item-stats">
                ${item.avgStats.arenaWinRate != null
                  ? t('settings.marketplaceStatsBlock', { level: item.avgStats.level, silver: item.avgStats.silver, arenaWinRate: item.avgStats.arenaWinRate, count: item.linkedCount })
                  : t('settings.marketplaceStatsBlockNoArena', { level: item.avgStats.level, silver: item.avgStats.silver, count: item.linkedCount })}
              </div>
            ` : ''}
          </div>
        `).join('')
        : `<div class="marketplace-empty">${t('settings.marketplaceEmpty')}</div>`;

      listEl.querySelectorAll('.marketplace-item').forEach(itemEl => {
        const id = itemEl.dataset.id;
        itemEl.querySelector('[data-action="import"]').addEventListener('click', async () => {
          status.textContent = t('settings.marketplaceImporting');
          try {
            const res = await fetch(`${MARKETPLACE_URL}/templates/${encodeURIComponent(id)}/download`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            await ctx.fetchJSON('/api/settings-templates/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: data.title, settings: data.settings }),
            });
            status.textContent = t('settings.marketplaceImported', { name: data.title });
            await loadMarketplace();
          } catch (err) {
            status.textContent = t('settings.marketplaceLoadError', { message: err.message });
          }
        });

        itemEl.querySelectorAll('.marketplace-rating-stars .star').forEach(starEl => {
          starEl.addEventListener('click', async () => {
            const stars = Number(starEl.dataset.stars);
            try {
              const res = await fetch(`${MARKETPLACE_URL}/templates/${encodeURIComponent(id)}/rating`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceId: marketplaceInstanceId, stars }),
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              status.textContent = t('settings.marketplaceRatingSaved');
              await loadMarketplace();
            } catch (err) {
              status.textContent = t('settings.marketplaceLoadError', { message: err.message });
            }
          });
        });
      });
    }

    ['marketplace-search', 'marketplace-class-filter', 'marketplace-tag-filter', 'marketplace-sort'].forEach(id => {
      const el = wrap.querySelector(`#${id}`);
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => loadMarketplace());
    });

    loadMarketplace();

    return () => {};
  },
};
