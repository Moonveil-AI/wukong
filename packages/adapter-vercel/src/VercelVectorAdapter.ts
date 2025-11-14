/**
 * Vercel Vector Adapter
 *
 * Vector storage and search using Postgres with pgvector extension
 */

import { sql } from '@vercel/postgres';
import type {
  Vector,
  VectorAdapter,
  VectorMetadata,
  VectorSearchFilters,
  VectorSearchOptions,
  VectorSearchResult,
  VectorUpsertOptions,
} from '@wukong/agent';

export interface VercelVectorAdapterConfig {
  /**
   * Postgres connection URL
   *
   * Can also be set via POSTGRES_URL environment variable
   */
  postgresUrl?: string;

  /**
   * Vector dimensions (default: 1536 for OpenAI ada-002)
   */
  dimensions?: number;
}

/**
 * Vercel Vector Adapter
 *
 * Uses Postgres with pgvector extension for vector storage and similarity search
 */
export class VercelVectorAdapter implements VectorAdapter {
  private dimensions: number;

  constructor(config: VercelVectorAdapterConfig = {}) {
    this.dimensions = config.dimensions || 1536;

    // Set connection URL if provided
    if (config.postgresUrl) {
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
      process.env['POSTGRES_URL'] = config.postgresUrl;
    }
  }

  /**
   * Upsert a vector
   */
  async upsert(id: string, vector: Vector, options: VectorUpsertOptions): Promise<void> {
    const { metadata, update = true } = options;

    // Convert vector to pgvector format
    const vectorStr = `[${vector.join(',')}]`;

    if (update) {
      // Upsert: insert or update if exists
      await sql`
        INSERT INTO knowledge_entities (
          entity_id, content, embedding, level, user_id, organization_id,
          source_session_id, category, tags, metadata, session_time,
          is_indexed, created_at, updated_at
        )
        VALUES (
          ${id}, ${metadata.content}, ${vectorStr}::vector, ${metadata.level},
          ${metadata.userId || null}, ${metadata.organizationId || null},
          ${metadata.sessionId || null}, ${(metadata as any).category || null},
          ${(metadata as any).tags ? JSON.stringify((metadata as any).tags) : null}::jsonb,
          ${JSON.stringify(metadata)}::jsonb, ${(metadata as any).sessionTime?.toISOString() || null},
          true, ${metadata.createdAt.toISOString()}, NOW()
        )
        ON CONFLICT (entity_id) DO UPDATE SET
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          level = EXCLUDED.level,
          user_id = EXCLUDED.user_id,
          organization_id = EXCLUDED.organization_id,
          category = EXCLUDED.category,
          tags = EXCLUDED.tags,
          metadata = EXCLUDED.metadata,
          is_indexed = true,
          updated_at = NOW()
      `;
    } else {
      // Insert only (will fail if exists)
      await sql`
        INSERT INTO knowledge_entities (
          entity_id, content, embedding, level, user_id, organization_id,
          source_session_id, category, tags, metadata, session_time,
          is_indexed, created_at, updated_at
        )
        VALUES (
          ${id}, ${metadata.content}, ${vectorStr}::vector, ${metadata.level},
          ${metadata.userId || null}, ${metadata.organizationId || null},
          ${metadata.sessionId || null}, ${(metadata as any).category || null},
          ${(metadata as any).tags ? JSON.stringify((metadata as any).tags) : null}::jsonb,
          ${JSON.stringify(metadata)}::jsonb, ${(metadata as any).sessionTime?.toISOString() || null},
          true, ${metadata.createdAt.toISOString()}, NOW()
        )
      `;
    }
  }

  /**
   * Batch upsert vectors
   */
  async batchUpsert(
    vectors: Array<{ id: string; vector: Vector; options: VectorUpsertOptions }>,
  ): Promise<void> {
    if (vectors.length === 0) return;

    // Insert vectors one at a time (simple but safe)
    // For production, consider using a transaction
    for (const v of vectors) {
      await this.upsert(v.id, v.vector, v.options);
    }
  }

  /**
   * Search for similar vectors
   */
  async search(queryVector: Vector, options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    const { topK = 5, minScore = 0, filters = {}, includeVectors = false } = options || {};

    // Convert query vector to pgvector format
    const vectorStr = `[${queryVector.join(',')}]`;

    // Build WHERE clause for filters
    let whereClause = 'WHERE is_indexed = true AND is_to_remove = false';
    const params: any[] = [vectorStr];

    if (filters.level) {
      params.push(filters.level);
      whereClause += ` AND level = $${params.length}`;
    }

    if (filters.userId) {
      params.push(filters.userId);
      whereClause += ` AND user_id = $${params.length}`;
    }

    if (filters.organizationId) {
      params.push(filters.organizationId);
      whereClause += ` AND organization_id = $${params.length}`;
    }

    if (filters.sessionId) {
      params.push(filters.sessionId);
      whereClause += ` AND source_session_id = $${params.length}`;
    }

    // Build the query using sql.query to allow dynamic WHERE clause
    const query = `
      SELECT 
        entity_id,
        content,
        level,
        user_id,
        organization_id,
        source_session_id,
        category,
        tags,
        metadata,
        session_time,
        created_at,
        ${includeVectors ? 'embedding,' : ''}
        1 - (embedding <=> $1::vector) as similarity
      FROM knowledge_entities
      ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT ${topK}
    `;

    const result = await sql.query(query, params);

    // Filter by minimum score and map to results
    return result.rows
      .filter((row: any) => row.similarity >= minScore)
      .map((row: any) => ({
        id: row.entity_id,
        score: row.similarity,
        vector: includeVectors && row.embedding ? this.parseVector(row.embedding) : undefined,
        metadata: {
          content: row.content,
          level: row.level,
          userId: row.user_id,
          organizationId: row.organization_id,
          sessionId: row.source_session_id,
          category: row.category,
          tags: row.tags,
          createdAt: new Date(row.created_at),
          sessionTime: row.session_time ? new Date(row.session_time) : undefined,
          ...row.metadata,
        },
      }));
  }

  /**
   * Get a vector by ID
   */
  async get(id: string): Promise<{ vector: Vector; metadata: VectorMetadata } | null> {
    const result = await sql`
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
      WHERE entity_id = ${id} AND is_indexed = true AND is_to_remove = false
    `;

    if (result.rows.length === 0) return null;

    const row: any = result.rows[0];
    return {
      vector: this.parseVector(row.embedding),
      metadata: {
        content: row.content,
        level: row.level,
        userId: row.user_id,
        organizationId: row.organization_id,
        sessionId: row.source_session_id,
        category: row.category,
        tags: row.tags,
        createdAt: new Date(row.created_at),
        sessionTime: row.session_time ? new Date(row.session_time) : undefined,
        ...row.metadata,
      },
    };
  }

  /**
   * Delete a vector
   */
  async delete(id: string): Promise<void> {
    await sql`
      UPDATE knowledge_entities
      SET is_to_remove = true, updated_at = NOW()
      WHERE entity_id = ${id}
    `;
  }

  /**
   * Delete multiple vectors
   */
  async batchDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    // Use parameterized query for array
    await sql.query(
      `UPDATE knowledge_entities
       SET is_to_remove = true, updated_at = NOW()
       WHERE entity_id = ANY($1)`,
      [ids],
    );
  }

  /**
   * Delete vectors matching filters
   */
  async deleteByFilter(filters: VectorSearchFilters): Promise<number> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.level) {
      params.push(filters.level);
      whereClause += ` AND level = $${params.length}`;
    }

    if (filters.userId) {
      params.push(filters.userId);
      whereClause += ` AND user_id = $${params.length}`;
    }

    if (filters.organizationId) {
      params.push(filters.organizationId);
      whereClause += ` AND organization_id = $${params.length}`;
    }

    if (filters.sessionId) {
      params.push(filters.sessionId);
      whereClause += ` AND source_session_id = $${params.length}`;
    }

    if (params.length === 0) {
      throw new Error('At least one filter must be provided');
    }

    const result = await sql.query(
      `UPDATE knowledge_entities
       SET is_to_remove = true, updated_at = NOW()
       ${whereClause}
       RETURNING entity_id`,
      params,
    );

    return result.rowCount || 0;
  }

  /**
   * Update vector metadata
   */
  async updateMetadata(id: string, metadata: Partial<VectorMetadata>): Promise<void> {
    const updates = [];
    const values: any[] = [];

    if (metadata.content !== undefined) {
      values.push(metadata.content);
      updates.push(`content = $${values.length}`);
    }

    if (metadata.level !== undefined) {
      values.push(metadata.level);
      updates.push(`level = $${values.length}`);
    }

    if (metadata.userId !== undefined) {
      values.push(metadata.userId);
      updates.push(`user_id = $${values.length}`);
    }

    if (metadata.organizationId !== undefined) {
      values.push(metadata.organizationId);
      updates.push(`organization_id = $${values.length}`);
    }

    if ((metadata as any).category !== undefined) {
      values.push((metadata as any).category);
      updates.push(`category = $${values.length}`);
    }

    if ((metadata as any).tags !== undefined) {
      values.push(JSON.stringify((metadata as any).tags));
      updates.push(`tags = $${values.length}`);
    }

    if (updates.length === 0) return;

    // Add metadata update
    values.push(JSON.stringify(metadata));
    updates.push(`metadata = $${values.length}`);
    updates.push('updated_at = NOW()');

    values.push(id);
    const query = `
      UPDATE knowledge_entities
      SET ${updates.join(', ')}
      WHERE entity_id = $${values.length}
    `;

    await sql.query(query, values);
  }

  /**
   * List all vector IDs (paginated)
   */
  async listIds(options?: { limit?: number; offset?: number }): Promise<{
    ids: string[];
    total: number;
  }> {
    const { limit = 100, offset = 0 } = options || {};

    const result = await sql`
      SELECT entity_id
      FROM knowledge_entities
      WHERE is_indexed = true AND is_to_remove = false
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM knowledge_entities
      WHERE is_indexed = true AND is_to_remove = false
    `;

    return {
      ids: result.rows.map((row: any) => row.entity_id),
      total: Number.parseInt(String((countResult.rows[0] as any).total), 10),
    };
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{
    totalVectors: number;
    dimensions: number;
    indexStatus: 'ready' | 'building' | 'error';
  }> {
    const result = await sql`
      SELECT COUNT(*) as total
      FROM knowledge_entities
      WHERE is_indexed = true AND is_to_remove = false
    `;

    return {
      totalVectors: Number.parseInt(String((result.rows[0] as any).total), 10),
      dimensions: this.dimensions,
      indexStatus: 'ready', // pgvector indexes are automatically maintained
    };
  }

  /**
   * Parse vector from pgvector format
   */
  private parseVector(vector: any): Vector {
    if (typeof vector === 'string') {
      // Parse string format: "[1,2,3]"
      return JSON.parse(vector);
    }
    if (Array.isArray(vector)) {
      return vector;
    }
    throw new Error('Invalid vector format');
  }
}
