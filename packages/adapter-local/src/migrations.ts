/**
 * Database Migration Runner for SQLite (Local)
 *
 * Handles running and tracking database migrations for the Wukong Agent system.
 */

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface MigrationInfo {
  version: number;
  description: string;
  filename: string;
  appliedAt?: string;
}

export interface MigrationResult {
  version: number;
  description: string;
  success: boolean;
  error?: string;
}

interface DbMigrationRow {
  version: number;
  description: string;
  // biome-ignore lint/style/useNamingConvention: matches database column name
  applied_at: string;
}

export class MigrationRunner {
  private migrationsPath: string;
  private dbPath: string;
  private silent: boolean;

  constructor(dbPath: string, migrationsPath?: string, silent = false) {
    this.dbPath = dbPath;
    // Default to migrations directory relative to this file
    this.migrationsPath = migrationsPath || join(__dirname, '../migrations');
    this.silent = silent;
  }

  /**
   * Log to console if not in silent mode
   */
  private log(...args: any[]): void {
    if (!this.silent) {
      console.log(...args);
    }
  }

  /**
   * Log error to console if not in silent mode
   */
  private logError(...args: any[]): void {
    if (!this.silent) {
      console.error(...args);
    }
  }

  /**
   * Get database connection
   */
  private getDb(): Database.Database {
    return new Database(this.dbPath);
  }

  /**
   * Get current schema version from database
   */
  // biome-ignore lint/suspicious/useAwait: async for API consistency with other adapters
  async getCurrentVersion(): Promise<number> {
    const db = this.getDb();

    try {
      // Check if schema_versions table exists
      const tableExists = db
        .prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='schema_versions'
      `)
        .get();

      if (!tableExists) {
        db.close();
        return 0;
      }

      const result = db.prepare('SELECT MAX(version) as version FROM schema_versions').get() as {
        version: number | null;
      };
      db.close();

      return result?.version || 0;
    } catch (_error) {
      db.close();
      return 0;
    }
  }

  /**
   * Get all applied migrations from database
   */
  async getAppliedMigrations(): Promise<MigrationInfo[]> {
    const db = this.getDb();

    try {
      const tableExists = db
        .prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='schema_versions'
      `)
        .get();

      if (!tableExists) {
        db.close();
        return [];
      }

      const rows = db
        .prepare(`
        SELECT version, description, applied_at 
        FROM schema_versions 
        ORDER BY version ASC
      `)
        .all() as DbMigrationRow[];

      db.close();

      return rows.map((row) => ({
        version: row.version,
        description: row.description,
        filename: `${String(row.version).padStart(3, '0')}_*.sql`,
        appliedAt: row.applied_at,
      }));
    } catch (_error) {
      db.close();
      return [];
    }
  }

  /**
   * Get all available migration files
   */
  async getAvailableMigrations(): Promise<MigrationInfo[]> {
    if (!existsSync(this.migrationsPath)) {
      throw new Error(`Migrations directory not found: ${this.migrationsPath}`);
    }

    const files = await readdir(this.migrationsPath);
    const migrationFiles = files.filter((f) => f.endsWith('.sql')).sort();

    return migrationFiles.map((filename) => {
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!(match?.[1] && match[2])) {
        throw new Error(`Invalid migration filename: ${filename}`);
      }

      return {
        version: Number.parseInt(match[1], 10),
        description: match[2].replace(/_/g, ' '),
        filename,
      };
    });
  }

  /**
   * Get pending migrations that haven't been applied
   */
  async getPendingMigrations(): Promise<MigrationInfo[]> {
    const [available, applied] = await Promise.all([
      this.getAvailableMigrations(),
      this.getAppliedMigrations(),
    ]);

    const appliedVersions = new Set(applied.map((m) => m.version));
    return available.filter((m) => !appliedVersions.has(m.version));
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: MigrationInfo): Promise<MigrationResult> {
    const filePath = join(this.migrationsPath, migration.filename);

    try {
      this.log(`Running migration ${migration.version}: ${migration.description}...`);

      // Read migration file
      const migrationSQL = await readFile(filePath, 'utf-8');

      // Execute migration in transaction
      const db = this.getDb();

      try {
        db.exec('BEGIN TRANSACTION');
        db.exec(migrationSQL);
        db.exec('COMMIT');
        db.close();
      } catch (error) {
        db.exec('ROLLBACK');
        db.close();
        throw error;
      }

      this.log(`✓ Migration ${migration.version} completed successfully`);

      return {
        version: migration.version,
        description: migration.description,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`✗ Migration ${migration.version} failed:`, errorMessage);

      return {
        version: migration.version,
        description: migration.description,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<MigrationResult[]> {
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      this.log('✓ No pending migrations');
      return [];
    }

    this.log(`Found ${pending.length} pending migration(s)`);

    const results: MigrationResult[] = [];

    for (const migration of pending) {
      const result = await this.runMigration(migration);
      results.push(result);

      // Stop on first failure
      if (!result.success) {
        this.logError('Migration failed. Stopping migration process.');
        break;
      }
    }

    const successful = results.filter((r) => r.success).length;
    this.log(`\n✓ Applied ${successful}/${pending.length} migration(s)`);

    return results;
  }

  /**
   * Get migration status
   */
  async status(): Promise<{
    currentVersion: number;
    appliedCount: number;
    pendingCount: number;
    applied: MigrationInfo[];
    pending: MigrationInfo[];
  }> {
    const [currentVersion, applied, pending] = await Promise.all([
      this.getCurrentVersion(),
      this.getAppliedMigrations(),
      this.getPendingMigrations(),
    ]);

    return {
      currentVersion,
      appliedCount: applied.length,
      pendingCount: pending.length,
      applied,
      pending,
    };
  }

  /**
   * Print migration status to console
   */
  async printStatus(): Promise<void> {
    const status = await this.status();

    this.log('\n=== Database Migration Status ===\n');
    this.log(`Database: ${this.dbPath}`);
    this.log(`Current version: ${status.currentVersion}`);
    this.log(`Applied migrations: ${status.appliedCount}`);
    this.log(`Pending migrations: ${status.pendingCount}`);

    if (status.applied.length > 0) {
      this.log('\n✓ Applied:');
      for (const migration of status.applied) {
        this.log(`  ${migration.version}. ${migration.description} (${migration.appliedAt})`);
      }
    }

    if (status.pending.length > 0) {
      this.log('\n⧗ Pending:');
      for (const migration of status.pending) {
        this.log(`  ${migration.version}. ${migration.description}`);
      }
    }

    this.log('');
  }
}

/**
 * CLI entry point for running migrations
 */
export async function runMigrationsCLI(): Promise<void> {
  const command = process.argv[2] || 'migrate';
  const dbPath = process.argv[3] || './data/wukong.db';

  const runner = new MigrationRunner(dbPath);

  try {
    switch (command) {
      case 'migrate':
      case 'up':
        await runner.migrate();
        break;

      case 'status':
        await runner.printStatus();
        break;

      default:
        console.log('Usage: migrate [command] [dbPath]');
        console.log('Commands:');
        console.log('  migrate, up  Run pending migrations (default)');
        console.log('  status       Show migration status');
        console.log('\nExample:');
        console.log('  migrate up ./data/wukong.db');
        console.log('  migrate status ./data/wukong.db');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}
