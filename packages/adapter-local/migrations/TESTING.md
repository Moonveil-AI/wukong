# Testing Migrations

## Prerequisites

The migration tests require `better-sqlite3` which has native dependencies that need to be compiled for your platform.

### Installation

Make sure you have the required build tools installed:

**Windows:**
```bash
npm install --global windows-build-tools
# Or use Visual Studio with C++ build tools
```

**macOS:**
```bash
xcode-select --install
```

**Linux:**
```bash
sudo apt-get install build-essential
# or equivalent for your distro
```

Then rebuild the native modules:
```bash
cd packages/adapter-local
pnpm rebuild better-sqlite3
```

### Running Tests

```bash
# From project root
pnpm test packages/adapter-local

# Or from package directory
cd packages/adapter-local
pnpm test
```

## Manual Testing

You can also test migrations manually without running the test suite:

```bash
# Run migrations on a test database
cd packages/adapter-local
pnpm migrate

# Check migration status
pnpm migrate:status
```

## CI/CD

For CI/CD environments, ensure the build tools are available:

```yaml
# Example GitHub Actions
- name: Install dependencies
  run: |
    pnpm install
    pnpm -r rebuild
```


