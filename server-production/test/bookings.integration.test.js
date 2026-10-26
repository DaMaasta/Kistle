const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp } = require('./helpers/testApp');

let app;
test.beforeEach(async () => { app = await createTestApp(); });
test.afterEach(async () => { await app.close(); });

async function book(uid, items, id) {
  return app.request(uid, 'POST', '/bookings', { id, items });
}

test('Abbuchung zieht den Bestand ab und liefert die neuen Mengen', async () => {
  await app.createProduct('hammer', 5);
  const res = await book('editor', [{ productId: 'hammer', quantity: 2 }]);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.products.map(p => [p.id, p.quantity]), [['hammer', 3]]);
  assert.equal(await app.stock('hammer'), 3);
});

test('Wiederholte Abbuchung mit derselben ID bucht nicht doppelt ab', async () => {
  await app.createProduct('hammer', 5);
  const first = await book('editor', [{ productId: 'hammer', quantity: 2 }], 'cart-1');
  const retry = await book('editor', [{ productId: 'hammer', quantity: 2 }], 'cart-1');
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.id, 'cart-1');
  assert.equal(retry.body.duplicate, true);
  assert.deepEqual(retry.body.products.map(p => [p.id, p.quantity]), [['hammer', 3]]);
  assert.equal(await app.stock('hammer'), 3);
  assert.equal((await app.sql("SELECT * FROM bookings WHERE type='booking'")).length, 1);
});

test('Fremde Buchungs-ID wird nicht als Duplikat bestätigt', async () => {
  await app.createProduct('hammer', 5);
  await book('editor', [{ productId: 'hammer', quantity: 1 }], 'cart-1');
  const res = await book('owner', [{ productId: 'hammer', quantity: 1 }], 'cart-1');
  assert.equal(res.status, 409);
  assert.equal(await app.stock('hammer'), 4);
});

test('Zu wenig Bestand: Fehlermeldung nennt das Produkt, nichts wird gebucht', async () => {
  await app.createProduct('hammer', 5, { name: 'Hammer' });
  await app.createProduct('zange', 1, { name: 'Zange' });
  const res = await book('editor', [{ productId: 'hammer', quantity: 1 }, { productId: 'zange', quantity: 2 }]);
  assert.equal(res.status, 409);
  assert.match(res.body.error, /Nicht genügend Bestand: Zange \(noch 1 Stück\)/);
  assert.equal(await app.stock('hammer'), 5);
  assert.equal((await app.sql('SELECT * FROM bookings')).length, 0);
});

test('Viewer darf nicht abbuchen', async () => {
  await app.createProduct('hammer', 5);
  const res = await book('viewer', [{ productId: 'hammer', quantity: 1 }]);
  assert.equal(res.status, 403);
  assert.equal(await app.stock('hammer'), 5);
});

test('Teil-Rückgaben: der Rest bleibt rückbuchbar, danach ist die Buchung erledigt', async () => {
  await app.createProduct('hammer', 10);
  await app.createProduct('zange', 10);
  const { body: { id } } = await book('editor', [
    { productId: 'hammer', quantity: 4 },
    { productId: 'zange', quantity: 2 },
  ]);

  const partial = await app.request('editor', 'POST', `/bookings/${id}/return`, {
    items: [{ productId: 'hammer', quantity: 1 }],
  });
  assert.equal(partial.status, 200);
  assert.equal(partial.body.isReturned, false);
  assert.equal(await app.stock('hammer'), 7);

  const list = await app.request('editor', 'GET', '/bookings?groupId=group');
  const original = list.body.find(b => b.id === id);
  const hammer = original.items.find(i => i.productId === 'hammer');
  assert.equal(hammer.returnedQuantity, 1);
  assert.equal(original.isReturned, false);

  const rest = await app.request('editor', 'POST', `/bookings/${id}/return`, {});
  assert.equal(rest.status, 200);
  assert.equal(rest.body.isReturned, true);
  assert.equal(await app.stock('hammer'), 10);
  assert.equal(await app.stock('zange'), 10);

  const again = await app.request('editor', 'POST', `/bookings/${id}/return`, {});
  assert.equal(again.status, 409);
  assert.equal(await app.stock('hammer'), 10);
});

test('Rückgabe über die offene Menge hinaus wird abgelehnt', async () => {
  await app.createProduct('hammer', 10);
  const { body: { id } } = await book('editor', [{ productId: 'hammer', quantity: 3 }]);
  await app.request('editor', 'POST', `/bookings/${id}/return`, { items: [{ productId: 'hammer', quantity: 2 }] });
  const res = await app.request('editor', 'POST', `/bookings/${id}/return`, { items: [{ productId: 'hammer', quantity: 2 }] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /offen: 1/);
  assert.equal(await app.stock('hammer'), 9);
});

test('Dezimalmengen lassen sich in Teilen exakt zurückgeben', async () => {
  await app.createProduct('kabel', 1);
  const { body: { id } } = await book('editor', [{ productId: 'kabel', quantity: 0.3 }]);
  await app.request('editor', 'POST', `/bookings/${id}/return`, { items: [{ productId: 'kabel', quantity: 0.1 }] });
  const rest = await app.request('editor', 'POST', `/bookings/${id}/return`, { items: [{ productId: 'kabel', quantity: 0.2 }] });
  assert.equal(rest.status, 200);
  assert.equal(rest.body.isReturned, true);
  assert.equal(await app.stock('kabel'), 1);
});

test('Gleichzeitige Rückbuchungen geben den Bestand nur einmal zurück', async () => {
  await app.createProduct('hammer', 5);
  const { body: { id } } = await book('editor', [{ productId: 'hammer', quantity: 2 }]);
  const results = await Promise.all([
    app.request('editor', 'POST', `/bookings/${id}/return`, {}),
    app.request('owner', 'POST', `/bookings/${id}/return`, {}),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(await app.stock('hammer'), 5);
});

test('Eine Rückbuchung selbst kann nicht zurückgebucht werden', async () => {
  await app.createProduct('hammer', 5);
  const { body: { id } } = await book('editor', [{ productId: 'hammer', quantity: 2 }]);
  const ret = await app.request('editor', 'POST', `/bookings/${id}/return`, {});
  const res = await app.request('editor', 'POST', `/bookings/${ret.body.id}/return`, {});
  assert.equal(res.status, 400);
  assert.equal(await app.stock('hammer'), 5);
});

test('Gelöschtes Produkt blockiert die Rückgabe der übrigen Positionen nicht', async () => {
  await app.createProduct('hammer', 5);
  await app.createProduct('zange', 5);
  const { body: { id } } = await book('editor', [
    { productId: 'hammer', quantity: 1 },
    { productId: 'zange', quantity: 1 },
  ]);
  await app.sql("DELETE FROM products WHERE id='zange'");

  const list = await app.request('editor', 'GET', '/bookings?groupId=group');
  const deleted = list.body.find(b => b.id === id).items.find(i => i.productName === 'zange');
  assert.equal(deleted.productExists, false);

  const res = await app.request('editor', 'POST', `/bookings/${id}/return`, {});
  assert.equal(res.status, 200);
  assert.equal(res.body.isReturned, true);
  assert.equal(await app.stock('hammer'), 5);
});

test('Viewer darf fremde Buchungen nicht zurückbuchen', async () => {
  await app.createProduct('hammer', 5);
  const { body: { id } } = await book('editor', [{ productId: 'hammer', quantity: 2 }]);
  const res = await app.request('viewer', 'POST', `/bookings/${id}/return`, {});
  assert.equal(res.status, 403);
  assert.equal(await app.stock('hammer'), 3);
});

test('Buchungen lassen sich nicht mehr ohne Bestandskorrektur löschen', async () => {
  await app.createProduct('hammer', 5);
  const { body: { id } } = await book('editor', [{ productId: 'hammer', quantity: 2 }]);
  const res = await app.request('editor', 'DELETE', `/bookings/${id}`);
  assert.equal(res.status, 404);
  assert.equal((await app.sql('SELECT * FROM bookings WHERE id=$1', [id])).length, 1);
});
