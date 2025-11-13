/**
 * Vercel Blob Adapter
 *
 * Uses Vercel Blob for file storage
 */

import { copy as blobCopy, del, head, list, put } from '@vercel/blob';
import type { FileMetadata, FileUploadOptions, FilesAdapter } from '@wukong/agent';

export interface VercelBlobAdapterConfig {
  /**
   * Blob read/write token
   * Usually from process.env.BLOB_READ_WRITE_TOKEN
   */
  token?: string;
}

export class VercelBlobAdapter implements FilesAdapter {
  constructor(private config: VercelBlobAdapterConfig = {}) {
    // Connection is handled automatically by @vercel/blob
    // It uses environment variable BLOB_READ_WRITE_TOKEN
  }

  // ==========================================
  // File Operations
  // ==========================================

  async upload(
    path: string,
    content: Buffer | string | Blob,
    options?: FileUploadOptions,
  ): Promise<{ url: string; metadata: FileMetadata }> {
    const blob = await put(path, content, {
      access: (options?.public ? 'public' : 'public') as 'public',
      contentType: options?.contentType,
      cacheControlMaxAge: options?.cacheControl
        ? this.parseCacheControl(options.cacheControl)
        : undefined,
      addRandomSuffix: false,
      token: this.config.token,
    });

    // Get content size
    const size =
      content instanceof Buffer
        ? content.length
        : typeof content === 'string'
          ? Buffer.byteLength(content)
          : 0;

    const metadata: FileMetadata = {
      name: this.getFileName(path),
      size: size,
      contentType: options?.contentType || 'application/octet-stream',
      uploadedAt: new Date(),
      ...(options?.metadata || {}),
    };

    return {
      url: blob.url,
      metadata,
    };
  }

  async download(path: string): Promise<{ content: Buffer; metadata: FileMetadata }> {
    // Vercel Blob requires fetching the URL
    const metadata = await this.getMetadata(path);
    if (!metadata) {
      throw new Error(`File not found: ${path}`);
    }

    // Get the blob URL
    const blobInfo = await head(path, { token: this.config.token });

    // Fetch the content
    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const content = Buffer.from(arrayBuffer);

    return {
      content,
      metadata,
    };
  }

  async getMetadata(path: string): Promise<FileMetadata | null> {
    try {
      const blob = await head(path, { token: this.config.token });

      return {
        name: this.getFileName(path),
        size: blob.size,
        contentType: blob.contentType,
        uploadedAt: blob.uploadedAt,
      };
    } catch (error: any) {
      // If blob doesn't exist, return null
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async delete(path: string): Promise<void> {
    await del(path, { token: this.config.token });
  }

  async list(prefix: string): Promise<Array<{ path: string; metadata: FileMetadata }>> {
    const { blobs } = await list({
      prefix,
      token: this.config.token,
    });

    return blobs.map((blob) => ({
      path: blob.pathname,
      metadata: {
        name: this.getFileName(blob.pathname),
        size: blob.size,
        contentType: 'application/octet-stream', // Vercel Blob list API doesn't return contentType
        uploadedAt: blob.uploadedAt,
      },
    }));
  }

  async exists(path: string): Promise<boolean> {
    const metadata = await this.getMetadata(path);
    return metadata !== null;
  }

  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    // Vercel Blob supports copy
    await blobCopy(sourcePath, destinationPath, {
      access: 'public',
      token: this.config.token,
    });
  }

  async move(sourcePath: string, destinationPath: string): Promise<void> {
    // Move is copy + delete
    await this.copy(sourcePath, destinationPath);
    await this.delete(sourcePath);
  }

  async getSignedUrl(path: string, _expiresIn: number): Promise<string> {
    // Vercel Blob doesn't have explicit signed URL support
    // But we can use head to get the URL which has built-in access control
    const blob = await head(path, { token: this.config.token });

    // The returned URL from Vercel Blob already includes authentication
    // For more security, you might want to implement a custom signed URL system
    return blob.url;
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private getFileName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  }

  private parseCacheControl(cacheControl: string): number {
    // Parse "max-age=3600" format
    const match = cacheControl.match(/max-age=(\d+)/);
    if (match?.[1]) {
      return Number.parseInt(match[1], 10);
    }
    return 3600; // Default to 1 hour
  }
}
