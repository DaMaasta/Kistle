const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../db');
const authenticateToken = require('../middleware');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(uid, email) {
  return jwt.sign({ uid, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben`;
  }
  if (password.length > 200) return 'Passwort ist zu lang';
  return null;
}

// Google Login — erwartet einen echten ID Token (JWT), nicht Access Token
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken fehlt' });

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: uid, email, name, picture } = payload;

    await pool.query(
      'INSERT INTO users (uid, email, display_name, photo_url) VALUES ($1, $2, $3, $4) ON CONFLICT (uid) DO UPDATE SET email=$2, display_name=$3, photo_url=$4',
      [uid, email, name, picture || '']
    );

    res.json({ token: signToken(uid, email), uid, email, displayName: name, photoURL: picture || '' });
  } catch (err) {
    console.error('Google Login Fehler:', err.message);
    res.status(401).json({ error: 'Ungültiger Google Token' });
  }
});

// Registrierung
router.post('/register', async (req, res) => {
  try {
    const { password } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
    if (!email || !password || !displayName) return res.status(400).json({ error: 'Fehlende Felder' });
    if (!EMAIL_PATTERN.test(email) || email.length > 254) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
    if (displayName.length > 100) return res.status(400).json({ error: 'Name ist zu lang' });
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ error: problem });

    const hash = await bcrypt.hash(password, 10);
    const uid = crypto.randomUUID();

    await pool.query(
      'INSERT INTO users (uid, email, password_hash, display_name, photo_url) VALUES ($1, $2, $3, $4, $5)',
      [uid, email, hash, displayName, '']
    );

    res.json({ token: signToken(uid, email), uid, email, displayName });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'E-Mail bereits registriert' });
    console.error(err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Fehlende Felder' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    const user = result.rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

    res.json({ token: signToken(user.uid, user.email), uid: user.uid, email: user.email, displayName: user.display_name, photoURL: user.photo_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// Auth-Check
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT uid, email, display_name, photo_url FROM users WHERE uid = $1',
      [req.user.uid]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User nicht gefunden' });
    const user = result.rows[0];
    res.json({ userId: user.uid, email: user.email, displayName: user.display_name, photoURL: user.photo_url ?? '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Passwort ändern – meldet alle anderen Geräte ab; dieses Gerät bekommt ein neues Token.
// Falsches aktuelles Passwort ist 403 (nicht 401), sonst würde die App ausloggen.
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await pool.query('SELECT email, password_hash FROM users WHERE uid = $1', [req.user.uid]);
    const user = result.rows[0];
    if (!user || !user.password_hash) return res.status(400).json({ error: 'Kein Passwort gesetzt' });

    const valid = typeof currentPassword === 'string' && await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(403).json({ error: 'Aktuelles Passwort ist falsch' });
    const problem = passwordProblem(newPassword);
    if (problem) return res.status(400).json({ error: problem });

    const hash = await bcrypt.hash(newPassword, 10);
    // Auf volle Sekunden abrunden: JWT-iat hat Sekunden-Auflösung, das neue Token muss gültig sein
    await pool.query(
      "UPDATE users SET password_hash = $1, password_changed_at = date_trunc('second', NOW()) WHERE uid = $2",
      [hash, req.user.uid]
    );
    res.json({ ok: true, token: signToken(req.user.uid, user.email) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Passwort ändern' });
  }
});

// Konto löschen
// - Gruppen mit weiteren Mitgliedern gehen an das nächste Mitglied über (Admin vor
//   Editor vor Viewer) und bleiben samt Inhalt erhalten; Gruppen ohne weitere
//   Mitglieder werden mit ihren Boxen und Produkten gelöscht.
// - Buchungsverlauf und Produkte bleiben erhalten, der Verweis auf den Nutzer wird geleert.
// - Eigene Dokumente und Ordner werden samt Dateien gelöscht.
router.delete('/account', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { password } = req.body || {};
    const userRes = await client.query('SELECT password_hash FROM users WHERE uid = $1', [req.user.uid]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'Konto nicht gefunden' });
    // Konten mit Passwort brauchen es zur Bestätigung (Google-Konten haben keins)
    if (user.password_hash) {
      const valid = typeof password === 'string' && await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(403).json({ error: 'Passwort ist falsch' });
    }

    await client.query('BEGIN');
    const groups = await client.query('SELECT id FROM spaces WHERE owner_id=$1 AND is_group', [req.user.uid]);
    for (const { id: groupId } of groups.rows) {
      const successor = await client.query(
        `SELECT user_id FROM space_members
         WHERE space_id=$1 AND user_id<>$2
         ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, user_id
         LIMIT 1`,
        [groupId, req.user.uid]
      );
      if (successor.rows.length) {
        const newOwner = successor.rows[0].user_id;
        await client.query('UPDATE spaces SET owner_id=$1 WHERE id=$2 OR parent_id=$2', [newOwner, groupId]);
        await client.query("UPDATE space_members SET role='admin' WHERE space_id=$1 AND user_id=$2", [groupId, newOwner]);
      } else {
        await client.query('DELETE FROM spaces WHERE id=$1', [groupId]);
      }
    }
    const docs = await client.query('DELETE FROM documents WHERE owner_id=$1 RETURNING file_path', [req.user.uid]);
    await client.query('DELETE FROM folders WHERE owner_id=$1', [req.user.uid]);
    await client.query('DELETE FROM push_subscriptions WHERE user_id=$1', [req.user.uid]);
    await client.query('DELETE FROM users WHERE uid = $1', [req.user.uid]);
    await client.query('COMMIT');

    for (const row of docs.rows) {
      const filename = path.basename(row.file_path || '');
      if (filename) fs.unlink(path.join(process.env.DATA_PATH, 'documents', filename), () => {});
    }
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Konto konnte nicht gelöscht werden' });
  } finally {
    client.release();
  }
});

module.exports = router;
