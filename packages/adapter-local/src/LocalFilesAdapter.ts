/**
 * Local Files Adapter
 *
 * Uses Node.js file system for file storage
 */

import { randomUUID } from 'node:crypto';
import { constants, promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { FileMetadata, FileUploadOptions, FilesAdapter } from '@wukong/agent';

export interface LocalFilesAdapterConfig {
  /**
   * Base directory for file storage
   * @default './data/files'
   */
  basePath: string;

  /**
   * Base URL for generating file URLs
   * @default 'file://'
   */
  baseUrl?: string;
}

export class LocalFilesAdapter implements FilesAdapter {
  private basePath: string;
  private baseUrl: string;
  private metadataCache: Map<string, FileMetadata> = new Map();

  constructor(config: LocalFilesAdapterConfig) {
    this.basePath = path.resolve(config.basePath);
    this.baseUrl = config.baseUrl || 'file://';

    // Ensure base directory exists
    this.ensureBaseDirectory();
  }

  // ==========================================
  // File Operations
  // ==========================================

  async upload(
    filePath: string,
    content: Buffer | string | Blob,
    options?: FileUploadOptions,
  ): Promise<{ url: string; metadata: FileMetadata }> {
    const fullPath = this.getFullPath(filePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Convert content to buffer
    let buffer: Buffer;
    if (Buffer.isBuffer(content)) {
      buffer = content;
    } else if (typeof content === 'string') {
      buffer = Buffer.from(content, 'utf-8');
    } else {
      // Blob
      buffer = Buffer.from(await content.arrayBuffer());
    }

    // Write file
    await fs.writeFile(fullPath, buffer);

    // Create metadata
    const stats = await fs.stat(fullPath);
    const metadata: FileMetadata = {
      name: path.basename(filePath),
      size: stats.size,
      contentType: options?.contentType || this.guessContentType(filePath),
      uploadedAt: stats.mtime,
      ...(options?.metadata || {}),
    };

    // Save metadata
    await this.saveMetadata(filePath, metadata);

    // Generate URL
    const url = this.generateUrl(filePath);

    return { url, metadata };
  }

  async download(filePath: string): Promise<{ content: Buffer; metadata: FileMetadata }> {
    const fullPath = this.getFullPath(filePath);

    // Check if file exists
    try {
      await fs.access(fullPath, constants.R_OK);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read file
    const content = await fs.readFile(fullPath);

    // Get metadata
    const metadata = await this.getMetadata(filePath);
    if (!metadata) {
      // Create metadata from file stats
      const stats = await fs.stat(fullPath);
      const metadata: FileMetadata = {
        name: path.basename(filePath),
        size: stats.size,
        contentType: this.guessContentType(filePath),
        uploadedAt: stats.mtime,
      };

      await this.saveMetadata(filePath, metadata);
      return { content, metadata };
    }

    return { content, metadata };
  }

  async getMetadata(filePath: string): Promise<FileMetadata | null> {
    // Check cache first
    const cached = this.metadataCache.get(filePath);
    if (cached) {
      return cached;
    }

    // Try to read metadata file
    const metadataPath = this.getMetadataPath(filePath);

    try {
      const data = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(data) as FileMetadata;

      // Parse uploadedAt as Date
      metadata.uploadedAt = new Date(metadata.uploadedAt);

      // Cache metadata
      this.metadataCache.set(filePath, metadata);

      return metadata;
    } catch {
      // Metadata file doesn't exist, create from file stats
      const fullPath = this.getFullPath(filePath);

      try {
        const stats = await fs.stat(fullPath);
        const metadata: FileMetadata = {
          name: path.basename(filePath),
          size: stats.size,
          contentType: this.guessContentType(filePath),
          uploadedAt: stats.mtime,
        };

        await this.saveMetadata(filePath, metadata);
        return metadata;
      } catch {
        return null;
      }
    }
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = this.getFullPath(filePath);

    // Delete file
    try {
      await fs.unlink(fullPath);
    } catch {
      // File might not exist, ignore error
    }

    // Delete metadata
    const metadataPath = this.getMetadataPath(filePath);
    try {
      await fs.unlink(metadataPath);
    } catch {
      // Metadata might not exist, ignore error
    }

    // Remove from cache
    this.metadataCache.delete(filePath);
  }

  async list(prefix: string): Promise<Array<{ path: string; metadata: FileMetadata }>> {
    const prefixPath = this.getFullPath(prefix);
    const results: Array<{ path: string; metadata: FileMetadata }> = [];

    try {
      // Check if prefix is a directory
      const stats = await fs.stat(prefixPath);

      if (stats.isDirectory()) {
        // List all files in directory recursively
        await this.listDirectory(prefixPath, this.basePath, results);
      } else {
        // Single file
        const relativePath = path.relative(this.basePath, prefixPath);
        const metadata = await this.getMetadata(relativePath);
        if (metadata) {
          results.push({ path: relativePath, metadata });
        }
      }
    } catch {
      // Directory/file doesn't exist, return empty array
    }

    return results;
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(filePath);

    try {
      await fs.access(fullPath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    const sourceFullPath = this.getFullPath(sourcePath);
    const destFullPath = this.getFullPath(destinationPath);

    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destFullPath), { recursive: true });

    // Copy file
    await fs.copyFile(sourceFullPath, destFullPath);

    // Copy metadata
    const metadata = await this.getMetadata(sourcePath);
    if (metadata) {
      await this.saveMetadata(destinationPath, metadata);
    }
  }

  async move(sourcePath: string, destinationPath: string): Promise<void> {
    const sourceFullPath = this.getFullPath(sourcePath);
    const destFullPath = this.getFullPath(destinationPath);

    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destFullPath), { recursive: true });

    // Move file
    await fs.rename(sourceFullPath, destFullPath);

    // Move metadata
    const sourceMetadataPath = this.getMetadataPath(sourcePath);
    const destMetadataPath = this.getMetadataPath(destinationPath);

    try {
      await fs.rename(sourceMetadataPath, destMetadataPath);
    } catch {
      // Metadata might not exist, ignore error
    }

    // Update cache
    const metadata = this.metadataCache.get(sourcePath);
    if (metadata) {
      this.metadataCache.delete(sourcePath);
      this.metadataCache.set(destinationPath, metadata);
    }
  }

  getSignedUrl(filePath: string, expiresIn: number): Promise<string> {
    // For local files, we generate a simple token-based URL
    // This is a basic implementation and not cryptographically secure
    // For production use, consider implementing proper signed URLs

    const token = randomUUID();
    const expiresAt = Date.now() + expiresIn * 1000;

    // Store token (in a real implementation, this would be in a database or cache)
    // For now, we just return the regular URL with a token parameter
    const url = this.generateUrl(filePath);
    return Promise.resolve(`${url}?token=${token}&expires=${expiresAt}`);
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  /**
   * Get full file system path
   */
  private getFullPath(filePath: string): string {
    // Ensure path is relative and doesn't escape base directory
    const normalized = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    return path.join(this.basePath, normalized);
  }

  /**
   * Get metadata file path
   */
  private getMetadataPath(filePath: string): string {
    const fullPath = this.getFullPath(filePath);
    return `${fullPath}.metadata.json`;
  }

  /**
   * Generate file URL
   */
  private generateUrl(filePath: string): string {
    if (this.baseUrl === 'file://') {
      const fullPath = this.getFullPath(filePath);
      return `file://${fullPath}`;
    }

    // Remove leading slash if present
    const normalizedPath = filePath.replace(/^\//, '');
    return `${this.baseUrl}/${normalizedPath}`;
  }

  /**
   * Guess content type from file extension
   */
  private guessContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Save metadata to file
   */
  private async saveMetadata(filePath: string, metadata: FileMetadata): Promise<void> {
    const metadataPath = this.getMetadataPath(filePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(metadataPath), { recursive: true });

    // Write metadata
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    // Cache metadata
    this.metadataCache.set(filePath, metadata);
  }

  /**
   * List directory recursively
   */
  private async listDirectory(
    dirPath: string,
    basePath: string,
    results: Array<{ path: string; metadata: FileMetadata }>,
  ): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively list subdirectory
        await this.listDirectory(fullPath, basePath, results);
      } else if (entry.isFile() && !entry.name.endsWith('.metadata.json')) {
        // Add file to results
        const relativePath = path.relative(basePath, fullPath);
        const metadata = await this.getMetadata(relativePath);

        if (metadata) {
          results.push({ path: relativePath, metadata });
        }
      }
    }
  }

  /**
   * Ensure base directory exists
   */
  private async ensureBaseDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (_error) {
      throw new Error(`Failed to create base directory: ${this.basePath}`);
    }
  }

  /**
   * Cleanup resources
   */
  close(): void {
    this.metadataCache.clear();
  }
}
