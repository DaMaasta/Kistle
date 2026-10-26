const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware');
const { sendPushToUser } = require("../push");
const { broadcast } = require('../ws');
const { decrementProductStock, incrementProductStock } = require('../inventory');
const {
  READ_ROLES,
  WRITE_ROLES,
  getSpaceAccess,
  getBookingAccess,
  hasRole,
  forbidden,
} = require('../authorization');

// Toleranz für Dezimalmengen (numeric aus Postgres kommt als String/Float an)
const EPSILON = 1e-9;

function requestError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Gemeinsamer SELECT für Buchungslisten. returned_quantity summiert alle Rückbuchungen
// zu dieser Position, damit Teil-Rückgaben im Frontend korrekt angezeigt werden können.
const BOOKING_SELECT = `
  SELECT b.*,
    COALESCE(json_agg(DISTINCT jsonb_build_object(
      'product_id', bi.product_id, 'product_name', bi.product_name,
      'quantity', bi.quantity, 'unit', bi.unit, 'image_url', bi.image_url,
      'box_id', bi.box_id, 'box_name', bi.box_name, 'box_number', box_s.box_number,
      'parent_id', bi.parent_id, 'parent_name', bi.parent_name,
      'product_exists', p.id IS NOT NULL,
      'returned_quantity', CASE WHEN b.type = 'booking' THEN (
        SELECT COALESCE(SUM(ri.quantity), 0)
        FROM bookings r
        JOIN booking_items ri ON ri.booking_id = r.id
        WHERE r.original_booking_id = b.id AND r.type = 'return'
          AND ri.product_id = bi.product_id
      ) ELSE 0 END
    )) FILTER (WHERE bi.id IS NOT NULL), '[]') AS items,
    COALESCE(array_agg(DISTINCT bps.space_id) FILTER (WHERE bps.space_id IS NOT NULL), '{}') AS parent_ids
  FROM bookings b
  LEFT JOIN booking_items bi ON bi.booking_id = b.id
  LEFT JOIN products p ON p.id = bi.product_id
  LEFT JOIN spaces box_s ON box_s.id = bi.box_id
  LEFT JOIN booking_parent_spaces bps ON bps.booking_id = b.id`;

function mapBooking(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userDisplayName: row.user_display_name,
    userEmail: row.user_email,
    type: row.type,
    originalBookingId: row.original_booking_id,
    isReturned: row.is_returned,
    createdAt: row.created_at,
    parentIds: row.parent_ids || [],
    items: (row.items || []).filter(Boolean).map(i => ({
      productId: i.product_id,
      productName: i.product_name,
      quantity: parseFloat(i.quantity),
      returnedQuantity: parseFloat(i.returned_quantity ?? 0),
      productExists: i.product_exists !== false,
      unit: i.unit,
      imageUrl: i.image_url,
      boxId: i.box_id,
      boxName: i.box_name,
      boxNumber: i.box_number != null ? parseInt(i.box_number, 10) : null,
      parentId: i.parent_id,
      parentName: i.parent_name,
    })),
  };
}

async function notifyAdmins(spaceIds, currentUserId, displayName, message, type) {
  for (const spaceId of spaceIds) {
    const spaceRes = await pool.query('SELECT name FROM spaces WHERE id=$1', [spaceId]);
    const spaceName = spaceRes.rows[0]?.name || '';
    const adminsRes = await pool.query(
      `SELECT user_id FROM space_members WHERE space_id=$1 AND role IN ('admin', 'owner') AND user_id != $2
       UNION SELECT owner_id FROM spaces WHERE id=$1 AND owner_id != $2`,
      [spaceId, currentUserId]
    );
    for (const row of adminsRes.rows) {
      await pool.query(
        `INSERT INTO notifications (target_user_id, booking_user_name, group_id, group_name, message, type)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [row.user_id, displayName, spaceId, spaceName, message, type]
      );
      try {
        await sendPushToUser(row.user_id, { title: spaceName || 'Kistle', body: message });
      } catch (pushErr) {
        console.error('Push send error:', pushErr.message);
      }
    }
  }
}

// Benachrichtigungen laufen nach der Antwort, damit Push-Versand die Buchung nicht verzögert
function notifyAdminsInBackground(spaceIds, currentUserId, displayName, message, type) {
  notifyAdmins(spaceIds, currentUserId, displayName, message, type)
    .catch(err => console.error('Notification error:', err));
}

function quantityMessage(displayName, items, verb) {
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const posCount = items.length;
  const plural = totalQty !== 1 ? 'e' : '';
  const posPlural = posCount !== 1 ? 'en' : '';
  return displayName + ' hat ' + totalQty + ' Gegenstand' + plural + ' (' + posCount + ' Position' + posPlural + ') ' + verb;
}

async function currentProductQuantities(client, productIds) {
  if (productIds.length === 0) return [];
  const { rows } = await client.query(
    'SELECT id, quantity, last_modified_at FROM products WHERE id = ANY($1)',
    [productIds]
  );
  return rows.map(row => ({ id: row.id, quantity: Number(row.quantity), lastModifiedAt: row.last_modified_at }));
}

// GET /bookings?groupId=
router.get('/', auth, async (req, res) => {
  const { groupId } = req.query;
  try {
    let rows;
    if (groupId) {
      const access = await getSpaceAccess(req.user.uid, groupId);
      if (!hasRole(access, READ_ROLES)) return forbidden(res);
      const result = await pool.query(
        `${BOOKING_SELECT}
         JOIN booking_parent_spaces bps_filter ON bps_filter.booking_id = b.id AND bps_filter.space_id = $1
         GROUP BY b.id
         ORDER BY b.created_at DESC`,
        [groupId]
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        `${BOOKING_SELECT}
         WHERE b.user_id = $1
         GROUP BY b.id
         ORDER BY b.created_at DESC`,
        [req.user.uid]
      );
      rows = result.rows;
    }
    res.json(rows.map(mapBooking));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// GET /bookings/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const bookingAccess = await getBookingAccess(req.user.uid, req.params.id);
    if (!bookingAccess) return res.status(404).json({ error: 'Nicht gefunden' });
    if (!bookingAccess.canRead) return forbidden(res);
    const { rows } = await pool.query(
      `${BOOKING_SELECT}
       WHERE b.id = $1
       GROUP BY b.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json(mapBooking(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler' });
  }
});

// POST /bookings  (Abbuchung)
// Idempotent über die vom Client erzeugte id: Kommt dieselbe Abbuchung nach einem
// Netzwerkfehler erneut an, wird sie nicht doppelt gebucht, sondern bestätigt.
router.post('/', auth, async (req, res) => {
  const { id, items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Keine Items' });
  if (!Array.isArray(items) || items.length > 100) return res.status(400).json({ error: 'Ungültige Anzahl Items' });
  if (id !== undefined && (typeof id !== 'string' || id.length === 0 || id.length > 64)) {
    return res.status(400).json({ error: 'Ungültige Buchungs-ID' });
  }
  if (items.some(item => typeof item?.productId !== 'string')) {
    return res.status(400).json({ error: 'Ungültiges Produkt' });
  }
  if (new Set(items.map(item => item.productId)).size !== items.length) {
    return res.status(400).json({ error: 'Doppelte Produkte sind nicht erlaubt' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query('SELECT display_name, email FROM users WHERE uid=$1', [req.user.uid]);
    const displayName = userRes.rows[0]?.display_name || '';
    const email = userRes.rows[0]?.email || '';

    const inserted = await client.query(
      `INSERT INTO bookings (id, user_id, user_display_name, user_email, type)
       VALUES (COALESCE($1, gen_random_uuid()::text),$2,$3,$4,'booking')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [id ?? null, req.user.uid, displayName, email]
    );
    if (inserted.rowCount === 0) {
      // Diese Abbuchung wurde bereits verarbeitet (Wiederholung nach Timeout)
      const existing = await client.query('SELECT user_id, type FROM bookings WHERE id=$1', [id]);
      await client.query('ROLLBACK');
      const row = existing.rows[0];
      if (!row || row.user_id !== req.user.uid || row.type !== 'booking') {
        return res.status(409).json({ error: 'Buchungs-ID bereits vergeben' });
      }
      const products = await currentProductQuantities(pool, items.map(item => item.productId));
      return res.json({ id, products, duplicate: true });
    }
    const bookingId = inserted.rows[0].id;

    const trustedItems = [];
    const updatedProducts = [];
    const spaceIds = new Set();
    for (const item of items) {
      const qty = Number(item.quantity ?? item.cartQuantity ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) throw requestError(400, 'Ungültige Menge');

      const productRes = await client.query(
        `SELECT p.*, s.name AS box_name, s.box_number, s.parent_id,
           parent.name AS parent_name, s.is_group
         FROM products p
         JOIN spaces s ON s.id = p.space_id
         LEFT JOIN spaces parent ON parent.id = s.parent_id
         WHERE p.id = $1
         FOR UPDATE OF p`,
        [item.productId]
      );
      if (!productRes.rows.length) {
        throw requestError(404, `Produkt nicht mehr vorhanden: ${item.productName || item.productId}`);
      }
      const product = productRes.rows[0];
      const access = await getSpaceAccess(req.user.uid, product.space_id, client);
      if (!hasRole(access, WRITE_ROLES)) throw requestError(403, 'Nicht berechtigt');
      if (Number(product.quantity) < qty) {
        throw requestError(409, `Nicht genügend Bestand: ${product.name} (noch ${Number(product.quantity)} ${product.unit})`);
      }

      const parentId = product.parent_id || product.space_id;
      spaceIds.add(parentId);
      const trustedItem = {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unit: product.unit,
        imageUrl: product.image_url,
        boxId: product.space_id,
        boxName: product.box_name,
        parentId,
        parentName: product.parent_name || product.box_name,
      };
      trustedItems.push(trustedItem);
      await client.query(
        `INSERT INTO booking_items (booking_id, product_id, product_name, quantity, unit, image_url, box_id, box_name, parent_id, parent_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [bookingId, trustedItem.productId, trustedItem.productName, qty, trustedItem.unit,
         trustedItem.imageUrl || null, trustedItem.boxId, trustedItem.boxName,
         trustedItem.parentId, trustedItem.parentName]
      );
      updatedProducts.push(await decrementProductStock(client, trustedItem.productId, qty, req.user.uid));
    }

    for (const spaceId of spaceIds) {
      await client.query(
        'INSERT INTO booking_parent_spaces (booking_id, space_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [bookingId, spaceId]
      );
    }

    await client.query('COMMIT');

    res.json({ id: bookingId, products: updatedProducts });
    broadcast('bookings', {});
    broadcast('products', {});
    notifyAdminsInBackground(
      [...spaceIds], req.user.uid, displayName,
      quantityMessage(displayName, trustedItems, 'abgebucht'), 'booking'
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Fehler beim Abbuchen' });
  } finally {
    client.release();
  }
});

// POST /bookings/:id/return  (Rückgabe, auch mehrfach als Teil-Rückgaben)
// body.items: Array<{productId, quantity}> | undefined (= alles Offene zurückgeben)
router.post('/:id/return', auth, async (req, res) => {
  const bodyItems = req.body?.items;
  if (bodyItems !== undefined && !Array.isArray(bodyItems)) {
    return res.status(400).json({ error: 'Ungültige Rückgabe' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Sperrt die Original-Buchung: parallele Rückbuchungen derselben Buchung laufen
    // nacheinander und sehen jeweils die bereits zurückgebuchten Mengen.
    const origRes = await client.query('SELECT id, type FROM bookings WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!origRes.rows.length) throw requestError(404, 'Nicht gefunden');
    if (origRes.rows[0].type !== 'booking') throw requestError(400, 'Nur Abbuchungen können zurückgebucht werden');

    const bookingAccess = await getBookingAccess(req.user.uid, req.params.id, client);
    if (!bookingAccess?.canWrite) throw requestError(403, 'Nicht berechtigt');

    const { rows: origItems } = await client.query(
      `SELECT bi.*, (p.id IS NOT NULL) AS product_exists,
         bi.quantity - COALESCE((
           SELECT SUM(ri.quantity)
           FROM bookings r
           JOIN booking_items ri ON ri.booking_id = r.id
           WHERE r.original_booking_id = bi.booking_id AND r.type = 'return'
             AND ri.product_id = bi.product_id
         ), 0) AS remaining
       FROM booking_items bi
       LEFT JOIN products p ON p.id = bi.product_id
       WHERE bi.booking_id = $1`,
      [req.params.id]
    );
    const returnable = origItems.filter(item => item.product_exists && Number(item.remaining) > EPSILON);

    let itemsToReturn;
    if (bodyItems && bodyItems.length > 0) {
      if (new Set(bodyItems.map(item => item?.productId)).size !== bodyItems.length) {
        throw requestError(400, 'Doppelte Produkte sind nicht erlaubt');
      }
      itemsToReturn = bodyItems.map(bodyItem => {
        const orig = origItems.find(item => item.product_id && item.product_id === bodyItem?.productId);
        if (!orig) throw requestError(400, 'Produkt ist nicht Teil dieser Buchung');
        if (!orig.product_exists) throw requestError(409, `Produkt existiert nicht mehr: ${orig.product_name}`);
        const qty = Number(bodyItem.quantity);
        if (!Number.isFinite(qty) || qty <= 0 || qty > Number(orig.remaining) + EPSILON) {
          throw requestError(400, `Ungültige Rückgabemenge: ${orig.product_name} (offen: ${Number(orig.remaining)} ${orig.unit})`);
        }
        return { ...orig, quantity: qty };
      });
    } else {
      itemsToReturn = returnable.map(item => ({ ...item, quantity: Number(item.remaining) }));
    }
    if (itemsToReturn.length === 0) throw requestError(409, 'Bereits vollständig zurückgebucht');

    const userRes = await client.query('SELECT display_name, email FROM users WHERE uid=$1', [req.user.uid]);
    const displayName = userRes.rows[0]?.display_name || '';
    const email = userRes.rows[0]?.email || '';

    const returnRes = await client.query(
      `INSERT INTO bookings (user_id, user_display_name, user_email, type, original_booking_id)
       VALUES ($1,$2,$3,'return',$4)
       RETURNING id`,
      [req.user.uid, displayName, email, req.params.id]
    );
    const returnId = returnRes.rows[0].id;

    const updatedProducts = [];
    for (const item of itemsToReturn) {
      await client.query(
        `INSERT INTO booking_items (booking_id, product_id, product_name, quantity, unit, image_url, box_id, box_name, parent_id, parent_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [returnId, item.product_id, item.product_name, item.quantity, item.unit,
         item.image_url, item.box_id, item.box_name, item.parent_id, item.parent_name || '']
      );
      updatedProducts.push(await incrementProductStock(client, item.product_id, item.quantity, req.user.uid));
    }

    // Vollständig zurückgegeben, wenn für kein noch existierendes Produkt etwas offen ist
    const allReturned = returnable.every(item => {
      const returnedNow = itemsToReturn.find(r => r.product_id === item.product_id)?.quantity ?? 0;
      return Number(item.remaining) - returnedNow <= EPSILON;
    });
    if (allReturned) {
      await client.query('UPDATE bookings SET is_returned=true WHERE id=$1', [req.params.id]);
    }

    const parentRes = await client.query(
      `INSERT INTO booking_parent_spaces (booking_id, space_id)
       SELECT $1, space_id FROM booking_parent_spaces WHERE booking_id=$2
       ON CONFLICT DO NOTHING
       RETURNING space_id`,
      [returnId, req.params.id]
    );
    const returnSpaceIds = parentRes.rows.map(row => row.space_id);

    await client.query('COMMIT');

    res.json({ id: returnId, products: updatedProducts, isReturned: allReturned });
    broadcast('bookings', {});
    broadcast('products', {});
    notifyAdminsInBackground(
      returnSpaceIds, req.user.uid, displayName,
      quantityMessage(displayName, itemsToReturn, 'zurückgebucht'), 'return'
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Fehler bei Rückgabe' });
  } finally {
    client.release();
  }
});

module.exports = router;
