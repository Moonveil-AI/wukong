-- Migration 005: Step Compression Support
-- Add compressed_content column to steps table for token optimization

-- Add compressed_content column to steps table
ALTER TABLE steps ADD COLUMN compressed_content TEXT;

-- Create index for faster queries on compressed steps
CREATE INDEX IF NOT EXISTS idx_steps_compressed ON steps(compressed_content) WHERE compressed_content IS NOT NULL;

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_versions (version, description) 
VALUES (5, 'Step compression support')
ON CONFLICT (version) DO NOTHING;

