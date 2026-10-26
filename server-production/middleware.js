const jwt = require('jsonwebtoken');
const pool = require('./db');

// Prüft das JWT und ob das Konto noch existiert. Tokens, die vor dem letzten
// Passwortwechsel ausgestellt wurden, sind ungültig (andere Geräte werden abgemeldet).
module.exports = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Kein Token' });

  let payload;
  try {
    payload = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }

  try {
    const { rows } = await pool.query('SELECT password_changed_at FROM users WHERE uid=$1', [payload.uid]);
    if (!rows.length) return res.status(401).json({ error: 'Konto existiert nicht mehr' });
    const changedAt = rows[0].password_changed_at;
    if (changedAt && payload.iat < Math.floor(new Date(changedAt).getTime() / 1000)) {
      return res.status(401).json({ error: 'Sitzung abgelaufen' });
    }
  } catch (err) {
    return next(err);
  }

  req.user = payload;
  next();
};
