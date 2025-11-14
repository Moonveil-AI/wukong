/**
 * @wukong/adapter-local - Local Storage Adapter
 * @description SQLite + file system adapter for Wukong
 */

// Export migration utilities
export { MigrationRunner, type MigrationInfo, type MigrationResult } from './migrations.js';

// Export adapters
export { LocalStorageAdapter, type LocalStorageAdapterConfig } from './LocalStorageAdapter.js';
export { LocalCacheAdapter } from './LocalCacheAdapter.js';
export { LocalFilesAdapter, type LocalFilesAdapterConfig } from './LocalFilesAdapter.js';
export { LocalVectorAdapter, type LocalVectorAdapterConfig } from './LocalVectorAdapter.js';
export { LocalAdapter, type LocalAdapterConfig } from './LocalAdapter.js';

export const version = '0.1.0';

export default {
  version,
};
