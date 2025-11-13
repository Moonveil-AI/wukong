#!/usr/bin/env node

/**
 * CLI tool for running SQLite migrations
 *
 * Usage:
 *   pnpm migrate                      - Run pending migrations (default db)
 *   pnpm migrate:status               - Show migration status
 *   tsx src/cli/migrate.ts up ./custom.db  - Use custom database path
 */

import { runMigrationsCLI } from '../migrations.js';

runMigrationsCLI().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
