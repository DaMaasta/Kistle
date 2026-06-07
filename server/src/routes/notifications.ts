import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppNotification } from '../../../src/types/index.js';

const router = Router();
router.use(requireAuth);

function rowToNotif(r: Record<string, unknown>): AppNotification {
  return {
    id:              r.id as string,
    targetUserId:    r.target_user_id as string,
    type:            r.type as 'booking',
    message:         r.message as string,
    bookingUserName: r.booking_user_name as string,
    groupId:         r.group_id as string,
    groupName:       r.group_name as string,
    createdAt:       new Date(r.created_at as string),
    read:            r.read as boolean,
  };
}

// GET /notifications?unreadOnly=true
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const unreadOnly = req.query.unreadOnly === 'true';
  const rows = unreadOnly
    ? await query('SELECT * FROM notifications WHERE target_user_id = $1 AND read = FALSE ORDER BY created_at DESC', [userId])
    : await query('SELECT * FROM notifications WHERE target_user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]);
  res.json(rows.map(rowToNotif));
});

// POST /notifications  — eine Benachrichtigung erstellen (intern, z.B. nach Buchung)
router.post('/', async (req, res) => {
  const { targetUserId, message, bookingUserName, groupId, groupName } =
    req.body as Partial<AppNotification>;
  await query(
    `INSERT INTO notifications (target_user_id, message, booking_user_name, group_id, group_name)
     VALUES ($1,$2,$3,$4,$5)`,
    [targetUserId, message ?? '', bookingUserName ?? '', groupId ?? null, groupName ?? '']
  );
  res.status(201).json({ ok: true });
});

// PUT /notifications/read-all
router.put('/read-all', async (req, res) => {
  await query(
    'UPDATE notifications SET read = TRUE WHERE target_user_id = $1',
    [req.user!.userId]
  );
  res.json({ ok: true });
});

export default router;
