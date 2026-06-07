import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import type { Booking, BookingItem } from '../../../src/types/index.js';

const router = Router();
router.use(requireAuth);

async function loadBooking(bookingId: string): Promise<Booking | null> {
  const row = await queryOne(`
    SELECT b.*, array_agg(DISTINCT s.id) FILTER (WHERE s.id IS NOT NULL) AS parent_ids
    FROM bookings b
    LEFT JOIN booking_items bi ON bi.booking_id = b.id
    LEFT JOIN spaces s ON s.id = bi.parent_id
    WHERE b.id = $1
    GROUP BY b.id
  `, [bookingId]);
  if (!row) return null;

  const itemRows = await query(`
    SELECT * FROM booking_items WHERE booking_id = $1
  `, [bookingId]);

  return rowToBooking(row, itemRows);
}

function rowToBooking(r: Record<string, unknown>, items: Record<string, unknown>[]): Booking {
  return {
    id:                r.id as string,
    userId:            r.user_id as string,
    userDisplayName:   r.user_display_name as string,
    userEmail:         r.user_email as string,
    createdAt:         new Date(r.created_at as string),
    parentIds:         (r.parent_ids as string[] | null) ?? [],
    type:              r.type as 'booking' | 'return',
    originalBookingId: (r.original_booking_id as string | undefined),
    isReturned:        (r.is_returned as boolean) ?? false,
    items:             items.map((i) => ({
      productId:   i.product_id as string,
      productName: i.product_name as string,
      quantity:    i.quantity as number,
      unit:        i.unit as string,
      imageUrl:    (i.image_url as string | null) ?? null,
      boxId:       i.box_id as string,
      boxName:     i.box_name as string,
      parentId:    (i.parent_id as string | null) ?? null,
      parentName:  i.parent_name as string,
    } as BookingItem)),
  };
}

// GET /bookings?groupId=xxx
router.get('/', async (req, res) => {
  const { groupId } = req.query as { groupId?: string };

  let bookingRows: Record<string, unknown>[];
  if (groupId) {
    bookingRows = await query(`
      SELECT DISTINCT b.*
      FROM bookings b
      JOIN booking_items bi ON bi.booking_id = b.id
      WHERE bi.parent_id = $1
      ORDER BY b.created_at DESC
    `, [groupId]);
  } else {
    bookingRows = await query(`SELECT * FROM bookings ORDER BY created_at DESC`);
  }

  if (bookingRows.length === 0) { res.json([]); return; }
  const ids = bookingRows.map((b) => b.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const itemRows = await query(
    `SELECT * FROM booking_items WHERE booking_id IN (${placeholders})`, ids
  );

  const bookings = bookingRows.map((row) => {
    const items = itemRows.filter((i) => i.booking_id === row.id);
    const parentIds = [...new Set(items.map((i) => i.parent_id).filter(Boolean))] as string[];
    return rowToBooking({ ...row, parent_ids: parentIds }, items);
  });
  res.json(bookings);
});

// POST /bookings
router.post('/', async (req, res) => {
  const u = req.user!;
  const { items } = req.body as { items: BookingItem[] };
  if (!items?.length) { res.status(400).json({ error: 'items erforderlich' }); return; }

  const [booking] = await query<{ id: string }>(
    `INSERT INTO bookings (user_id, user_display_name, user_email, type)
     VALUES ($1,$2,$3,'booking') RETURNING id`,
    [u.userId, u.displayName, u.email]
  );

  for (const item of items) {
    await query(
      `INSERT INTO booking_items
         (booking_id, product_id, product_name, quantity, unit, image_url, box_id, box_name, parent_id, parent_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [booking.id, item.productId, item.productName, item.quantity, item.unit,
       item.imageUrl ?? null, item.boxId, item.boxName, item.parentId ?? null, item.parentName]
    );
    // Menge abziehen
    await query(
      `UPDATE products SET
         quantity = GREATEST(0, quantity - $1),
         last_modified_by = $2, last_modified_by_email = $3, last_modified_at = NOW()
       WHERE id = $4`,
      [item.quantity, u.userId, u.email, item.productId]
    );
  }

  res.status(201).json({ id: booking.id });
});

// POST /bookings/:id/return
router.post('/:id/return', async (req, res) => {
  const u = req.user!;
  const original = await loadBooking(req.params.id);
  if (!original) { res.status(404).json({ error: 'Buchung nicht gefunden' }); return; }

  const [returnBooking] = await query<{ id: string }>(
    `INSERT INTO bookings (user_id, user_display_name, user_email, type, original_booking_id)
     VALUES ($1,$2,$3,'return',$4) RETURNING id`,
    [u.userId, u.displayName, u.email, original.id]
  );

  for (const item of original.items) {
    await query(
      `INSERT INTO booking_items
         (booking_id, product_id, product_name, quantity, unit, image_url, box_id, box_name, parent_id, parent_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [returnBooking.id, item.productId, item.productName, item.quantity, item.unit,
       item.imageUrl ?? null, item.boxId, item.boxName, item.parentId ?? null, item.parentName]
    );
    // Menge zurückbuchen
    await query(
      `UPDATE products SET
         quantity = quantity + $1,
         last_modified_by = $2, last_modified_by_email = $3, last_modified_at = NOW()
       WHERE id = $4`,
      [item.quantity, u.userId, u.email, item.productId]
    );
  }

  await query('UPDATE bookings SET is_returned = TRUE WHERE id = $1', [original.id]);
  res.status(201).json({ id: returnBooking.id });
});

export default router;
