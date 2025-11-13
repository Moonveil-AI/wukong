/**
 * @wukong/adapter-vercel - Vercel Storage Adapter
 * @description Vercel Postgres + KV + Blob adapter for Wukong
 */

// Export migration utilities
export { MigrationRunner, type MigrationInfo, type MigrationResult } from './migrations.js';

// Export individual adapters
export { VercelStorageAdapter, type VercelStorageAdapterConfig } from './VercelStorageAdapter.js';
export { VercelCacheAdapter, type VercelCacheAdapterConfig } from './VercelCacheAdapter.js';
export { VercelBlobAdapter, type VercelBlobAdapterConfig } from './VercelBlobAdapter.js';

// Export combined adapter (recommended)
export { VercelAdapter, type VercelAdapterConfig } from './VercelAdapter.js';

// Default export
export { VercelAdapter as default } from './VercelAdapter.js';

export const version = '0.1.0';
