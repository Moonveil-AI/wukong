# /packages/adapter-local/src

SQLite-based local storage adapter for development and single-user deployments.

<!-- SYNC: When files in this directory change, update this document. -->

## Architecture

This package provides a complete implementation of Wukong's storage adapters using SQLite via better-sqlite3. It includes session management, vector storage, file handling, and caching.

## File Structure

| File | Role | Purpose |
|------|------|---------|
| `index.ts` | Export | Exports all adapter interfaces |
| `LocalAdapter.ts` | Entry | Main adapter factory that creates all sub-adapters |
| `LocalStorageAdapter.ts` | Core | Session, step, and checkpoint persistence |
| `LocalVectorAdapter.ts` | Core | Vector embeddings storage and similarity search |
| `LocalFilesAdapter.ts` | Core | File upload/download handling |
| `LocalCacheAdapter.ts` | Core | Caching layer for knowledge and tool results |
| `migrations.ts` | Support | Database schema migrations |
| `cli/migrate.ts` | Tool | CLI tool for running migrations |

## Key Files

### LocalAdapter.ts
- **Purpose**: Factory that initializes and provides all storage sub-adapters
- **Exports**: `LocalAdapter` class
- **Dependencies**: All sub-adapter implementations

### LocalStorageAdapter.ts
- **Purpose**: Implements session, step, and checkpoint CRUD operations
- **Exports**: `LocalStorageAdapter` class
- **Database Tables**: sessions, steps, checkpoints

### LocalVectorAdapter.ts
- **Purpose**: Vector embeddings storage with cosine similarity search
- **Exports**: `LocalVectorAdapter` class
- **Database Tables**: knowledge_base
- **Features**: Vector similarity search, embedding storage

### LocalFilesAdapter.ts
- **Purpose**: Handles file uploads, downloads, and metadata
- **Exports**: `LocalFilesAdapter` class
- **Storage**: Filesystem-based with database metadata

### LocalCacheAdapter.ts
- **Purpose**: Caching layer for frequently accessed data
- **Exports**: `LocalCacheAdapter` class
- **Database Tables**: cache

### migrations.ts
- **Purpose**: Manages database schema versioning and migrations
- **Exports**: `runMigrations()` function
- **Migration Files**: Located in `../migrations/*.sql`

## Database Schema

See `../migrations/` directory for complete schema definitions:
- 001_initial_schema.sql - Base tables
- 002_parallel_execution.sql - Parallel tool execution support
- 003_agent_fork.sql - Agent forking support
- 004_knowledge_base.sql - Knowledge base and vector storage
- 005_step_compression.sql - Step compression for token optimization

