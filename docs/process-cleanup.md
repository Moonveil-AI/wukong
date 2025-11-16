# Process Cleanup Guide

## Overview

This guide explains how to handle orphaned node/vite processes that may remain after stopping development servers on macOS.

## Quick Solution

```bash
# Interactive cleanup (recommended)
pnpm clean:processes

# Force cleanup (no confirmation)
pnpm clean:processes:force
```

## Background

Running `pnpm dev` in the monorepo starts multiple processes in parallel:
- 9 packages running `tsup --watch` (TypeScript compiler in watch mode)
- 1 UI example running `vite` (development server)
- Total: ~10 node processes

When you press Ctrl+C, pnpm may not terminate all child processes properly, leaving them orphaned.

## What Was Fixed

### 1. Vitest Configuration (`vitest.config.ts`)

Added proper timeout and cleanup settings:

```typescript
{
  testTimeout: 30000,      // Test timeout
  hookTimeout: 10000,      // Hook timeout
  pool: 'forks',          // Process isolation
  teardownTimeout: 5000   // Cleanup timeout
}
```

### 2. Database Connection Handling (`migrations.test.ts`)

All database operations now use `try-finally` blocks to ensure connections are closed:

```typescript
const db = new Database(TEST_DB_PATH);
try {
  // ... database operations ...
} finally {
  db.close();
}
```

### 3. Process Cleanup Script (`scripts/cleanup-processes.sh`)

A bash script that:
- Finds all wukong-related node/vite processes
- Displays process details
- Gracefully terminates processes (SIGTERM)
- Force kills if necessary (SIGKILL)
- Verifies cleanup completion

## Usage

### Typical Workflow

```bash
# Start development
pnpm dev

# ... do your work ...

# Stop with Ctrl+C

# Clean up orphaned processes
pnpm clean:processes
```

### Script Options

```bash
# Show help
bash scripts/cleanup-processes.sh --help

# Interactive mode (default)
pnpm clean:processes

# Force mode (no confirmation)
pnpm clean:processes:force
```

### Manual Cleanup

If needed, you can manually clean up processes:

```bash
# View all node processes
ps aux | grep -E "node|vite" | grep -v grep

# Kill by pattern
pkill -f wukong

# Force kill
pkill -9 -f wukong

# Kill by port
lsof -ti:3000 | xargs kill
```

## Best Practices

1. **Use single package development** when possible:
   ```bash
   cd packages/agent
   pnpm dev
   ```

2. **Run cleanup regularly** to avoid resource accumulation

3. **Check for orphaned processes** after stopping development servers

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for detailed troubleshooting steps.

## Related Files

- `vitest.config.ts` - Test configuration
- `scripts/cleanup-processes.sh` - Cleanup script
- `packages/adapter-local/src/__tests__/migrations.test.ts` - Database tests
- `package.json` - Commands configuration

