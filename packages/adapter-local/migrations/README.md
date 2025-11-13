# Database Migrations - SQLite (Local)

This directory contains SQL migration files for the Wukong Agent system using SQLite.

## Migration Files

Migrations are numbered sequentially and should be named using the pattern:

```
NNN_descriptive_name.sql
```

Where `NNN` is a zero-padded 3-digit version number (e.g., `001`, `002`, etc.)

### Current Migrations

1. **001_initial_schema.sql** - Core tables (sessions, steps, todos, checkpoints)
2. **002_parallel_execution.sql** - Parallel tool execution support
3. **003_agent_fork.sql** - Agent forking and sub-agents
4. **004_knowledge_base.sql** - Knowledge management (vectors as BLOB)

## Running Migrations

### Using npm/pnpm scripts (recommended):

```bash
# Run all pending migrations (default path: ./data/wukong.db)
pnpm migrate

# Check migration status
pnpm migrate:status
```

### Using the CLI directly:

```bash
# Run pending migrations with custom database path
tsx src/cli/migrate.ts migrate ./path/to/database.db

# Show status
tsx src/cli/migrate.ts status ./path/to/database.db
```

### Programmatically:

```typescript
import { MigrationRunner } from '@wukong/adapter-local';

const runner = new MigrationRunner('./data/wukong.db');

// Run migrations
await runner.migrate();

// Check status
const status = await runner.status();
console.log(`Current version: ${status.currentVersion}`);
```

## SQLite Differences from Postgres

SQLite has some limitations compared to PostgreSQL:

1. **No SERIAL type** - Uses `INTEGER PRIMARY KEY AUTOINCREMENT`
2. **No TIMESTAMP WITH TIME ZONE** - Uses `TEXT` with ISO 8601 format
3. **No JSONB** - Uses `TEXT` to store JSON strings
4. **No vector type** - Uses `BLOB` for embeddings
5. **Limited ALTER TABLE** - Some changes require table recreation
6. **Boolean as INTEGER** - `0` = false, `1` = true

## Creating New Migrations

1. Create a new SQL file with the next version number:
   ```
   005_my_new_feature.sql
   ```

2. Write your migration SQL (SQLite syntax):
   ```sql
   -- Add your schema changes here
   ALTER TABLE sessions ADD COLUMN new_field TEXT;
   
   -- Update the schema_versions table
   INSERT OR IGNORE INTO schema_versions (version, description) 
   VALUES (5, 'Added new feature');
   ```

3. Test the migration:
   ```bash
   pnpm migrate:status  # Should show 1 pending migration
   pnpm migrate         # Run the migration
   ```

## Migration Best Practices

1. **Use transactions** - Wrap changes in BEGIN/COMMIT
2. **Use INSERT OR IGNORE** - For idempotent migrations
3. **Test with fresh database** - Ensure migrations work from scratch
4. **Handle booleans correctly** - Use INTEGER (0/1) not BOOLEAN
5. **Store JSON as TEXT** - Parse/stringify when reading/writing
6. **Use TEXT for timestamps** - Format as ISO 8601 strings

## Vector Storage

SQLite doesn't have native vector support like pgvector. Embeddings are stored as:

- **BLOB** - For binary storage of float arrays
- **TEXT** - Alternative: JSON array of numbers

For production vector search with SQLite, consider:

- [sqlite-vss](https://github.com/asg017/sqlite-vss) - Vector similarity search extension
- Application-level similarity search
- Hybrid approach: SQLite for metadata, external service for vectors

## Troubleshooting

### Migration Failed

If a migration fails:

1. Check the error message for SQL syntax errors
2. Verify SQLite compatibility (no PostgreSQL-specific syntax)
3. Check for constraint violations
4. The migration is rolled back automatically
5. Fix the SQL and re-run

### Database Locked

If you get "database is locked" errors:

1. Close all connections to the database
2. Check for long-running queries
3. Disable write-ahead logging if needed: `PRAGMA journal_mode=DELETE;`
4. Use shorter transactions

### Schema Out of Sync

If your schema gets out of sync:

1. Check current version: `pnpm migrate:status ./data/wukong.db`
2. Compare with migration files
3. Manually apply missing changes if needed
4. Update `schema_versions` table to reflect current state

## Schema Version Tracking

The `schema_versions` table tracks which migrations have been applied:

```sql
SELECT * FROM schema_versions ORDER BY version;
```

This table is automatically created by the first migration (001_initial_schema.sql).

## Database Location

By default, migrations expect the database at:

```
./data/wukong.db
```

You can specify a custom path:

```bash
tsx src/cli/migrate.ts migrate ./custom/path/mydb.db
```

