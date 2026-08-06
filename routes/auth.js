const express = require('express');
const authStore = require('../lib/authStore');
const sessionStore = require('../lib/sessionStore');
const credentialStore = require('../lib/credentialStore');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: sessionStore.SESSION_TTL_MS,
};

function setSessionCookie(res, token) {
  res.cookie(sessionStore.SESSION_COOKIE, token, COOKIE_OPTS);
}

router.get('/status', (req, res) => {
  res.json({ hasAccess: authStore.hasAccess() });
});

router.post('/setup', express.json(), (req, res) => {
  if (authStore.hasAccess()) return res.status(409).json({ error: 'Zugang existiert bereits' });
  const { username, password } = req.body || {};
  let result;
  try {
    result = authStore.createAccess(username, password);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const token = sessionStore.createSession();
  setSessionCookie(res, token);
  res.status(201).json({ aesKey: credentialStore.getRawKey(), recoveryPhrase: result.recoveryPhrase });
});

router.post('/login', express.json(), (req, res) => {
  const { username, password } = req.body || {};
  if (!authStore.verifyPassword(username, password)) {
    return res.status(401).json({ error: 'Zugangsdaten ungültig' });
  }
  const token = sessionStore.createSession();
  setSessionCookie(res, token);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  const token = sessionStore.readSessionCookie(req);
  if (token) sessionStore.destroySession(token);
  res.clearCookie(sessionStore.SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.post('/change-password', express.json(), (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  try {
    authStore.changePassword(currentPassword, newPassword);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/reset', express.json(), (req, res) => {
  const { recoveryPhrase, newPassword } = req.body || {};
  try {
    const result = authStore.resetWithRecoveryPhrase(recoveryPhrase, newPassword);
    res.json({ recoveryPhrase: result.recoveryPhrase });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
