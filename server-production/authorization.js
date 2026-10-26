const pool = require('./db');

const READ_ROLES = new Set(['owner', 'admin', 'editor', 'viewer']);
const WRITE_ROLES = new Set(['owner', 'admin', 'editor']);
const ADMIN_ROLES = new Set(['owner', 'admin']);

// Rechte hängen immer an der Gruppe: eine Box erbt die Rolle aus ihrer Gruppe
// (Boxen sind nicht verschachtelt, parent_id einer Box ist immer die Gruppe).
// Diese Fragmente nutzen auch die Listen-Abfragen in den Routen. Erwartet einen
// Alias "s" für den Lagerort und $1 = uid.
const GROUP_JOIN = `
  JOIN spaces g ON g.id = CASE WHEN s.is_group THEN s.id ELSE s.parent_id END
  LEFT JOIN space_members gm ON gm.space_id = g.id AND gm.user_id = $1`;
const GROUP_ROLE = `CASE WHEN g.owner_id = $1 THEN 'owner' ELSE gm.role END`;
const HAS_GROUP_ACCESS = `(g.owner_id = $1 OR gm.user_id IS NOT NULL)`;

async function getSpaceAccess(uid, spaceId, client = pool) {
  const { rows } = await client.query(
    `SELECT s.id, s.owner_id, s.parent_id, s.is_group, g.id AS group_id,
       ${GROUP_ROLE} AS role
     FROM spaces s
     ${GROUP_JOIN}
     WHERE s.id = $2`,
    [uid, spaceId]
  );
  return rows[0] || null;
}

function hasRole(access, allowedRoles) {
  return Boolean(access && allowedRoles.has(access.role));
}

async function getProductAccess(uid, productId, client = pool) {
  const { rows } = await client.query(
    'SELECT id, space_id FROM products WHERE id = $1',
    [productId]
  );
  if (!rows.length) return null;
  const product = rows[0];
  const access = await getSpaceAccess(uid, product.space_id, client);
  return access ? { product, access } : null;
}

async function getBookingAccess(uid, bookingId, client = pool) {
  const { rows } = await client.query(
    `SELECT b.id, b.user_id,
       COALESCE(bool_or(
         s.owner_id = $1 OR sm.role IN ('owner', 'admin', 'editor', 'viewer')
       ), false) AS can_read,
       COALESCE(bool_or(
         s.owner_id = $1 OR sm.role IN ('owner', 'admin', 'editor')
       ), false) AS can_write
     FROM bookings b
     LEFT JOIN booking_parent_spaces bps ON bps.booking_id = b.id
     LEFT JOIN spaces s ON s.id = bps.space_id
     LEFT JOIN space_members sm ON sm.space_id = s.id AND sm.user_id = $1
     WHERE b.id = $2
     GROUP BY b.id, b.user_id`,
    [uid, bookingId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    isOwner: row.user_id === uid,
    canRead: row.user_id === uid || row.can_read,
    canWrite: row.user_id === uid || row.can_write,
  };
}

function forbidden(res) {
  return res.status(403).json({ error: 'Nicht berechtigt' });
}

module.exports = {
  GROUP_JOIN,
  GROUP_ROLE,
  HAS_GROUP_ACCESS,
  READ_ROLES,
  WRITE_ROLES,
  ADMIN_ROLES,
  getSpaceAccess,
  getProductAccess,
  getBookingAccess,
  hasRole,
  forbidden,
};
