-- ============================================================================
-- Migration 004: Knowledge Base (SQLite)
-- Description: Knowledge management with vector search
-- Note: SQLite stores vectors as BLOB or TEXT (JSON array)
-- ============================================================================

-- Knowledge entities table
CREATE TABLE knowledge_entities (
  -- Primary identification
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT UNIQUE NOT NULL,
  
  -- Source information
  source_session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  source_type TEXT DEFAULT 'conversation',
  
  -- Knowledge content
  content TEXT NOT NULL,
  embedding BLOB,
  
  -- Classification
  level TEXT NOT NULL,
  category TEXT,
  tags TEXT,
  
  -- Quality metrics
  confidence_score REAL DEFAULT 0.5,
  usage_count INTEGER DEFAULT 0,
  last_used_at TEXT,
  
  -- Permissions
  user_id TEXT,
  organization_id TEXT,
  
  -- Sync status
  is_indexed INTEGER DEFAULT 0,
  is_to_remove INTEGER DEFAULT 0,
  index_updated_at TEXT,
  
  -- Metadata
  metadata TEXT,
  session_time TEXT,
  
  -- Audit fields
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  -- Constraints
  CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0)
);

-- Knowledge feedback table
CREATE TABLE knowledge_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  knowledge_id INTEGER NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  
  -- Feedback
  user_id TEXT NOT NULL,
  helpful INTEGER,
  accuracy_rating INTEGER,
  comment TEXT,
  
  -- Context
  session_id TEXT REFERENCES sessions(id),
  used_in_step INTEGER,
  
  -- Audit
  created_at TEXT DEFAULT (datetime('now'))
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

-- Note: Vector search in SQLite requires sqlite-vss extension or manual implementation
-- For basic implementation, we rely on application-level similarity search

-- Knowledge feedback indexes
CREATE INDEX idx_feedback_knowledge ON knowledge_feedback(knowledge_id);
CREATE INDEX idx_feedback_user ON knowledge_feedback(user_id);

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT OR IGNORE INTO schema_versions (version, description) 
VALUES (4, 'Added knowledge management tables');


