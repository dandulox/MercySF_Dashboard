const pairing = require('./pairing');

function readBearer(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

function requireToken(req, res, next) {
  if (!pairing.isPaired()) {
    return res.status(503).json({ error: 'Dieser Node ist noch mit keinem Dashboard gepairt.' });
  }
  const token = readBearer(req);
  if (!pairing.verifyToken(token)) {
    return res.status(401).json({ error: 'Ungültiger oder fehlender Node-Token.' });
  }
  next();
}

module.exports = { requireToken, readBearer };
