import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { query, queryOne } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST /auth/register
router.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body as Record<string, string>;
  if (!email || !password || !displayName) {
    res.status(400).json({ error: 'email, password und displayName erforderlich' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
    return;
  }
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing) {
    res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits registriert' });
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  const [user] = await query<{ id: string }>(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1, $2, $3) RETURNING id`,
    [email.toLowerCase(), displayName, hash]
  );
  res.json({ token: signToken({ userId: user.id, email: email.toLowerCase(), displayName }) });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body as Record<string, string>;
  if (!email || !password) {
    res.status(400).json({ error: 'email und password erforderlich' });
    return;
  }
  const user = await queryOne<{ id: string; display_name: string; password_hash: string | null }>(
    'SELECT id, display_name, password_hash FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  if (!user || !user.password_hash) {
    res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
    return;
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
    return;
  }
  res.json({ token: signToken({ userId: user.id, email: email.toLowerCase(), displayName: user.display_name }) });
});

// POST /auth/google  — Google Access-Token verifizieren via userinfo endpoint
router.post('/google', async (req, res) => {
  const { idToken } = req.body as { idToken: string };
  if (!idToken) { res.status(400).json({ error: 'idToken erforderlich' }); return; }

  let email: string, displayName: string;
  try {
    // Access-Token: Google userinfo endpoint
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!infoRes.ok) throw new Error('userinfo failed');
    const info = await infoRes.json() as { email?: string; name?: string };
    if (!info.email) throw new Error('no email');
    email       = info.email.toLowerCase();
    displayName = info.name ?? email;
  } catch {
    res.status(401).json({ error: 'Google-Token ungültig' });
    return;
  }


  let user = await queryOne<{ id: string; display_name: string }>(
    'SELECT id, display_name FROM users WHERE email = $1', [email]
  );
  if (!user) {
    [user] = await query<{ id: string; display_name: string }>(
      'INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING id, display_name',
      [email, displayName]
    );
  }
  res.json({ token: signToken({ userId: user.id, email, displayName: user.display_name || displayName }) });
});

// GET /auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// POST /auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body as Record<string, string>;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword und newPassword erforderlich' });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
    return;
  }
  const user = await queryOne<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = $1', [req.user!.userId]
  );
  if (!user?.password_hash) {
    res.status(400).json({ error: 'Kein Passwort gesetzt (Google-Konto)' });
    return;
  }
  if (!await bcrypt.compare(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Aktuelles Passwort falsch' });
    return;
  }
  const hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user!.userId]);
  res.json({ ok: true });
});

// DELETE /auth/account
router.delete('/account', requireAuth, async (req, res) => {
  const { password } = req.body as { password?: string };
  const user = await queryOne<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = $1', [req.user!.userId]
  );
  if (user?.password_hash) {
    if (!password || !await bcrypt.compare(password, user.password_hash)) {
      res.status(401).json({ error: 'Passwort falsch' });
      return;
    }
  }
  await query('DELETE FROM users WHERE id = $1', [req.user!.userId]);
  res.json({ ok: true });
});

export default router;
