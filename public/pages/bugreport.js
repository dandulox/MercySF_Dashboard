import { t } from '/lib/i18n.js';

export default {
  id: 'bugreport',
  label: 'Bug melden',
  icon: '🐞',
  mount(container, ctx) {
    const wrap = document.createElement('div');
    wrap.className = 'bugreport-page';
    wrap.innerHTML = `
      <h3 class="bugreport-title">${t('bugreport.title')}</h3>
      <p class="bugreport-hint">${t('bugreport.hint')}</p>
      <form id="bugreport-form" class="bugreport-form">
        <label>${t('bugreport.fieldTitle')}
          <input type="text" id="bugreport-title" maxlength="150" required />
        </label>
        <label>${t('bugreport.fieldDescription')}
          <textarea id="bugreport-description" rows="6" maxlength="5000" required></textarea>
        </label>
        <label>${t('bugreport.fieldSeverity')}
          <select id="bugreport-severity">
            <option value="low">${t('bugreport.severityLow')}</option>
            <option value="medium" selected>${t('bugreport.severityMedium')}</option>
            <option value="high">${t('bugreport.severityHigh')}</option>
          </select>
        </label>
        <button type="submit" class="btn btn-primary" id="bugreport-submit-btn">${t('bugreport.submitBtn')}</button>
        <div id="bugreport-status" class="bugreport-status"></div>
      </form>
    `;
    container.appendChild(wrap);

    ctx.injectStyleOnce('bugreport-page', `
      .bugreport-page .bugreport-title { margin: 0 0 4px; font-size: 13px; }
      .bugreport-page .bugreport-hint { font-size: 11.5px; color: var(--muted); margin: 0 0 10px; line-height: 1.4; }
      .bugreport-form { display: flex; flex-direction: column; gap: 14px; margin-top: 10px; }
      .bugreport-form label { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: var(--muted); }
      .bugreport-form input, .bugreport-form textarea, .bugreport-form select {
        background: var(--input-bg); border: 1px solid var(--border); color: var(--text);
        border-radius: 8px; padding: 8px 10px; font-size: 13px; font-family: inherit; resize: vertical;
      }
      .bugreport-status { font-size: 12.5px; min-height: 1.2em; }
      .bugreport-status.success { color: var(--green); }
      .bugreport-status.error { color: var(--red); }
    `);

    wrap.querySelector('#bugreport-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const title = wrap.querySelector('#bugreport-title').value.trim();
      const description = wrap.querySelector('#bugreport-description').value.trim();
      const severity = wrap.querySelector('#bugreport-severity').value;
      const status = wrap.querySelector('#bugreport-status');
      const submitBtn = wrap.querySelector('#bugreport-submit-btn');
      if (!title || !description) return;

      submitBtn.disabled = true;
      status.className = 'bugreport-status';
      status.textContent = t('bugreport.submitting');
      try {
        const result = await ctx.fetchJSON('/api/bugreport', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, severity }),
        });
        status.className = 'bugreport-status success';
        status.textContent = t('bugreport.submitSuccess', { id: result.id.slice(0, 8) });
        wrap.querySelector('#bugreport-form').reset();
        wrap.querySelector('#bugreport-severity').value = 'medium';
      } catch (err) {
        status.className = 'bugreport-status error';
        status.textContent = t('bugreport.submitError', { message: err.message });
      } finally {
        submitBtn.disabled = false;
      }
    });
  },
};
