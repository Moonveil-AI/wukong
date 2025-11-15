-- Migration 005: Step Compression Support
-- Add compressed_content column to steps table for token optimization

-- Add compressed_content column to steps table if it doesn't exist
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- We need to check manually in the migration runner or handle the error
-- For now, we rely on the schema_versions table to prevent re-running

-- Add compressed_content column to steps table
ALTER TABLE steps ADD COLUMN compressed_content TEXT;

-- Create index for faster queries on compressed steps
CREATE INDEX IF NOT EXISTS idx_steps_compressed ON steps(compressed_content) WHERE compressed_content IS NOT NULL;

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT OR IGNORE INTO schema_versions (version, description) 
VALUES (5, 'Step compression support');

