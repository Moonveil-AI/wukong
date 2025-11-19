# Database Migrations - Vercel Postgres

This directory contains SQL migration files for the Wukong Agent system using Vercel Postgres.

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
4. **004_knowledge_base.sql** - Knowledge management with vector search

## Running Migrations

### Using npm/pnpm scripts (recommended):

```bash
# Run all pending migrations
pnpm migrate

# Check migration status
pnpm migrate:status
```

### Using the CLI directly:

```bash
# Run pending migrations
tsx src/cli/migrate.ts migrate

# Show status
tsx src/cli/migrate.ts status
```

### Programmatically:

```typescript
import { MigrationRunner } from '@wukong/adapter-vercel';

const runner = new MigrationRunner();

// Run migrations
await runner.migrate();

// Check status
const status = await runner.status();
console.log(`Current version: ${status.currentVersion}`);
```

## Environment Variables

Make sure you have the following environment variables set:

```bash
POSTGRES_URL=postgres://...
# Or
POSTGRES_PRISMA_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...
```

## Creating New Migrations

1. Create a new SQL file with the next version number:
   ```
   005_my_new_feature.sql
   ```

2. Write your migration SQL:
   ```sql
   -- Add your schema changes here
   ALTER TABLE sessions ADD COLUMN new_field TEXT;
   
   -- Update the schema_versions table
   INSERT INTO schema_versions (version, description) 
   VALUES (5, 'Added new feature');
   ```

3. Test the migration:
   ```bash
   pnpm migrate:status  # Should show 1 pending migration
   pnpm migrate         # Run the migration
   ```

## Migration Best Practices

1. **Always use transactions** - PostgreSQL migrations should be atomic
2. **Test rollback scenarios** - Ensure you can recover from failures
3. **Include indexes** - Create necessary indexes for performance
4. **Add constraints** - Use CHECK, FOREIGN KEY, and UNIQUE constraints
5. **Document changes** - Add comments explaining complex migrations
6. **Never modify existing migrations** - Always create new migration files

## Troubleshooting

### Migration Failed

If a migration fails:

1. Check the error message for SQL syntax errors
2. Verify all referenced tables and columns exist
3. Check for constraint violations
4. Manually fix the database if needed
5. Re-run the migration

### Schema Out of Sync

If your schema gets out of sync:

1. Check current version: `pnpm migrate:status`
2. Compare with migration files
3. Manually apply missing changes if needed
4. Update `schema_versions` table to reflect current state

## Schema Version Tracking

The `schema_versions` table tracks which migrations have been applied:

```sql
SELECT * FROM schema_versions ORDER BY version;
```

This table is automatically created by the first migration (001_initial_schema.sql).


