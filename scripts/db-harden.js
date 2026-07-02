// scripts/db-harden.js
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function getOpenclawHome() {
  return process.env.OPENCLAW_HOME || path.join(process.env.HOME || '', '.openclaw');
}

function getDb() {
  const dbDir = process.env.DATA_DIR || path.join(process.env.HOME || '', '.openclaw-dashboard');
  const dbPath = path.join(dbDir, 'data.db');
  fs.mkdirSync(dbDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

function runDbHardening() {
  console.log('Running DB hardening script (JS version)...');
  const db = getDb();

  try {
    const config = db.prepare('SELECT openclaw_path FROM config WHERE id = 1').get();
    const newPath = getOpenclawHome();

    if (config && config.openclaw_path !== newPath) {
      console.log(`Old path found: ${config.openclaw_path}`);
      console.log(`Updating to new path: ${newPath}`);
      db.prepare('UPDATE config SET openclaw_path = ? WHERE id = 1').run(newPath);
      console.log('Database path updated successfully.');
    } else if (config) {
      console.log('Database path is already correct. No changes needed.');
    } else {
      console.log('No config found in database. Skipping update.');
    }
  } catch (error) {
    console.error('An error occurred during DB hardening:', error);
  }
}

runDbHardening();
