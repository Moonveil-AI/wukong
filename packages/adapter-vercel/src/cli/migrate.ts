#!/usr/bin/env node

/**
 * CLI tool for running Vercel Postgres migrations
 *
 * Usage:
 *   pnpm migrate          - Run pending migrations
 *   pnpm migrate:status   - Show migration status
 */

import { runMigrationsCLI } from '../migrations.js';

runMigrationsCLI().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
