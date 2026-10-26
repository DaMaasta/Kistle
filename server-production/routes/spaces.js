const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware');
const { broadcast } = require('../ws');
const {
  GROUP_JOIN,
  GROUP_ROLE,
  HAS_GROUP_ACCESS,
  READ_ROLES,
  WRITE_ROLES,
  ADMIN_ROLES,
  getSpaceAccess,
  hasRole,
  forbidden,
} = require('../authorization');
const { sendDbError } = require('../dbErrors');

function newInviteToken() {
  return crypto.randomBytes(24).toString('base64url');
}

// Vergleich in konstanter Zeit, damit sich der Token nicht zeichenweise erraten lässt
function tokensMatch(expected, given) {
  if (typeof expected !== 'string' || typeof given !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const MANAGEABLE_ROLES = new Set(['admin', 'editor', 'viewer']);

function normalizeRole(r) {
  if (r === 'owner') return 'admin';
  return r || 'viewer';
}

function mapSpace(row) {
  const membersList = row.members_list || [];
  const members = {};
  const memberIds = [];
  for (const m of membersList) {
    if (!m || !m.userId) continue;
    members[m.userId] = {
      userId: m.userId,
      displayName: m.displayName || m.email || '',
      email: m.email || '',
      role: normalizeRole(m.role),
    };
    memberIds.push(m.userId);
  }
  const role = normalizeRole(row.role);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    parentId: row.parent_id,
    ownerId: row.owner_id,
    icon: row.icon,
    color: row.color,
    isGroup: row.is_group,
    accessCode: row.access_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    folderId: row.folder_id ?? null,
    boxNumber: row.box_number ?? null,
    role,
    // Einladungstoken nur für Mitglieder, die auch einladen dürfen
    inviteToken: row.is_group && WRITE_ROLES.has(row.role) ? row.invite_token : undefined,
    memberIds,
    members,
  };
}

// GET /spaces oder GET /spaces?parentId=xyz oder GET /spaces?parentIds=a,b,c
router.get('/', auth, async (req, res) => {
  const { parentId, parentIds } = req.query;
  try {
    let rows;
    if (parentIds) {
      const ids = parentIds.split(',').filter(Boolean);
      const result = await pool.query(
        `SELECT s.*, ${GROUP_ROLE} AS role FROM spaces s
         ${GROUP_JOIN}
         WHERE s.parent_id = ANY($2) AND ${HAS_GROUP_ACCESS}
         ORDER BY COALESCE(s.box_number, 99999) ASC, s.created_at ASC`,
        [req.user.uid, ids]
      );
      rows = result.rows;
    } else if (parentId !== undefined) {
      const result = await pool.query(
        `SELECT s.*, ${GROUP_ROLE} AS role FROM spaces s
         ${GROUP_JOIN}
         WHERE s.parent_id=$2 AND ${HAS_GROUP_ACCESS}
         ORDER BY COALESCE(s.box_number, 99999) ASC, s.created_at ASC`,
        [req.user.uid, parentId || null]
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        `SELECT s.*, sm.role,
          COALESCE(json_agg(json_build_object(
            'userId', sm2.user_id,
            'displayName', u.display_name,
            'email', u.email,
            'role', sm2.role
          )) FILTER (WHERE sm2.user_id IS NOT NULL), '[]') AS members_list
         FROM spaces s
         JOIN space_members sm ON s.id = sm.space_id AND sm.user_id=$1
         LEFT JOIN space_members sm2 ON s.id = sm2.space_id
         LEFT JOIN users u ON sm2.user_id = u.uid
         WHERE sm.user_id=$1
         GROUP BY s.id, sm.role
         ORDER BY s.created_at DESC`,
        [req.user.uid]
      );
      rows = result.rows;
    }
    res.json(rows.map(mapSpace));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// GET /spaces/:id
router.get('/:id', auth, async (req, res) => {
  try {
    // Mitgliederliste ist immer die der Gruppe (auch beim Abruf einer Box)
    const { rows } = await pool.query(
      `SELECT s.*,
        ${GROUP_ROLE} AS role,
        COALESCE(json_agg(json_build_object(
          'userId', sm2.user_id,
          'displayName', u.display_name,
          'email', u.email,
          'role', sm2.role
        )) FILTER (WHERE sm2.user_id IS NOT NULL), '[]') AS members_list
       FROM spaces s
       ${GROUP_JOIN}
       LEFT JOIN space_members sm2 ON sm2.space_id = g.id
       LEFT JOIN users u ON sm2.user_id = u.uid
       WHERE s.id=$2 AND ${HAS_GROUP_ACCESS}
       GROUP BY s.id, g.owner_id, gm.role, gm.user_id`,
      [req.user.uid, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json(mapSpace(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler' });
  }
});

// GET /spaces/:id/content-count
router.get('/:id/content-count', auth, async (req, res) => {
  try {
    const access = await getSpaceAccess(req.user.uid, req.params.id);
    if (!hasRole(access, READ_ROLES)) return forbidden(res);
    const [boxRes, prodRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM spaces WHERE parent_id=$1', [req.params.id]),
      pool.query('SELECT COUNT(*) FROM products WHERE space_id=$1', [req.params.id]),
    ]);
    res.json({
      boxes: parseInt(boxRes.rows[0].count),
      products: parseInt(prodRes.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler' });
  }
});

// POST /spaces
router.post('/', auth, async (req, res) => {
  const { id, name, description, color, icon, parentId, type, accessCode, isGroup } = req.body;
  let client;
  try {
    if (!name?.trim()) return res.status(400).json({ error: 'Name fehlt' });
    let ownerId = req.user.uid;
    if (parentId) {
      const parentAccess = await getSpaceAccess(req.user.uid, parentId);
      if (!hasRole(parentAccess, WRITE_ROLES)) return forbidden(res);
      if (!parentAccess.is_group) return res.status(400).json({ error: 'Boxen können nur in Gruppen angelegt werden' });
      // Boxen gehören dem Gruppenbesitzer; Rechte kommen ausschließlich aus der Gruppe
      ownerId = parentAccess.owner_id;
    }
    // Duplicate check for groups
    if (isGroup) {
      const dup = await pool.query(
        `SELECT s.id FROM spaces s
         JOIN space_members sm ON s.id = sm.space_id
         WHERE s.is_group = true AND s.name = $1 AND sm.user_id = $2 LIMIT 1`,
        [name, req.user.uid]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: 'Eine Gruppe mit diesem Namen existiert bereits' });
      }
    }
    const spaceId = id || (await pool.query('SELECT gen_random_uuid()::text AS id')).rows[0].id;
    client = await pool.connect();
    await client.query('BEGIN');
    let boxNumber = null;
    if (parentId) {
      // Gruppe sperren, damit gleichzeitig angelegte Boxen nicht dieselbe Nummer bekommen
      await client.query('SELECT id FROM spaces WHERE id=$1 FOR UPDATE', [parentId]);
      const maxRes = await client.query(
        'SELECT COALESCE(MAX(box_number), 0) AS max_num FROM spaces WHERE parent_id=$1',
        [parentId]
      );
      boxNumber = parseInt(maxRes.rows[0].max_num, 10) + 1;
    }
    const group = !parentId;
    await client.query(
      `INSERT INTO spaces (id, name, description, color, icon, owner_id, parent_id, type, access_code, is_group, box_number, invite_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [spaceId, name, description || '', color || '#f97316', icon || '📦',
       ownerId, parentId || null, type || 'box', accessCode || null, group, boxNumber,
       group ? newInviteToken() : null]
    );
    if (group) {
      await client.query(
        `INSERT INTO space_members (space_id, user_id, role) VALUES ($1,$2,'admin')`,
        [spaceId, req.user.uid]
      );
    }
    await client.query('COMMIT');
    res.json({ id: spaceId });
    broadcast('spaces', { spaceId, parentId: parentId || null });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    sendDbError(res, err, 'Fehler beim Erstellen');
  } finally {
    client?.release();
  }
});

// POST /spaces/:id/join  { token }
// Beitritt nur mit dem aktuellen Einladungstoken der Gruppe (steht im Einladungslink).
router.post('/:id/join', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, is_group, invite_token FROM spaces WHERE id=$1', [req.params.id]);
    const space = rows[0];
    if (!space || !space.is_group || !tokensMatch(space.invite_token, req.body?.token)) {
      // Keine Unterscheidung zwischen "gibt es nicht" und "falscher Token"
      return res.status(403).json({ error: 'Einladung ungültig oder abgelaufen. Bitte um einen neuen Link.' });
    }
    await pool.query(
      `INSERT INTO space_members (space_id, user_id, role)
       VALUES ($1,$2,'viewer')
       ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.uid]
    );
    res.json({ success: true });
    broadcast('spaces', { spaceId: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Beitreten' });
  }
});

// POST /spaces/:id/invite-token — neuen Einladungslink erzeugen, alte werden ungültig
router.post('/:id/invite-token', auth, async (req, res) => {
  try {
    const access = await getSpaceAccess(req.user.uid, req.params.id);
    if (!hasRole(access, ADMIN_ROLES)) return forbidden(res);
    if (!access.is_group) return res.status(400).json({ error: 'Nur Gruppen haben Einladungslinks' });
    const token = newInviteToken();
    await pool.query('UPDATE spaces SET invite_token=$1 WHERE id=$2', [token, req.params.id]);
    res.json({ inviteToken: token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler' });
  }
});

// PUT /spaces/:id
router.put('/:id', auth, async (req, res) => {
  const { name, description, color, icon, accessCode, folderId, boxNumber, type } = req.body;
  try {
    const access = await getSpaceAccess(req.user.uid, req.params.id);
    if (!hasRole(access, WRITE_ROLES)) return forbidden(res);
    if ((accessCode !== undefined || folderId !== undefined) && !hasRole(access, ADMIN_ROLES)) {
      return forbidden(res);
    }
    if (folderId) {
      const folder = await pool.query('SELECT owner_id FROM folders WHERE id=$1', [folderId]);
      if (!folder.rows.length || folder.rows[0].owner_id !== req.user.uid) return forbidden(res);
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'Name darf nicht leer sein' });
    }
    if (boxNumber !== undefined && boxNumber !== null && !/^\d{1,6}$/.test(String(boxNumber))) {
      return res.status(400).json({ error: 'Ungültige Boxnummer' });
    }
    const fields = [];
    const vals = [];
    let i = 1;
    if (name !== undefined)        { fields.push(`name=$${i++}`);        vals.push(name); }
    if (description !== undefined) { fields.push(`description=$${i++}`); vals.push(description); }
    if (color !== undefined)       { fields.push(`color=$${i++}`);       vals.push(color); }
    if (icon !== undefined)        { fields.push(`icon=$${i++}`);        vals.push(icon); }
    if (folderId !== undefined)     { fields.push(`folder_id=$${i++}`);    vals.push(folderId === null ? null : folderId); }
    if (accessCode !== undefined)  { fields.push(`access_code=$${i++}`); vals.push(accessCode); }
    if (boxNumber !== undefined)   { fields.push(`box_number=$${i++}`);   vals.push(boxNumber === null ? null : parseInt(boxNumber, 10)); }
    if (type !== undefined)        { fields.push(`type=$${i++}`);        vals.push(type); }
    if (fields.length === 0) return res.json({ success: true });
    fields.push(`updated_at=NOW()`);
    vals.push(req.params.id);
    await pool.query(`UPDATE spaces SET ${fields.join(', ')} WHERE id=$${i}`, vals);
    res.json({ success: true });
    broadcast('spaces', { spaceId: req.params.id });
  } catch (err) {
    sendDbError(res, err, 'Fehler beim Updaten');
  }
});

// DELETE /spaces/:id
// Gruppen: nur Admins; ihre Boxen und Produkte werden mitgelöscht (ON DELETE CASCADE).
// Boxen: Editoren und Admins der Gruppe – wie beim Löschen von Produkten.
router.delete('/:id', auth, async (req, res) => {
  try {
    const access = await getSpaceAccess(req.user.uid, req.params.id);
    if (!access) return res.status(404).json({ error: 'Nicht gefunden' });
    if (!hasRole(access, access.is_group ? ADMIN_ROLES : WRITE_ROLES)) return forbidden(res);
    await pool.query('DELETE FROM spaces WHERE id=$1', [req.params.id]);
    res.json({ success: true });
    broadcast('spaces', {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// POST /spaces/:id/members
router.post('/:id/members', auth, async (req, res) => {
  const { userId, email, role } = req.body;
  const access = await getSpaceAccess(req.user.uid, req.params.id);
  if (!hasRole(access, ADMIN_ROLES)) return forbidden(res);
  if (!access.is_group) return res.status(400).json({ error: 'Mitglieder gibt es nur in Gruppen' });
  const requestedRole = role || 'viewer';
  if (!MANAGEABLE_ROLES.has(requestedRole)) {
    return res.status(400).json({ error: 'Ungültige Rolle' });
  }
  const lookupEmail = (userId && userId.includes('@')) ? userId : (email || null);
  let resolvedUid = userId;
  if (lookupEmail) {
    const uRes = await pool.query('SELECT uid FROM users WHERE email=$1', [lookupEmail]);
    if (!uRes.rows.length) {
      return res.status(404).json({ error: 'Kein Konto mit dieser E-Mail gefunden. Die Person muss sich zuerst anmelden.' });
    }
    resolvedUid = uRes.rows[0].uid;
  }
  if (!resolvedUid) return res.status(400).json({ error: 'Nutzer fehlt' });
  try {
    await pool.query(
      `INSERT INTO space_members (space_id, user_id, role) VALUES ($1,$2,$3)
       ON CONFLICT (space_id, user_id) DO UPDATE SET role=$3`,
      [req.params.id, resolvedUid, requestedRole]
    );
    res.json({ success: true });
  } catch (err) {
    sendDbError(res, err, 'Fehler');
  }
});

// PUT /spaces/:id/members/:userId
router.put('/:id/members/:userId', auth, async (req, res) => {
  const { role } = req.body;
  try {
    const access = await getSpaceAccess(req.user.uid, req.params.id);
    if (!hasRole(access, ADMIN_ROLES)) return forbidden(res);
    if (!MANAGEABLE_ROLES.has(role)) return res.status(400).json({ error: 'Ungültige Rolle' });
    const result = await pool.query(
      `UPDATE space_members sm SET role=$1
       WHERE sm.space_id=$2 AND sm.user_id=$3
       AND sm.user_id != (SELECT owner_id FROM spaces WHERE id=$2)`,
      [role, req.params.id, req.params.userId]
    );
    if (result.rowCount === 0) return res.status(400).json({ error: 'Besitzerrolle kann nicht geändert werden' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler' });
  }
});

// DELETE /spaces/:id/members/:userId
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const access = await getSpaceAccess(req.user.uid, req.params.id);
    if (!hasRole(access, ADMIN_ROLES)) return forbidden(res);
    const result = await pool.query(
      `DELETE FROM space_members sm
       WHERE sm.space_id=$1 AND sm.user_id=$2 AND sm.user_id!=$3
       AND sm.user_id != (SELECT owner_id FROM spaces WHERE id=$1)`,
      [req.params.id, req.params.userId, req.user.uid]
    );
    if (result.rowCount === 0) return res.status(400).json({ error: 'Mitglied konnte nicht entfernt werden' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler' });
  }
});

// POST /spaces/:id/access-code
router.post('/:id/access-code', auth, async (req, res) => {
  const { length } = req.body;
  const codeLength = Number(length || 4);
  if (!Number.isInteger(codeLength) || codeLength < 1 || codeLength > 12) {
    return res.status(400).json({ error: 'Ungültige Codelänge' });
  }
  const code = Array.from({ length: codeLength }, () => String(crypto.randomInt(10))).join('');
  try {
    const result = await pool.query('UPDATE spaces SET access_code=$1 WHERE id=$2 AND owner_id=$3', [code, req.params.id, req.user.uid]);
    if (result.rowCount === 0) return forbidden(res);
    res.json({ success: true, code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler' });
  }
});

// DELETE /spaces/:id/access-code
router.delete('/:id/access-code', auth, async (req, res) => {
  try {
    const result = await pool.query('UPDATE spaces SET access_code=NULL WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.uid]);
    if (result.rowCount === 0) return forbidden(res);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler' });
  }
});

module.exports = router;
