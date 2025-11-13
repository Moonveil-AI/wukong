/**
 * Database Migration Runner for Vercel Postgres
 *
 * Handles running and tracking database migrations for the Wukong Agent system.
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from '@vercel/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface MigrationInfo {
  version: number;
  description: string;
  filename: string;
  appliedAt?: Date;
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
  applied_at: Date;
}

interface DbVersionRow {
  version: number | null;
}

export class MigrationRunner {
  private migrationsPath: string;

  constructor(migrationsPath?: string) {
    // Default to migrations directory relative to this file
    this.migrationsPath = migrationsPath || join(__dirname, '../migrations');
  }

  /**
   * Get current schema version from database
   */
  async getCurrentVersion(): Promise<number> {
    try {
      const result = await sql`
        SELECT MAX(version) as version 
        FROM schema_versions
      `;
      const row = result.rows[0] as DbVersionRow | undefined;
      return row?.version || 0;
    } catch (_error) {
      // Table doesn't exist yet
      return 0;
    }
  }

  /**
   * Get all applied migrations from database
   */
  async getAppliedMigrations(): Promise<MigrationInfo[]> {
    try {
      const result = await sql`
        SELECT version, description, applied_at 
        FROM schema_versions 
        ORDER BY version ASC
      `;

      const rows = result.rows as DbMigrationRow[];
      return rows.map((row) => ({
        version: row.version,
        description: row.description,
        filename: `${String(row.version).padStart(3, '0')}_*.sql`,
        appliedAt: row.applied_at,
      }));
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get all available migration files
   */
  async getAvailableMigrations(): Promise<MigrationInfo[]> {
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
      console.log(`Running migration ${migration.version}: ${migration.description}...`);

      // Read migration file
      const migrationSQL = await readFile(filePath, 'utf-8');

      // Execute migration (Postgres will handle transaction)
      await sql.query(migrationSQL);

      console.log(`✓ Migration ${migration.version} completed successfully`);

      return {
        version: migration.version,
        description: migration.description,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Migration ${migration.version} failed:`, errorMessage);

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
      console.log('✓ No pending migrations');
      return [];
    }

    console.log(`Found ${pending.length} pending migration(s)`);

    const results: MigrationResult[] = [];

    for (const migration of pending) {
      const result = await this.runMigration(migration);
      results.push(result);

      // Stop on first failure
      if (!result.success) {
        console.error('Migration failed. Stopping migration process.');
        break;
      }
    }

    const successful = results.filter((r) => r.success).length;
    console.log(`\n✓ Applied ${successful}/${pending.length} migration(s)`);

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

    console.log('\n=== Database Migration Status ===\n');
    console.log(`Current version: ${status.currentVersion}`);
    console.log(`Applied migrations: ${status.appliedCount}`);
    console.log(`Pending migrations: ${status.pendingCount}`);

    if (status.applied.length > 0) {
      console.log('\n✓ Applied:');
      for (const migration of status.applied) {
        console.log(
          `  ${migration.version}. ${migration.description} (${migration.appliedAt?.toISOString()})`,
        );
      }
    }

    if (status.pending.length > 0) {
      console.log('\n⧗ Pending:');
      for (const migration of status.pending) {
        console.log(`  ${migration.version}. ${migration.description}`);
      }
    }

    console.log('');
  }
}

/**
 * CLI entry point for running migrations
 */
export async function runMigrationsCLI(): Promise<void> {
  const command = process.argv[2] || 'migrate';
  const runner = new MigrationRunner();

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
        console.log('Usage: migrate [command]');
        console.log('Commands:');
        console.log('  migrate, up  Run pending migrations (default)');
        console.log('  status       Show migration status');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}
