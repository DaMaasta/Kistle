import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import type { Space, SpaceMember, UserRole } from '../../../src/types/index.js';

const router = Router();
router.use(requireAuth);

function rowToMember(r: Record<string, unknown>): SpaceMember {
  return {
    userId:      r.user_id as string,
    email:       r.email as string,
    displayName: r.display_name as string,
    role:        r.role as UserRole,
  };
}

function rowToSpace(r: Record<string, unknown>, members: SpaceMember[] = []): Space {
  return {
    id:          r.id as string,
    name:        r.name as string,
    description: (r.description as string) || '',
    type:        (r.type as Space['type']) || 'other',
    parentId:    (r.parent_id as string | null) ?? null,
    ownerId:     r.owner_id as string,
    memberIds:   members.map((m) => m.userId),
    members:     Object.fromEntries(members.map((m) => [m.userId, m])),
    icon:        (r.icon as string) || '📦',
    color:       (r.color as string) || '#3b82f6',
    isGroup:     (r.is_group as boolean) ?? false,
    accessCode:  (r.access_code as string | undefined),
    createdAt:   new Date(r.created_at as string),
    updatedAt:   new Date(r.updated_at as string),
  };
}

async function loadSpaceWithMembers(spaceId: string): Promise<Space | null> {
  const row = await queryOne('SELECT * FROM spaces WHERE id = $1', [spaceId]);
  if (!row) return null;
  const memberRows = await query('SELECT * FROM space_members WHERE space_id = $1', [spaceId]);
  return rowToSpace(row, memberRows.map(rowToMember));
}

// GET /spaces — alle Spaces des eingeloggten Users
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const memberRows = await query<{ space_id: string }>(
    'SELECT space_id FROM space_members WHERE user_id = $1', [userId]
  );
  if (memberRows.length === 0) { res.json([]); return; }
  const ids = memberRows.map((r) => r.space_id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const spaceRows = await query(`SELECT * FROM spaces WHERE id IN (${placeholders})`, ids);
  const allMemberRows = await query(
    `SELECT * FROM space_members WHERE space_id IN (${placeholders})`, ids
  );
  const spaces = spaceRows.map((row) => {
    const members = allMemberRows
      .filter((m) => m.space_id === row.id)
      .map(rowToMember);
    return rowToSpace(row, members);
  });
  res.json(spaces);
});

// GET /spaces/:id
router.get('/:id', async (req, res) => {
  const space = await loadSpaceWithMembers(req.params.id);
  if (!space) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
  res.json(space);
});

// POST /spaces
router.post('/', async (req, res) => {
  const u = req.user!;
  const { name, description, type, parentId, icon, color, isGroup, accessCode } = req.body as Partial<Space>;
  const [row] = await query<{ id: string }>(
    `INSERT INTO spaces (name, description, type, parent_id, owner_id, icon, color, is_group, access_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [name, description ?? '', type ?? 'other', parentId ?? null, u.userId,
     icon ?? '📦', color ?? '#3b82f6', isGroup ?? false, accessCode ?? null]
  );
  await query(
    'INSERT INTO space_members (space_id, user_id, email, display_name, role) VALUES ($1,$2,$3,$4,$5)',
    [row.id, u.userId, u.email, u.displayName, 'owner']
  );
  res.status(201).json({ id: row.id });
});

// PUT /spaces/:id
router.put('/:id', async (req, res) => {
  const { name, description, icon, color, accessCode } = req.body as Partial<Space>;
  await query(
    `UPDATE spaces SET
       name        = COALESCE($1, name),
       description = COALESCE($2, description),
       icon        = COALESCE($3, icon),
       color       = COALESCE($4, color),
       access_code = COALESCE($5, access_code)
     WHERE id = $6`,
    [name ?? null, description ?? null, icon ?? null, color ?? null, accessCode ?? null, req.params.id]
  );
  res.json({ ok: true });
});

// DELETE /spaces/:id
router.delete('/:id', async (req, res) => {
  await query('DELETE FROM spaces WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// GET /spaces/:id/content-count
router.get('/:id/content-count', async (req, res) => {
  const [boxes] = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM spaces WHERE parent_id = $1', [req.params.id]
  );
  const [products] = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM products WHERE space_id = $1', [req.params.id]
  );
  res.json({ boxes: Number(boxes.count), products: Number(products.count) });
});

// POST /spaces/:id/join
router.post('/:id/join', async (req, res) => {
  const u = req.user!;
  await query(
    `INSERT INTO space_members (space_id, user_id, email, display_name, role)
     VALUES ($1,$2,$3,$4,'editor')
     ON CONFLICT (space_id, user_id) DO NOTHING`,
    [req.params.id, u.userId, u.email, u.displayName]
  );
  res.json({ ok: true });
});

// POST /spaces/:id/access-code  — regeneriert den Zugangscode
router.post('/:id/access-code', async (req, res) => {
  const { length = 4 } = req.body as { length?: number };
  const code = Array.from({ length }, () => String(Math.floor(Math.random() * 10))).join('');
  await query('UPDATE spaces SET access_code = $1 WHERE id = $2', [code, req.params.id]);
  res.json({ accessCode: code });
});

// DELETE /spaces/:spaceId/members/:userId
router.delete('/:spaceId/members/:userId', async (req, res) => {
  await query(
    'DELETE FROM space_members WHERE space_id = $1 AND user_id = $2',
    [req.params.spaceId, req.params.userId]
  );
  res.json({ ok: true });
});

export default router;
