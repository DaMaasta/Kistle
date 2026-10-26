const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp } = require('./helpers/testApp');

let app;
test.beforeEach(async () => { app = await createTestApp(); });
test.afterEach(async () => { await app.close(); });

test('Umbenennen lässt Foto, Mindestmenge, Kategorie und Bestand unverändert', async () => {
  await app.createProduct('hammer', 5, { imageUrl: '/api/images/1.jpg', minQuantity: 2, category: 'Werkzeug' });
  const res = await app.request('editor', 'PUT', '/products/hammer', { name: 'Großer Hammer' });
  assert.equal(res.status, 200);
  const [row] = await app.sql('SELECT * FROM products WHERE id=$1', ['hammer']);
  assert.equal(row.name, 'Großer Hammer');
  assert.equal(row.image_url, '/api/images/1.jpg');
  assert.equal(Number(row.min_quantity), 2);
  assert.equal(row.category, 'Werkzeug');
  assert.equal(Number(row.quantity), 5);
  assert.equal(res.body.product.name, 'Großer Hammer');
});

test('Bestand ändern mit passendem expectedQuantity', async () => {
  await app.createProduct('hammer', 5);
  const res = await app.request('editor', 'PUT', '/products/hammer', { quantity: 8, expectedQuantity: 5 });
  assert.equal(res.status, 200);
  assert.equal(await app.stock('hammer'), 8);
});

test('Bearbeiten überschreibt keine Abbuchung, die zwischendurch passiert ist', async () => {
  await app.createProduct('hammer', 5);
  // Editor öffnet das Produkt (Bestand 5), währenddessen bucht jemand 2 ab
  await app.request('owner', 'POST', '/bookings', { items: [{ productId: 'hammer', quantity: 2 }] });
  const res = await app.request('editor', 'PUT', '/products/hammer', { quantity: 6, expectedQuantity: 5 });
  assert.equal(res.status, 409);
  assert.equal(await app.stock('hammer'), 3);
});

test('Leerer Name und ungültige Einheit werden abgelehnt', async () => {
  await app.createProduct('hammer', 5);
  assert.equal((await app.request('editor', 'PUT', '/products/hammer', { name: '  ' })).status, 400);
  assert.equal((await app.request('editor', 'PUT', '/products/hammer', { unit: 'Tonne' })).status, 400);
  assert.equal((await app.request('editor', 'PUT', '/products/hammer', { quantity: -1 })).status, 400);
});

test('Viewer darf Produkte nicht bearbeiten', async () => {
  await app.createProduct('hammer', 5);
  const res = await app.request('viewer', 'PUT', '/products/hammer', { quantity: 50 });
  assert.equal(res.status, 403);
  assert.equal(await app.stock('hammer'), 5);
});
