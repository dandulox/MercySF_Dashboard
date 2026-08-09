import de from './i18n/de.js';
import en from './i18n/en.js';

const DICTS = { de, en };
const STORAGE_KEY = 'mercy-lang';

let activeLang = 'de';
const listeners = new Set();

function detectBrowserLang() {
  const raw = (navigator.language || 'de').slice(0, 2).toLowerCase();
  return raw === 'en' ? 'en' : 'de';
}

function interpolate(str, vars) {
  if (!vars) return str;
  return Object.keys(vars).reduce(
    (acc, key) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key])),
    str
  );
}

export function t(key, vars) {
  const dict = DICTS[activeLang] || DICTS.de;
  const raw = dict[key] ?? DICTS.de[key] ?? key;
  return interpolate(raw, vars);
}

export function getLanguage() {
  return activeLang;
}

export function onLanguageChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.getAttribute('data-i18n-attr').split(',').forEach(pair => {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
}

function applyLang(lang) {
  activeLang = DICTS[lang] ? lang : 'de';
  document.documentElement.setAttribute('lang', activeLang);
  applyTranslations(document);
  listeners.forEach(cb => cb(activeLang));
}

export async function initI18nAuthenticated(fetchJSON) {
  let lang = null;
  try {
    const data = await fetchJSON('/api/panel-settings');
    lang = data.language || null;
  } catch (e) { /* server not reachable yet — fall back below */ }

  if (!lang) {
    lang = localStorage.getItem(STORAGE_KEY) || detectBrowserLang();
    try {
      await fetchJSON('/api/panel-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });
    } catch (e) { /* non-fatal — language still applies locally this session */ }
  }
  applyLang(lang);
}

export async function setLanguageAuthenticated(lang, fetchJSON) {
  applyLang(lang);
  await fetchJSON('/api/panel-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: lang }),
  });
}

export function initI18nLocal() {
  const lang = localStorage.getItem(STORAGE_KEY) || detectBrowserLang();
  applyLang(lang);
}

export function setLanguageLocal(lang) {
  localStorage.setItem(STORAGE_KEY, lang);
  applyLang(lang);
}
