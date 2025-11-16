/**
 * Tests for SQLite Migration Runner
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MigrationRunner } from '../migrations.js';

const TEST_DB_DIR = './test-data';
const TEST_DB_PATH = join(TEST_DB_DIR, 'test-migrations.db');

describe('MigrationRunner - SQLite', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DB_DIR)) {
      mkdirSync(TEST_DB_DIR, { recursive: true });
    }

    // Remove test database if it exists
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
  });

  afterEach(() => {
    // Clean up test database
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
  });

  it('should initialize with version 0 on empty database', async () => {
    const runner = new MigrationRunner(TEST_DB_PATH);
    const version = await runner.getCurrentVersion();

    expect(version).toBe(0);
  });

  it('should find all available migrations', async () => {
    const runner = new MigrationRunner(TEST_DB_PATH);
    const available = await runner.getAvailableMigrations();

    expect(available.length).toBeGreaterThanOrEqual(5);
    expect(available[0].version).toBe(1);
    expect(available[0].description).toContain('initial schema');
  });

  it('should run all pending migrations', async () => {
    const runner = new MigrationRunner(TEST_DB_PATH);

    // Initially all migrations should be pending
    const pendingBefore = await runner.getPendingMigrations();
    expect(pendingBefore.length).toBeGreaterThanOrEqual(5);

    // Run migrations
    const results = await runner.migrate();
    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(results.every((r) => r.success)).toBe(true);

    // After migration, no pending migrations
    const pendingAfter = await runner.getPendingMigrations();
    expect(pendingAfter.length).toBe(0);

    // Version should be updated
    const version = await runner.getCurrentVersion();
    expect(version).toBeGreaterThanOrEqual(5);
  });

  it('should create all tables correctly', async () => {
    const runner = new MigrationRunner(TEST_DB_PATH);
    await runner.migrate();

    const db = new Database(TEST_DB_PATH);

    try {
      // Check that all tables exist
      const tables = db
        .prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name
      `)
        .all() as Array<{ name: string }>;

      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain('schema_versions');
      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('steps');
      expect(tableNames).toContain('todos');
      expect(tableNames).toContain('checkpoints');
      expect(tableNames).toContain('parallel_tool_calls');
      expect(tableNames).toContain('fork_agent_tasks');
      expect(tableNames).toContain('knowledge_entities');
      expect(tableNames).toContain('knowledge_feedback');
    } finally {
      db.close();
    }
  });

  it('should track applied migrations in schema_versions', async () => {
    const runner = new MigrationRunner(TEST_DB_PATH);
    await runner.migrate();

    const applied = await runner.getAppliedMigrations();
    expect(applied.length).toBeGreaterThanOrEqual(5);
    expect(applied[0].version).toBe(1);
    expect(applied[0].appliedAt).toBeDefined();
  });

  it('should not re-run already applied migrations', async () => {
    const runner = new MigrationRunner(TEST_DB_PATH);

    // Run migrations first time
    const results1 = await runner.migrate();
    expect(results1.length).toBeGreaterThanOrEqual(5);

    // Run migrations second time (should be no-op)
    const results2 = await runner.migrate();
    expect(results2.length).toBe(0);
  });

  it('should provide accurate status', async () => {
    const runner = new MigrationRunner(TEST_DB_PATH);

    // Before migration
    const statusBefore = await runner.status();
    expect(statusBefore.currentVersion).toBe(0);
    expect(statusBefore.appliedCount).toBe(0);
    expect(statusBefore.pendingCount).toBeGreaterThanOrEqual(5);

    // After migration
    await runner.migrate();
    const statusAfter = await runner.status();
    expect(statusAfter.currentVersion).toBeGreaterThanOrEqual(5);
    expect(statusAfter.appliedCount).toBeGreaterThanOrEqual(5);
    expect(statusAfter.pendingCount).toBe(0);
  });

  it('should create indexes on tables', async () => {
    const runner = new MigrationRunner(TEST_DB_PATH);
    await runner.migrate();

    const db = new Database(TEST_DB_PATH);

    try {
      // Check that indexes exist
      const indexes = db
        .prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
        ORDER BY name
      `)
        .all() as Array<{ name: string }>;

      const indexNames = indexes.map((i) => i.name);

      // Should have multiple indexes
      expect(indexNames.length).toBeGreaterThan(10);

      // Check for some specific indexes
      expect(indexNames).toContain('idx_sessions_user_id');
      expect(indexNames).toContain('idx_steps_session_id');
      expect(indexNames).toContain('idx_todos_session_id');
    } finally {
      db.close();
    }
  });

  it('should support foreign key constraints', async () => {
    const runner = new MigrationRunner(TEST_DB_PATH);
    await runner.migrate();

    const db = new Database(TEST_DB_PATH);

    try {
      // Enable foreign keys
      db.pragma('foreign_keys = ON');

      // Insert a session
      db.prepare(`
        INSERT INTO sessions (id, goal)
        VALUES ('test-session', 'Test goal')
      `).run();

      // Try to insert a step with invalid session_id (should fail)
      expect(() => {
        db.prepare(`
          INSERT INTO steps (session_id, step_number, action)
          VALUES ('invalid-session', 1, 'CallTool')
        `).run();
      }).toThrow();

      // Insert step with valid session_id (should succeed)
      db.prepare(`
        INSERT INTO steps (session_id, step_number, action)
        VALUES ('test-session', 1, 'CallTool')
      `).run();

      const step = db.prepare('SELECT * FROM steps WHERE session_id = ?').get('test-session');
      expect(step).toBeDefined();
    } finally {
      db.close();
    }
  });
});
