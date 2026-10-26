const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createTestApp } = require('./helpers/testApp');
const { migrateTable } = require('../ops/migrate-images');

const PNG = 'data:image/png;base64,' + Buffer.from('fake-png-bytes').toString('base64');

test('Base64-Fotos werden zu Dateien, gleiche Bilder teilen sich eine Datei', async (t) => {
  const app = await createTestApp();
  const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'kistle-images-'));
  const previous = process.env.DATA_PATH;
  process.env.DATA_PATH = dataPath;
  fs.mkdirSync(path.join(dataPath, 'images'));
  t.after(async () => {
    process.env.DATA_PATH = previous;
    fs.rmSync(dataPath, { recursive: true, force: true });
    await app.close();
  });

  await app.createProduct('hammer', 5, { imageUrl: PNG });
  await app.createProduct('zange', 5, { imageUrl: '/api/images/schon-datei.jpg' });
  await app.request('editor', 'POST', '/bookings', { items: [{ productId: 'hammer', quantity: 1 }] });

  const products = await migrateTable('products');
  const items = await migrateTable('booking_items');
  assert.equal(products.migrated, 1);
  assert.equal(items.migrated, 1);

  const [hammer] = await app.sql("SELECT image_url FROM products WHERE id='hammer'");
  const [zange] = await app.sql("SELECT image_url FROM products WHERE id='zange'");
  const [item] = await app.sql('SELECT image_url FROM booking_items');
  assert.match(hammer.image_url, /^\/api\/images\/[0-9a-f]{32}\.png$/);
  assert.equal(item.image_url, hammer.image_url);
  assert.equal(zange.image_url, '/api/images/schon-datei.jpg');

  const files = fs.readdirSync(path.join(dataPath, 'images'));
  assert.deepEqual(files, [path.basename(hammer.image_url)]);
  assert.equal(fs.readFileSync(path.join(dataPath, 'images', files[0]), 'utf8'), 'fake-png-bytes');

  const again = await migrateTable('products');
  assert.equal(again.rows, 0);
});
