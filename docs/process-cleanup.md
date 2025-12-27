# Process Cleanup Guide

## Overview

This guide explains how to handle orphaned node/vite processes that may remain after stopping development servers on macOS.

## Quick Solution

### Automatic Cleanup (Recommended)

**Vitest workers are now automatically cleaned up after tests!**

```bash
pnpm test  # Automatically runs cleanup after completion
```

### Manual Cleanup

```bash
# Clean up vitest worker processes manually
pnpm clean:vitest

# Clean up all wukong processes (dev servers + vitest)
pnpm clean:processes

# Force cleanup all processes (no confirmation)
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

**Note**: Despite these settings, vitest worker processes may still remain after tests complete, especially if tests run into memory issues or timeouts.

### 2. Vitest Worker Cleanup Script (`scripts/cleanup-processes.sh --vitest-only`)

The cleanup script with `--vitest-only` flag:
- Finds only vitest worker processes (pattern: `node.*(vitest`)
- Does NOT affect development servers
- Automatically confirms (no prompt needed)
- Gracefully terminates processes (SIGTERM)
- Force kills if necessary (SIGKILL)
- Safe to run anytime after tests

**Auto-run**: This mode automatically runs after `pnpm test` via the `posttest` hook.

### 3. Database Connection Handling (`migrations.test.ts`)

All database operations now use `try-finally` blocks to ensure connections are closed:

```typescript
const db = new Database(TEST_DB_PATH);
try {
  // ... database operations ...
} finally {
  db.close();
}
```

### 4. Process Cleanup Script (`scripts/cleanup-processes.sh`)

A bash script that:
- Finds all wukong-related node/vite/vitest processes
- Displays process details
- Gracefully terminates processes (SIGTERM)
- Force kills if necessary (SIGKILL)
- Verifies cleanup completion

**Warning**: This kills ALL wukong processes including development servers. Use `pnpm clean:vitest` for safer cleanup.

## Usage

### Typical Workflow

```bash
# Start development
pnpm dev

# ... do your work ...

# Run tests (vitest workers auto-cleanup after completion)
pnpm test

# Stop development with Ctrl+C

# If dev servers don't stop, clean up all processes
pnpm clean:processes
```

### Watch Mode

For test watch mode, cleanup doesn't run automatically (to avoid interrupting):

```bash
# Watch mode - no auto cleanup
pnpm test:watch

# Manually cleanup when needed
pnpm clean:vitest
```

### Script Options

```bash
# Clean vitest workers only (recommended)
pnpm clean:vitest
# or: bash scripts/cleanup-processes.sh --vitest-only

# Show help for full cleanup
bash scripts/cleanup-processes.sh --help

# Interactive mode for full cleanup
pnpm clean:processes
# or: bash scripts/cleanup-processes.sh

# Force mode for full cleanup (no confirmation)
pnpm clean:processes:force
# or: bash scripts/cleanup-processes.sh --force
```

### Manual Cleanup

If needed, you can manually clean up processes:

```bash
# View all node processes
ps aux | grep -E "node|vite|vitest" | grep -v grep

# Kill by pattern (wukong processes)
pkill -f wukong

# Kill vitest specifically
pkill -f vitest

# Force kill
pkill -9 -f wukong
pkill -9 -f vitest

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
- `scripts/cleanup-processes.sh` - **Unified cleanup script with multiple modes**
  - `--vitest-only` flag for safe vitest cleanup (auto-run after tests)
  - Default mode for full cleanup (interactive)
  - `--force` flag for non-interactive full cleanup
- `packages/adapter-local/src/__tests__/migrations.test.ts` - Database tests
- `package.json` - Commands configuration

