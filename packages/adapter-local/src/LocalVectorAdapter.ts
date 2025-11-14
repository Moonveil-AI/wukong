/**
 * Local Vector Adapter
 *
 * Vector storage and search using SQLite with BLOB storage
 * Note: This is a basic implementation. For production, consider using sqlite-vss extension.
 */

import type {
  Vector,
  VectorAdapter,
  VectorMetadata,
  VectorSearchFilters,
  VectorSearchOptions,
  VectorSearchResult,
  VectorUpsertOptions,
} from '@wukong/agent';
import type Database from 'better-sqlite3';

export interface LocalVectorAdapterConfig {
  /**
   * SQLite database instance
   */
  db: Database.Database;

  /**
   * Vector dimensions (default: 1536 for OpenAI ada-002)
   */
  dimensions?: number;
}

/**
 * Local Vector Adapter
 *
 * Uses SQLite with BLOB storage for vectors
 * Performs similarity search in application layer (not optimized for large datasets)
 *
 * For production vector search with SQLite, consider:
 * - sqlite-vss extension: https://github.com/asg017/sqlite-vss
 * - External vector service (Pinecone, Weaviate, etc.)
 */
export class LocalVectorAdapter implements VectorAdapter {
  private db: Database.Database;
  private dimensions: number;

  constructor(config: LocalVectorAdapterConfig) {
    this.db = config.db;
    this.dimensions = config.dimensions || 1536;
  }

  /**
   * Upsert a vector
   */
  // biome-ignore lint/suspicious/useAwait: SQLite operations are synchronous but interface requires async
  async upsert(id: string, vector: Vector, options: VectorUpsertOptions): Promise<void> {
    const { metadata, update = true } = options;

    // Convert vector to BLOB (Float32Array for efficient storage)
    const vectorBlob = this.vectorToBlob(vector);

    const stmt = this.db.prepare(`
      INSERT INTO knowledge_entities (
        entity_id, content, embedding, level, user_id, organization_id,
        source_session_id, category, tags, metadata, session_time,
        is_indexed, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
      ${
        update
          ? `
        ON CONFLICT (entity_id) DO UPDATE SET
          content = excluded.content,
          embedding = excluded.embedding,
          level = excluded.level,
          user_id = excluded.user_id,
          organization_id = excluded.organization_id,
          category = excluded.category,
          tags = excluded.tags,
          metadata = excluded.metadata,
          is_indexed = 1,
          updated_at = datetime('now')
      `
          : ''
      }
    `);

    stmt.run(
      id,
      metadata.content,
      vectorBlob,
      metadata.level,
      metadata.userId || null,
      metadata.organizationId || null,
      metadata.sessionId || null,
      (metadata as any).category || null,
      (metadata as any).tags ? JSON.stringify((metadata as any).tags) : null,
      JSON.stringify(metadata),
      (metadata as any).sessionTime?.toISOString() || null,
      metadata.createdAt.toISOString(),
    );
  }

  /**
   * Batch upsert vectors
   */
  async batchUpsert(
    vectors: Array<{ id: string; vector: Vector; options: VectorUpsertOptions }>,
  ): Promise<void> {
    if (vectors.length === 0) return;

    // Use a transaction for better performance
    const insert = this.db.transaction(() => {
      for (const v of vectors) {
        this.upsert(v.id, v.vector, v.options);
      }
    });

    insert();
  }

  /**
   * Search for similar vectors
   *
   * Note: This performs in-memory cosine similarity search.
   * Performance degrades with large datasets (>10k vectors).
   * For production, use sqlite-vss or external vector service.
   */
  async search(queryVector: Vector, options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    const { topK = 5, minScore = 0, filters = {}, includeVectors = false } = options || {};

    // Build WHERE clause for filters
    const conditions = ['is_indexed = 1', 'is_to_remove = 0'];
    const params: any[] = [];

    if (filters.level) {
      conditions.push('level = ?');
      params.push(filters.level);
    }

    if (filters.userId) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }

    if (filters.organizationId) {
      conditions.push('organization_id = ?');
      params.push(filters.organizationId);
    }

    if (filters.sessionId) {
      conditions.push('source_session_id = ?');
      params.push(filters.sessionId);
    }

    const whereClause = conditions.join(' AND ');

    // Get all matching vectors
    const stmt = this.db.prepare(`
      SELECT 
        entity_id,
        content,
        embedding,
        level,
        user_id,
        organization_id,
        source_session_id,
        category,
        tags,
        metadata,
        session_time,
        created_at
      FROM knowledge_entities
      WHERE ${whereClause}
    `);

    const rows = stmt.all(...params);

    // Calculate cosine similarity for each vector
    const results = rows
      .map((row: any) => {
        const vector = this.blobToVector(row.embedding);
        const similarity = this.cosineSimilarity(queryVector, vector);

        const parsedMetadata = row.metadata ? JSON.parse(row.metadata) : {};
        return {
          id: row.entity_id,
          score: similarity,
          vector: includeVectors ? vector : undefined,
          metadata: {
            content: row.content,
            level: row.level,
            userId: row.user_id,
            organizationId: row.organization_id,
            sessionId: row.source_session_id,
            createdAt: new Date(row.created_at),
            ...parsedMetadata,
            category: row.category,
            tags: row.tags ? JSON.parse(row.tags) : undefined,
            sessionTime: row.session_time ? new Date(row.session_time) : undefined,
          } as VectorMetadata,
        };
      })
      .filter((result) => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }

  /**
   * Get a vector by ID
   */
  // biome-ignore lint/suspicious/useAwait: SQLite operations are synchronous but interface requires async
  async get(id: string): Promise<{ vector: Vector; metadata: VectorMetadata } | null> {
    const stmt = this.db.prepare(`
      SELECT 
        entity_id,
        content,
        embedding,
        level,
        user_id,
        organization_id,
        source_session_id,
        category,
        tags,
        metadata,
        session_time,
        created_at
      FROM knowledge_entities
      WHERE entity_id = ? AND is_indexed = 1 AND is_to_remove = 0
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    const parsedMetadata = row.metadata ? JSON.parse(row.metadata) : {};
    return {
      vector: this.blobToVector(row.embedding),
      metadata: {
        content: row.content,
        level: row.level,
        userId: row.user_id,
        organizationId: row.organization_id,
        sessionId: row.source_session_id,
        createdAt: new Date(row.created_at),
        ...parsedMetadata,
        category: row.category,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        sessionTime: row.session_time ? new Date(row.session_time) : undefined,
      } as VectorMetadata,
    };
  }

  /**
   * Delete a vector
   */
  // biome-ignore lint/suspicious/useAwait: SQLite operations are synchronous but interface requires async
  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE knowledge_entities
      SET is_to_remove = 1, updated_at = datetime('now')
      WHERE entity_id = ?
    `);

    stmt.run(id);
  }

  /**
   * Delete multiple vectors
   */
  async batchDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE knowledge_entities
      SET is_to_remove = 1, updated_at = datetime('now')
      WHERE entity_id IN (${placeholders})
    `);

    stmt.run(...ids);
  }

  /**
   * Delete vectors matching filters
   */
  // biome-ignore lint/suspicious/useAwait: SQLite operations are synchronous but interface requires async
  async deleteByFilter(filters: VectorSearchFilters): Promise<number> {
    const conditions = [];
    const params: any[] = [];

    if (filters.level) {
      conditions.push('level = ?');
      params.push(filters.level);
    }

    if (filters.userId) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }

    if (filters.organizationId) {
      conditions.push('organization_id = ?');
      params.push(filters.organizationId);
    }

    if (filters.sessionId) {
      conditions.push('source_session_id = ?');
      params.push(filters.sessionId);
    }

    if (conditions.length === 0) {
      throw new Error('At least one filter must be provided');
    }

    const whereClause = conditions.join(' AND ');

    const stmt = this.db.prepare(`
      UPDATE knowledge_entities
      SET is_to_remove = 1, updated_at = datetime('now')
      WHERE ${whereClause}
    `);

    const result = stmt.run(...params);
    return result.changes;
  }

  /**
   * Update vector metadata
   */
  // biome-ignore lint/suspicious/useAwait: SQLite operations are synchronous but interface requires async
  async updateMetadata(id: string, metadata: Partial<VectorMetadata>): Promise<void> {
    const updates = [];
    const values: any[] = [];

    if (metadata.content !== undefined) {
      updates.push('content = ?');
      values.push(metadata.content);
    }

    if (metadata.level !== undefined) {
      updates.push('level = ?');
      values.push(metadata.level);
    }

    if (metadata.userId !== undefined) {
      updates.push('user_id = ?');
      values.push(metadata.userId);
    }

    if (metadata.organizationId !== undefined) {
      updates.push('organization_id = ?');
      values.push(metadata.organizationId);
    }

    if ((metadata as any).category !== undefined) {
      updates.push('category = ?');
      values.push((metadata as any).category);
    }

    if ((metadata as any).tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify((metadata as any).tags));
    }

    if (updates.length === 0) return;

    // Add metadata update
    updates.push('metadata = ?');
    values.push(JSON.stringify(metadata));

    updates.push("updated_at = datetime('now')");

    const stmt = this.db.prepare(`
      UPDATE knowledge_entities
      SET ${updates.join(', ')}
      WHERE entity_id = ?
    `);

    stmt.run(...values, id);
  }

  /**
   * List all vector IDs (paginated)
   */
  async listIds(options?: { limit?: number; offset?: number }): Promise<{
    ids: string[];
    total: number;
  }> {
    const { limit = 100, offset = 0 } = options || {};

    const stmt = this.db.prepare(`
      SELECT entity_id
      FROM knowledge_entities
      WHERE is_indexed = 1 AND is_to_remove = 0
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset);

    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total
      FROM knowledge_entities
      WHERE is_indexed = 1 AND is_to_remove = 0
    `);

    const countRow = countStmt.get() as any;

    return {
      ids: rows.map((row: any) => row.entity_id),
      total: countRow.total,
    };
  }

  /**
   * Get collection statistics
   */
  // biome-ignore lint/suspicious/useAwait: SQLite operations are synchronous but interface requires async
  async getStats(): Promise<{
    totalVectors: number;
    dimensions: number;
    indexStatus: 'ready' | 'building' | 'error';
  }> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as total
      FROM knowledge_entities
      WHERE is_indexed = 1 AND is_to_remove = 0
    `);

    const row = stmt.get() as any;

    return {
      totalVectors: row.total,
      dimensions: this.dimensions,
      indexStatus: 'ready',
    };
  }

  /**
   * Convert vector to BLOB (Float32Array for efficient storage)
   */
  private vectorToBlob(vector: Vector): Buffer {
    const float32Array = new Float32Array(vector);
    return Buffer.from(float32Array.buffer);
  }

  /**
   * Convert BLOB to vector
   */
  private blobToVector(blob: Buffer): Vector {
    const float32Array = new Float32Array(
      blob.buffer,
      blob.byteOffset,
      blob.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );
    return Array.from(float32Array);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: Vector, b: Vector): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] || 0;
      const bVal = b[i] || 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }
}
