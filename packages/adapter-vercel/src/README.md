# /packages/adapter-vercel/src

PostgreSQL-based storage adapter for production and Vercel deployments.

<!-- SYNC: When files in this directory change, update this document. -->

## Architecture

This package provides a complete implementation of Wukong's storage adapters using PostgreSQL and pgvector. It's optimized for serverless environments like Vercel and supports high-concurrency multi-user deployments.

## File Structure

| File | Role | Purpose |
|------|------|---------|
| `index.ts` | Export | Exports all adapter interfaces |
| `VercelAdapter.ts` | Entry | Main adapter factory that creates all sub-adapters |
| `VercelStorageAdapter.ts` | Core | Session, step, and checkpoint persistence |
| `VercelVectorAdapter.ts` | Core | Vector embeddings with pgvector |
| `VercelFilesAdapter.ts` | Core | File handling with Vercel Blob Storage |
| `VercelCacheAdapter.ts` | Core | Caching with Vercel KV |
| `migrations.ts` | Support | Database schema migrations |

## Key Files

### VercelAdapter.ts
- **Purpose**: Factory for all Vercel/PostgreSQL adapters
- **Exports**: `VercelAdapter` class
- **Dependencies**: `@vercel/postgres`, `@vercel/blob`, `@vercel/kv`

### VercelStorageAdapter.ts
- **Purpose**: PostgreSQL-based session and step storage
- **Exports**: `VercelStorageAdapter` class
- **Database Tables**: sessions, steps, checkpoints
- **Features**: Connection pooling, transaction support

### VercelVectorAdapter.ts
- **Purpose**: pgvector-based semantic search
- **Exports**: `VercelVectorAdapter` class
- **Database Extension**: pgvector
- **Features**: High-performance vector similarity search

### VercelFilesAdapter.ts
- **Purpose**: Vercel Blob Storage integration
- **Exports**: `VercelFilesAdapter` class
- **Storage**: Vercel Blob for file uploads

### VercelCacheAdapter.ts
- **Purpose**: Vercel KV-based caching
- **Exports**: `VercelCacheAdapter` class
- **Storage**: Redis-compatible Vercel KV

## Database Schema

See `../migrations/` directory for PostgreSQL schema:
- Includes pgvector extension for vector operations
- Optimized indexes for high-concurrency access
- Transaction support for consistency

