// Einmalige Migration: Base64-Fotos (data:-URLs) aus products und booking_items in Dateien
// unter DATA_PATH/images auslagern. Danach sind die API-Antworten nur noch wenige KB groß.
//
// Dateiname = Hash des Inhalts: dasselbe Foto in Produkt und Buchungspositionen landet in
// genau einer Datei, und ein erneuter Lauf ist gefahrlos (bereits migrierte Zeilen haben
// keine data:-URL mehr).
//
// Im webapp-Container ausführen (dort sind DB-Zugang und DATA_PATH gesetzt):
//   docker exec webapp node ops/migrate-images.js --dry-run
//   docker exec webapp node ops/migrate-images.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../db');

const DRY_RUN = process.argv.includes('--dry-run');
const imageDir = () => path.join(process.env.DATA_PATH, 'images');
const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
};

function parseDataUrl(value) {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(value);
  if (!match) return null;
  const ext = EXTENSIONS[match[1].toLowerCase()];
  if (!ext) return null;
  return { ext, buffer: Buffer.from(match[2], 'base64') };
}

const written = new Set();

function storeImage(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed || parsed.buffer.length === 0) return null;
  const hash = crypto.createHash('sha256').update(parsed.buffer).digest('hex').slice(0, 32);
  const filename = hash + parsed.ext;
  const target = path.join(imageDir(), filename);
  if (!DRY_RUN && !written.has(filename) && !fs.existsSync(target)) {
    const tmp = target + '.tmp';
    fs.writeFileSync(tmp, parsed.buffer);
    fs.renameSync(tmp, target);
  }
  written.add(filename);
  return { url: '/api/images/' + filename, bytes: parsed.buffer.length };
}

async function migrateTable(table) {
  const { rows } = await pool.query(
    `SELECT id, image_url FROM ${table} WHERE image_url LIKE 'data:%'`
  );
  const stats = { table, rows: rows.length, migrated: 0, skipped: 0, base64Bytes: 0 };
  for (const row of rows) {
    stats.base64Bytes += row.image_url.length;
    const stored = storeImage(row.image_url);
    if (!stored) {
      stats.skipped++;
      console.warn(`${table} ${row.id}: unbekanntes Bildformat, übersprungen`);
      continue;
    }
    if (!DRY_RUN) {
      // Nur ersetzen, wenn das Foto nicht zwischenzeitlich geändert wurde
      await pool.query(
        `UPDATE ${table} SET image_url=$1 WHERE id=$2 AND image_url=$3`,
        [stored.url, row.id, row.image_url]
      );
    }
    stats.migrated++;
  }
  return stats;
}

async function main() {
  if (!process.env.DATA_PATH) throw new Error('DATA_PATH ist nicht gesetzt');
  fs.mkdirSync(imageDir(), { recursive: true });
  console.log(DRY_RUN ? 'Probelauf – es wird nichts geändert' : 'Migration läuft');
  for (const table of ['products', 'booking_items']) {
    const stats = await migrateTable(table);
    console.log(
      `${stats.table}: ${stats.migrated}/${stats.rows} migriert, ${stats.skipped} übersprungen, ` +
      `${(stats.base64Bytes / 1024 / 1024).toFixed(1)} MB Base64`
    );
  }
  console.log(`${written.size} eindeutige Bilddateien in ${imageDir()}`);
}

if (require.main === module) {
  main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { migrateTable, parseDataUrl };
