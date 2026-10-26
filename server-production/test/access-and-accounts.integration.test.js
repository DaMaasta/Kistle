const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTestApp } = require('./helpers/testApp');

let app;
test.beforeEach(async () => { app = await createTestApp(); });
test.afterEach(async () => { await app.close(); });

// ── Rechte: Boxen erben die Gruppenrolle ────────────────────────────────────

test('Neue Box bekommt keine eigene Mitgliedschaft und gehört dem Gruppenbesitzer', async () => {
  const res = await app.request('editor', 'POST', '/spaces', { name: 'Neue Kiste', parentId: 'group', type: 'kiste' });
  assert.equal(res.status, 200);
  const [box] = await app.sql('SELECT owner_id FROM spaces WHERE id=$1', [res.body.id]);
  assert.equal(box.owner_id, 'owner');
  assert.equal((await app.sql('SELECT * FROM space_members WHERE space_id=$1', [res.body.id])).length, 0);
});

test('Aus der Gruppe entfernter Editor verliert den Zugriff auf seine Boxen', async () => {
  const { body: { id: boxId } } = await app.request('editor', 'POST', '/spaces', { name: 'Meine Kiste', parentId: 'group' });
  await app.sql("INSERT INTO products (id, name, space_id, quantity, unit, last_modified_by) VALUES ('p', 'P', $1, 5, 'Stück', 'owner')", [boxId]);
  await app.request('owner', 'DELETE', '/spaces/group/members/editor');

  assert.equal((await app.request('editor', 'PUT', '/products/p', { quantity: 99 })).status, 403);
  assert.equal((await app.request('editor', 'GET', `/products?spaceId=${boxId}`)).status, 403);
  assert.equal((await app.request('editor', 'GET', `/spaces/${boxId}`)).status, 404);
  assert.equal((await app.request('editor', 'DELETE', `/spaces/${boxId}`)).status, 403);
  assert.equal(await app.stock('p'), 5);
});

test('Herabgestufter Editor (jetzt Viewer) kann in seiner Box nichts mehr ändern', async () => {
  const { body: { id: boxId } } = await app.request('editor', 'POST', '/spaces', { name: 'Meine Kiste', parentId: 'group' });
  await app.request('owner', 'PUT', '/spaces/group/members/editor', { role: 'viewer' });
  assert.equal((await app.request('editor', 'PUT', `/spaces/${boxId}`, { name: 'X' })).status, 403);
  assert.equal((await app.request('editor', 'GET', `/spaces/${boxId}`)).status, 200);
});

test('Box liefert die Mitgliederliste der Gruppe', async () => {
  const res = await app.request('viewer', 'GET', '/spaces/box');
  assert.equal(res.status, 200);
  assert.equal(res.body.role, 'viewer');
  assert.deepEqual(res.body.memberIds.sort(), ['editor', 'owner', 'viewer']);
});

// ── Löschen von Gruppen und Boxen ───────────────────────────────────────────

test('Gruppe mit Boxen lässt sich löschen, Boxen und Produkte verschwinden mit', async () => {
  await app.createProduct('hammer', 5);
  const res = await app.request('owner', 'DELETE', '/spaces/group');
  assert.equal(res.status, 200);
  assert.equal((await app.sql('SELECT * FROM spaces')).length, 0);
  assert.equal(await app.stock('hammer'), null);
});

test('Gruppe löschen dürfen nur Admins, Boxen auch Editoren', async () => {
  assert.equal((await app.request('editor', 'DELETE', '/spaces/group')).status, 403);
  assert.equal((await app.request('viewer', 'DELETE', '/spaces/box')).status, 403);
  assert.equal((await app.request('editor', 'DELETE', '/spaces/box')).status, 200);
});

// ── Einladungen ─────────────────────────────────────────────────────────────

test('Beitritt nur mit gültigem Einladungstoken', async () => {
  await app.sql("INSERT INTO users (uid, email, display_name) VALUES ('neu', 'neu@test', 'Neu')");
  assert.equal((await app.request('neu', 'POST', '/spaces/group/join', {})).status, 403);
  assert.equal((await app.request('neu', 'POST', '/spaces/group/join', { token: 'falsch' })).status, 403);
  assert.equal((await app.request('neu', 'POST', '/spaces/group/join', { token: 'invite-secret' })).status, 200);
  const [member] = await app.sql("SELECT role FROM space_members WHERE space_id='group' AND user_id='neu'");
  assert.equal(member.role, 'viewer');
});

test('Neuer Einladungslink macht den alten ungültig; nur Admins dürfen ihn erneuern', async () => {
  await app.sql("INSERT INTO users (uid, email, display_name) VALUES ('neu', 'neu@test', 'Neu')");
  assert.equal((await app.request('editor', 'POST', '/spaces/group/invite-token')).status, 403);
  const rotated = await app.request('owner', 'POST', '/spaces/group/invite-token');
  assert.equal(rotated.status, 200);
  assert.equal((await app.request('neu', 'POST', '/spaces/group/join', { token: 'invite-secret' })).status, 403);
  assert.equal((await app.request('neu', 'POST', '/spaces/group/join', { token: rotated.body.inviteToken })).status, 200);
});

test('Einladungstoken sehen nur Mitglieder, die einladen dürfen', async () => {
  assert.equal((await app.request('editor', 'GET', '/spaces/group')).body.inviteToken, 'invite-secret');
  assert.equal((await app.request('viewer', 'GET', '/spaces/group')).body.inviteToken, undefined);
});

test('Neue Gruppe bekommt einen zufälligen Einladungstoken', async () => {
  const res = await app.request('editor', 'POST', '/spaces', { name: 'Werkstatt', isGroup: true, type: 'room' });
  const [group] = await app.sql('SELECT invite_token FROM spaces WHERE id=$1', [res.body.id]);
  assert.ok(group.invite_token.length >= 24);
});

// ── Login, Passwort, Konto ──────────────────────────────────────────────────

async function register(email = 'anna@test.de', password = 'geheim123') {
  return app.request(null, 'POST', '/auth/register', { email, password, displayName: 'Anna' });
}

test('Registrierung prüft E-Mail und Passwortlänge', async () => {
  assert.equal((await register('keine-mail', 'geheim123')).status, 400);
  assert.equal((await register('anna@test.de', '123')).status, 400);
  assert.equal((await register('Anna@Test.de ', 'geheim123')).status, 200);
  assert.equal((await register('anna@test.de', 'geheim123')).status, 409);
});

test('Falsches Passwort beim Login ist 401 ohne vorhandenes Token', async () => {
  await register();
  const res = await app.request(null, 'POST', '/auth/login', { email: 'anna@test.de', password: 'falsch' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Ungültige Anmeldedaten');
});

test('Falsches aktuelles Passwort beim Ändern ist 403 (kein Ausloggen)', async () => {
  const { body: { token } } = await register();
  const res = await app.request({ token }, 'POST', '/auth/change-password', { currentPassword: 'falsch', newPassword: 'neuesPasswort' });
  assert.equal(res.status, 403);
});

test('Passwortwechsel meldet alte Tokens ab, das neue Token funktioniert', async () => {
  const { body: { token: oldToken } } = await register();
  // iat hat Sekunden-Auflösung: das alte Token muss aus einer früheren Sekunde stammen
  await new Promise(resolve => setTimeout(resolve, 1100));
  const changed = await app.request({ token: oldToken }, 'POST', '/auth/change-password', { currentPassword: 'geheim123', newPassword: 'neuesPasswort' });
  assert.equal(changed.status, 200);
  assert.equal((await app.request({ token: oldToken }, 'GET', '/auth/me')).status, 401);
  assert.equal((await app.request({ token: changed.body.token }, 'GET', '/auth/me')).status, 200);
});

test('Konto löschen: Gruppe geht an nächstes Mitglied, Verlauf und Produkte bleiben', async () => {
  await app.createProduct('hammer', 5);
  await app.request('owner', 'POST', '/bookings', { items: [{ productId: 'hammer', quantity: 1 }] });
  await app.request('owner', 'PUT', '/products/hammer', { name: 'Hammer 2' });

  const res = await app.request('owner', 'DELETE', '/auth/account', {});
  assert.equal(res.status, 200);

  const [group] = await app.sql("SELECT owner_id FROM spaces WHERE id='group'");
  const [box] = await app.sql("SELECT owner_id FROM spaces WHERE id='box'");
  const [member] = await app.sql("SELECT role FROM space_members WHERE space_id='group' AND user_id='editor'");
  assert.equal(group.owner_id, 'editor');
  assert.equal(box.owner_id, 'editor');
  assert.equal(member.role, 'admin');
  const [booking] = await app.sql('SELECT user_id, user_display_name FROM bookings');
  assert.equal(booking.user_id, null);
  assert.equal(booking.user_display_name, 'Owner');
  assert.equal(await app.stock('hammer'), 4);
});

test('Konto löschen: Gruppe ohne weitere Mitglieder wird gelöscht', async () => {
  await app.sql("DELETE FROM space_members WHERE user_id IN ('editor', 'viewer')");
  assert.equal((await app.request('owner', 'DELETE', '/auth/account', {})).status, 200);
  assert.equal((await app.sql('SELECT * FROM spaces')).length, 0);
});

test('Konto mit Passwort lässt sich nur mit richtigem Passwort löschen', async () => {
  const { body: { token } } = await register();
  assert.equal((await app.request({ token }, 'DELETE', '/auth/account', { password: 'falsch' })).status, 403);
  assert.equal((await app.request({ token }, 'DELETE', '/auth/account', {})).status, 403);
  assert.equal((await app.request({ token }, 'DELETE', '/auth/account', { password: 'geheim123' })).status, 200);
  assert.equal((await app.request({ token }, 'GET', '/auth/me')).status, 401);
});

// ── Kleinere Punkte ─────────────────────────────────────────────────────────

test('Boxnummern werden fortlaufend vergeben, auch bei gleichzeitigem Anlegen', async () => {
  const created = await Promise.all([1, 2, 3].map(n =>
    app.request('editor', 'POST', '/spaces', { name: `Kiste ${n}`, parentId: 'group' })));
  const ids = created.map(r => r.body.id);
  const rows = await app.sql('SELECT box_number FROM spaces WHERE id = ANY($1) ORDER BY box_number', [ids]);
  assert.deepEqual(rows.map(r => r.box_number), [2, 3, 4]);
});

test('Ungültige Eingaben ergeben 400 statt 500', async () => {
  assert.equal((await app.request('editor', 'PUT', '/spaces/box', { type: 'rakete' })).status, 400);
  assert.equal((await app.request('editor', 'PUT', '/spaces/box', { boxNumber: 'abc' })).status, 400);
  assert.equal((await app.request('editor', 'POST', '/products', { name: 'X', spaceId: 'box', unit: 'Tonne' })).status, 400);
});

test('Ordner löschen entfernt auch die Dokumente darin (inkl. Unterordner und Dateien)', async () => {
  await app.sql(`INSERT INTO folders (id, name, owner_id, parent_id) VALUES
    ('f1', 'Ordner', 'owner', NULL), ('f2', 'Unterordner', 'owner', 'f1')`);
  const file = path.join(app.dataPath, 'documents', 'doc.pdf');
  fs.writeFileSync(file, 'pdf');
  await app.sql(`INSERT INTO documents (id, name, owner_id, folder_id, file_path) VALUES
    ('d1', 'Rechnung', 'owner', 'f2', '/data/documents/doc.pdf'), ('d2', 'Lose', 'owner', NULL, NULL)`);

  const res = await app.request('owner', 'DELETE', '/documents/folders/f1');
  assert.equal(res.status, 200);
  assert.equal(res.body.deletedDocuments, 1);
  assert.deepEqual((await app.sql('SELECT id FROM documents')).map(r => r.id), ['d2']);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(fs.existsSync(file), false);
});
