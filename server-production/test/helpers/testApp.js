// Test-Infrastruktur: echtes Postgres (PGlite, läuft in-process) mit dem Produktionsschema
// aus test/fixtures/schema.sql. Der pg-Pool aus ../../db wird auf PGlite umgebogen, die
// Express-Router laufen unverändert auf einem lokalen Port.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const pool = require('../../db');

function toPgResult(result) {
  return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
}

async function createTestApp() {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'schema.sql'), 'utf8'));

  // PGlite hat nur eine Verbindung. connect() serialisiert deshalb ganze Transaktionen
  // (wie es FOR UPDATE in Postgres für dieselbe Zeile täte); pool.query läuft direkt.
  let queue = Promise.resolve();
  const original = { query: pool.query, connect: pool.connect };
  pool.query = async (sql, params) => toPgResult(await db.query(sql, params));
  pool.connect = () => new Promise(resolveConnect => {
    queue = queue.then(() => new Promise(release => {
      resolveConnect({
        query: async (sql, params) => toPgResult(await db.query(sql, params)),
        release,
      });
    }));
  });

  const app = express();
  app.use(express.json());
  app.use('/api/products', require('../../routes/products'));
  app.use('/api/bookings', require('../../routes/bookings'));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  async function request(uid, method, urlPath, body) {
    const res = await fetch(baseUrl + urlPath, {
      method,
      headers: {
        Authorization: `Bearer ${jwt.sign({ uid }, process.env.JWT_SECRET)}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* z.B. HTML-404 von Express */ }
    return { status: res.status, body: parsed };
  }

  async function sql(text, params) {
    return (await db.query(text, params)).rows;
  }

  // Grunddaten: Gruppe mit einer Box, Besitzer, Editor, Viewer
  async function seed() {
    await sql(`INSERT INTO users (uid, email, display_name) VALUES
      ('owner', 'owner@test', 'Owner'), ('editor', 'editor@test', 'Editor'), ('viewer', 'viewer@test', 'Viewer')`);
    await sql(`INSERT INTO spaces (id, name, type, owner_id, is_group) VALUES ('group', 'Lager', 'room', 'owner', true)`);
    await sql(`INSERT INTO spaces (id, name, type, owner_id, parent_id, box_number) VALUES ('box', 'Kiste 1', 'kiste', 'owner', 'group', 1)`);
    await sql(`INSERT INTO space_members (space_id, user_id, role) VALUES ('group', 'editor', 'editor'), ('group', 'viewer', 'viewer')`);
  }

  async function createProduct(id, quantity, extra = {}) {
    await sql(
      `INSERT INTO products (id, name, space_id, quantity, unit, last_modified_by, image_url, min_quantity, category)
       VALUES ($1, $2, 'box', $3, 'Stück', 'owner', $4, $5, $6)`,
      [id, extra.name ?? id, quantity, extra.imageUrl ?? null, extra.minQuantity ?? null, extra.category ?? '']
    );
  }

  async function stock(id) {
    const rows = await sql('SELECT quantity FROM products WHERE id=$1', [id]);
    return rows.length ? Number(rows[0].quantity) : null;
  }

  async function close() {
    await new Promise(resolve => server.close(resolve));
    Object.assign(pool, original);
    await db.close();
  }

  await seed();
  return { request, sql, createProduct, stock, close };
}

module.exports = { createTestApp };
