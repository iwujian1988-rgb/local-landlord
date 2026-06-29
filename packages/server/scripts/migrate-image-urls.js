/**
 * One-shot migration: convert absolute upload URLs baked into the DB
 * (http://192.168.x.x:3000/uploads/...) into host-relative paths (/uploads/...).
 *
 * Background: getFileUrl() used to return an absolute URL using BASE_URL or
 * the current host IP. As soon as the server's IP changed (different WiFi,
 * prod cutover, etc.), every previously stored URL went 404 and the miniapp
 * showed blank images. Going forward getFileUrl() returns /uploads/... and
 * the frontend prepends its current API host.
 *
 * Run: node scripts/migrate-image-urls.js
 */
const path = require('path');
const fs = require('fs');

(async () => {
  const SQL = await require('sql.js')();
  const dbPath = path.join(__dirname, '..', 'data', 'local_landlord.sqlite');
  if (!fs.existsSync(dbPath)) {
    console.error('DB not found:', dbPath);
    process.exit(1);
  }
  const db = new SQL.Database(fs.readFileSync(dbPath));

  // Tables / columns that store URL arrays or URL strings.
  // Build the list dynamically so we don't miss any.
  const targets = [
    { table: 'room', column: 'images', json: true },
    { table: 'room', column: 'facilities', json: true, skip: true }, // facilities is string tags, not URLs
    { table: 'property', column: 'cover_image', json: false },
    { table: 'document', column: 'image_url', json: false },
    { table: 'bill', column: 'photos', json: true },
    { table: 'landlord', column: 'avatar', json: false },
    { table: 'payment_qr', column: 'image_url', json: false },
  ];

  const rewrites = [];
  for (const t of targets) {
    if (t.skip) continue;
    let rows;
    try {
      rows = db.exec(`SELECT id, ${t.column} FROM ${t.table} WHERE ${t.column} IS NOT NULL AND ${t.column} != ''`);
    } catch (e) {
      console.log(`skip ${t.table}.${t.column}: ${e.message}`);
      continue;
    }
    if (!rows.length) continue;
    for (const [id, raw] of rows[0].values) {
      const text = String(raw);
      if (!text) continue;

      let newVal = text;
      if (t.json) {
        try {
          const arr = JSON.parse(text);
          if (!Array.isArray(arr)) continue;
          const rewritten = arr.map(u =>
            typeof u === 'string' && /\/uploads\//.test(u)
              ? u.replace(/^https?:\/\/[^/]+/, '')
              : u
          );
          if (JSON.stringify(rewritten) !== JSON.stringify(arr)) {
            newVal = JSON.stringify(rewritten);
          } else continue;
        } catch {
          continue;
        }
      } else {
        if (!/\/uploads\//.test(text)) continue;
        const stripped = text.replace(/^https?:\/\/[^/]+/, '');
        if (stripped === text) continue;
        newVal = stripped;
      }

      rewrites.push({ table: t.table, column: t.column, id, newVal });
    }
  }

  if (!rewrites.length) {
    console.log('No rows need migration. DB is already using relative paths.');
    return;
  }

  console.log(`Rewriting ${rewrites.length} rows...`);
  db.run('BEGIN TRANSACTION');
  try {
    for (const r of rewrites) {
      db.run(
        `UPDATE ${r.table} SET ${r.column} = ? WHERE id = ?`,
        [r.newVal, r.id],
      );
      console.log(`  ${r.table}.${r.column} id=${r.id} -> ${r.newVal.slice(0, 80)}${r.newVal.length > 80 ? '...' : ''}`);
    }
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    console.error('Migration failed, rolled back:', e);
    process.exit(1);
  }

  const out = db.export();
  fs.writeFileSync(dbPath, Buffer.from(out));
  console.log(`Done. ${rewrites.length} rows rewritten, DB saved.`);
})().catch(e => { console.error(e); process.exit(1); });
