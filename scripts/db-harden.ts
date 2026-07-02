#!/usr/bin/env npx tsx

import { getDb } from '@/lib/db/schema';
import { getOpenclawHome } from '@/lib/utils';

function runDbHardening() {
  console.log('Running DB hardening script...');
  const db = getDb();

  try {
    const config = db.prepare('SELECT openclaw_path FROM config WHERE id = 1').get() as any;
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
