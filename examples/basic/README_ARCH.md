# /examples/basic

Basic example demonstrating core Wukong agent functionality in a Node.js script.

<!-- SYNC: When files in this directory change, update this document. -->

## Purpose

Minimal example showing how to initialize and use a Wukong agent with local storage, demonstrating the simplest integration path.

## File Structure

| File | Role | Purpose |
|------|------|---------|
| `index.ts` | Entry | Main example script with agent initialization |
| `package.json` | Config | Dependencies and scripts |
| `tsconfig.json` | Config | TypeScript configuration |
| `env.template` | Config | Environment variable template |
| `data/` | Storage | Local SQLite database and files |
| `README.md` | Docs | Usage instructions |

## Key Features Demonstrated

- Agent initialization with local adapter
- Basic agent execution
- Event subscription
- Tool registration
- Knowledge base setup

## Running

```bash
cp env.template .env
# Edit .env with your API keys
pnpm install
pnpm dev
```

