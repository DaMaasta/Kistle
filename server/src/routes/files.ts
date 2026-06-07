import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const DATA_PATH = process.env.DATA_PATH ?? '/mnt/data';
const UPLOADS_DIR = path.join(DATA_PATH, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Ordner ───────────────────────────────────────────────────────────────────

// GET /folders
router.get('/folders', async (req, res) => {
  const rows = await query(
    'SELECT * FROM folders WHERE owner_id = $1 ORDER BY name',
    [req.user!.userId]
  );
  res.json(rows);
});

// POST /folders
router.post('/folders', async (req, res) => {
  const { name, parentId } = req.body as { name: string; parentId?: string };
  const [row] = await query<{ id: string }>(
    'INSERT INTO folders (owner_id, parent_id, name) VALUES ($1,$2,$3) RETURNING id',
    [req.user!.userId, parentId ?? null, name]
  );
  res.status(201).json({ id: row.id });
});

// DELETE /folders/:id
router.delete('/folders/:id', async (req, res) => {
  await query('DELETE FROM folders WHERE id = $1 AND owner_id = $2',
    [req.params.id, req.user!.userId]);
  res.json({ ok: true });
});

// ─── Dateien ──────────────────────────────────────────────────────────────────

// GET /files?folderId=xxx
router.get('/files', async (req, res) => {
  const { folderId } = req.query as { folderId?: string };
  const rows = folderId
    ? await query('SELECT * FROM files WHERE owner_id = $1 AND folder_id = $2 ORDER BY name',
        [req.user!.userId, folderId])
    : await query('SELECT * FROM files WHERE owner_id = $1 ORDER BY name',
        [req.user!.userId]);
  res.json(rows);
});

// POST /files  — Datei hochladen
router.post('/files', upload.single('file'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return; }
  const { folderId } = req.body as { folderId?: string };
  const storageRef = req.file.filename;
  const url = `/files/download/${storageRef}`;
  const [row] = await query<{ id: string }>(
    `INSERT INTO files (owner_id, folder_id, name, mime_type, size, storage_ref, url)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [req.user!.userId, folderId ?? null, req.file.originalname,
     req.file.mimetype, req.file.size, storageRef, url]
  );
  res.status(201).json({ id: row.id, url });
});

// GET /files/download/:filename
router.get('/files/download/:filename', requireAuth, (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
  res.sendFile(filePath);
});

// DELETE /files/:id
router.delete('/files/:id', async (req, res) => {
  const file = await queryOne<{ storage_ref: string }>(
    'SELECT storage_ref FROM files WHERE id = $1 AND owner_id = $2',
    [req.params.id, req.user!.userId]
  );
  if (!file) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
  const filePath = path.join(UPLOADS_DIR, file.storage_ref);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await query('DELETE FROM files WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ─── Produktbilder ────────────────────────────────────────────────────────────

// POST /files/images  — Produktbild hochladen
router.post('/images', upload.single('image'), (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'Kein Bild' }); return; }
  const url = `/files/download/${req.file.filename}`;
  res.status(201).json({ url });
});

export default router;
