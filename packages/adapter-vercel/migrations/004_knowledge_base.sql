-- ============================================================================
-- Migration 004: Knowledge Base
-- Description: Knowledge management with vector search
-- ============================================================================

-- Knowledge entities table
CREATE TABLE knowledge_entities (
  -- Primary identification
  id SERIAL PRIMARY KEY,
  entity_id VARCHAR(255) UNIQUE NOT NULL,
  
  -- Source information
  source_session_id VARCHAR(255) REFERENCES sessions(id) ON DELETE SET NULL,
  source_type VARCHAR(50) DEFAULT 'conversation',
  
  -- Knowledge content
  content TEXT NOT NULL,
  embedding vector(1536),
  
  -- Classification
  level VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  tags JSONB,
  
  -- Quality metrics
  confidence_score FLOAT DEFAULT 0.5,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Permissions
  user_id VARCHAR(255),
  organization_id VARCHAR(255),
  
  -- Sync status
  is_indexed BOOLEAN DEFAULT FALSE,
  is_to_remove BOOLEAN DEFAULT FALSE,
  index_updated_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB,
  session_time TIMESTAMP WITH TIME ZONE,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_knowledge_confidence CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0)
);

-- Knowledge feedback table
CREATE TABLE knowledge_feedback (
  id SERIAL PRIMARY KEY,
  knowledge_id INTEGER NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  
  -- Feedback
  user_id VARCHAR(255) NOT NULL,
  helpful BOOLEAN,
  accuracy_rating INTEGER,
  comment TEXT,
  
  -- Context
  session_id VARCHAR(255) REFERENCES sessions(id),
  used_in_step INTEGER,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Knowledge entities indexes
CREATE INDEX idx_knowledge_entity_id ON knowledge_entities(entity_id);
CREATE INDEX idx_knowledge_session ON knowledge_entities(source_session_id);
CREATE INDEX idx_knowledge_level ON knowledge_entities(level);
CREATE INDEX idx_knowledge_user ON knowledge_entities(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_knowledge_org ON knowledge_entities(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_knowledge_indexed ON knowledge_entities(is_indexed);
CREATE INDEX idx_knowledge_to_remove ON knowledge_entities(is_to_remove);

-- Vector indexes (using ivfflat for pgvector)
CREATE INDEX idx_knowledge_embedding ON knowledge_entities 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_knowledge_public_embedding ON knowledge_entities 
  USING ivfflat (embedding vector_cosine_ops)
  WHERE level = 'public' AND is_indexed = TRUE AND is_to_remove = FALSE;

CREATE INDEX idx_knowledge_org_embedding ON knowledge_entities 
  USING ivfflat (embedding vector_cosine_ops)
  WHERE level = 'organization' AND is_indexed = TRUE AND is_to_remove = FALSE;

-- Knowledge feedback indexes
CREATE INDEX idx_feedback_knowledge ON knowledge_feedback(knowledge_id);
CREATE INDEX idx_feedback_user ON knowledge_feedback(user_id);

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_versions (version, description) 
VALUES (4, 'Added knowledge management tables')
ON CONFLICT (version) DO NOTHING;

