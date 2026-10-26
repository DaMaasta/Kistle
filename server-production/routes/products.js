const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware');
const { broadcast } = require('../ws');
const multer = require('multer');
const { sendDbError } = require('../dbErrors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  GROUP_JOIN,
  HAS_GROUP_ACCESS,
  READ_ROLES,
  WRITE_ROLES,
  getSpaceAccess,
  getProductAccess,
  hasRole,
  forbidden,
} = require('../authorization');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.DATA_PATH + '/images'),
  // UUID statt Zeitstempel: zwei Uploads in derselben Millisekunde überschrieben sich
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.mimetype)),
});

async function requireProductWrite(req, res, next) {
  try {
    const productAccess = await getProductAccess(req.user.uid, req.params.id);
    if (!productAccess) return res.status(404).json({ error: 'Nicht gefunden' });
    if (!hasRole(productAccess.access, WRITE_ROLES)) return forbidden(res);
    req.productAccess = productAccess;
    next();
  } catch (err) {
    next(err);
  }
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    spaceId: row.space_id,
    quantity: parseFloat(row.quantity),
    minQuantity: row.min_quantity !== null ? parseFloat(row.min_quantity) : null,
    unit: row.unit,
    category: row.category,
    description: row.description,
    barcode: row.barcode,
    imageUrl: row.image_url,
    color: row.color,
    lastModifiedBy: row.last_modified_by,
    lastModifiedByEmail: '',
    lastModifiedAt: row.last_modified_at,
    createdAt: row.created_at,
  };
}

// GET /products?spaceId= oder GET /products?spaceIds=a,b,c
router.get('/', auth, async (req, res) => {
  const { spaceId, spaceIds } = req.query;
  try {
    let rows;
    if (spaceIds) {
      const ids = spaceIds.split(',').filter(Boolean);
      if (ids.length > 200) return res.status(400).json({ error: 'Zu viele Lagerorte' });
      ({ rows } = await pool.query(
        `SELECT p.* FROM products p
         JOIN spaces s ON s.id = p.space_id
         ${GROUP_JOIN}
         WHERE p.space_id = ANY($2) AND ${HAS_GROUP_ACCESS}
         ORDER BY p.name ASC`,
        [req.user.uid, ids]
      ));
    } else if (spaceId) {
      const access = await getSpaceAccess(req.user.uid, spaceId);
      if (!hasRole(access, READ_ROLES)) return forbidden(res);
      ({ rows } = await pool.query('SELECT * FROM products WHERE space_id=$1 ORDER BY name ASC', [spaceId]));
    } else {
      ({ rows } = await pool.query(
        `SELECT p.* FROM products p
         JOIN spaces s ON s.id = p.space_id
         ${GROUP_JOIN}
         WHERE ${HAS_GROUP_ACCESS}
         ORDER BY p.name ASC`,
        [req.user.uid]
      ));
    }
    res.json(rows.map(mapProduct));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// POST /products
router.post('/', auth, async (req, res) => {
  const { id, name, description, category, barcode, quantity, minQuantity, unit, spaceId, imageUrl, color } = req.body;
  const productId = id || (await pool.query('SELECT gen_random_uuid()::text AS id')).rows[0].id;
  try {
    if (!name || !spaceId || !unit) return res.status(400).json({ error: 'Fehlende Felder' });
    const access = await getSpaceAccess(req.user.uid, spaceId);
    if (!hasRole(access, WRITE_ROLES)) return forbidden(res);
    const parsedQuantity = Number(quantity ?? 0);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({ error: 'Ungültige Menge' });
    }
    await pool.query(
      `INSERT INTO products (id, name, description, category, barcode, quantity, min_quantity, unit, space_id, image_url, color, last_modified_by, last_modified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())`,
      [productId, name, description || '', category || '', barcode || null,
       parsedQuantity, minQuantity ?? null, unit, spaceId,
       imageUrl || null, color || null, req.user.uid]
    );
    res.json({ id: productId });
    broadcast('products', { spaceId });
  } catch (err) {
    sendDbError(res, err, 'Fehler beim Erstellen');
  }
});

// Felder, die per PUT geändert werden dürfen. Nicht mitgeschickte Felder bleiben unverändert.
const UPDATABLE_FIELDS = {
  name:        { column: 'name',         normalize: v => v },
  description: { column: 'description',  normalize: v => v ?? '' },
  category:    { column: 'category',     normalize: v => v ?? '' },
  barcode:     { column: 'barcode',      normalize: v => v || null },
  minQuantity: { column: 'min_quantity', normalize: v => v ?? null },
  unit:        { column: 'unit',         normalize: v => v },
  imageUrl:    { column: 'image_url',    normalize: v => v || null },
  color:       { column: 'color',        normalize: v => v || null },
};

// PUT /products/:id
// quantity setzt den Bestand absolut. Mit expectedQuantity (dem Bestand, den der Client
// beim Bearbeiten gesehen hat) wird nur gespeichert, wenn sich der Bestand inzwischen
// nicht durch eine Buchung geändert hat – sonst 409 statt stiller Überschreibung.
router.put('/:id', auth, async (req, res) => {
  const body = req.body || {};
  try {
    const productAccess = await getProductAccess(req.user.uid, req.params.id);
    if (!productAccess) return res.status(404).json({ error: 'Nicht gefunden' });
    if (!hasRole(productAccess.access, WRITE_ROLES)) return forbidden(res);

    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
      return res.status(400).json({ error: 'Name darf nicht leer sein' });
    }
    if (body.unit !== undefined && !body.unit) return res.status(400).json({ error: 'Ungültige Einheit' });

    const sets = [];
    const params = [];
    for (const [key, { column, normalize }] of Object.entries(UPDATABLE_FIELDS)) {
      if (body[key] === undefined) continue;
      params.push(normalize(body[key]));
      sets.push(`${column}=$${params.length}`);
    }

    let expectedCondition = '';
    if (body.quantity !== undefined) {
      const quantity = Number(body.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ error: 'Ungültige Menge' });
      params.push(quantity);
      sets.push(`quantity=$${params.length}`);
      if (body.expectedQuantity !== undefined) {
        const expected = Number(body.expectedQuantity);
        if (!Number.isFinite(expected)) return res.status(400).json({ error: 'Ungültige Menge' });
        params.push(expected);
        expectedCondition = ` AND quantity=$${params.length}`;
      }
    }

    params.push(req.user.uid);
    sets.push(`last_modified_by=$${params.length}`, 'last_modified_at=NOW()');
    params.push(req.params.id);

    const { rows, rowCount } = await pool.query(
      `UPDATE products SET ${sets.join(', ')}
       WHERE id=$${params.length}${expectedCondition}
       RETURNING *`,
      params
    );
    if (rowCount === 0) {
      return res.status(409).json({ error: 'Der Bestand wurde inzwischen geändert. Bitte neu laden und erneut speichern.' });
    }
    res.json({ success: true, product: mapProduct(rows[0]) });
    broadcast('products', { productId: req.params.id });
  } catch (err) {
    sendDbError(res, err, 'Fehler beim Updaten');
  }
});

// DELETE /products/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const productAccess = await getProductAccess(req.user.uid, req.params.id);
    if (!productAccess) return res.status(404).json({ error: 'Nicht gefunden' });
    if (!hasRole(productAccess.access, WRITE_ROLES)) return forbidden(res);
    await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ success: true });
    broadcast('products', {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// POST /products/:id/image
router.post('/:id/image', auth, requireProductWrite, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Ungültige Bilddatei' });
    const imageUrl = '/api/images/' + req.file.filename;
    await pool.query('UPDATE products SET image_url=$1 WHERE id=$2', [imageUrl, req.params.id]);
    res.json({ imageUrl });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Upload' });
  }
});

module.exports = router;
