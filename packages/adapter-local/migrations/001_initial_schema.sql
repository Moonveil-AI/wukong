-- ============================================================================
-- Migration 001: Initial Schema (SQLite)
-- Description: Core tables for sessions, steps, todos, and checkpoints
-- ============================================================================

-- Schema versions table for migration tracking
CREATE TABLE IF NOT EXISTS schema_versions (
  version INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Sessions table: stores agent session information
CREATE TABLE sessions (
  -- Primary identification
  id TEXT PRIMARY KEY,
  
  -- Goal and status
  goal TEXT NOT NULL,
  initial_goal TEXT,
  status TEXT DEFAULT 'active',
  
  -- User identification
  user_id TEXT,
  api_key TEXT,
  organization_id TEXT,
  
  -- Agent configuration
  agent_type TEXT DEFAULT 'InteractiveAgent',
  auto_run INTEGER DEFAULT 0,
  tools_config TEXT,
  
  -- Agent Fork support
  parent_session_id TEXT REFERENCES sessions(id),
  depth INTEGER DEFAULT 0,
  inherited_context TEXT,
  result_summary TEXT,
  is_sub_agent INTEGER DEFAULT 0,
  
  -- History compression
  last_compressed_step_id INTEGER DEFAULT -1,
  compressed_summary TEXT,
  is_compressing INTEGER DEFAULT 0,
  compressing_started_at TEXT,
  
  -- Execution control
  is_running INTEGER DEFAULT 1,
  is_deleted INTEGER DEFAULT 0,
  
  -- Knowledge extraction
  last_knowledge_extraction_at TEXT,
  
  -- Sharing
  share_secret_key TEXT UNIQUE,
  
  -- Audit fields
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  -- Constraints
  CHECK (depth >= 0 AND depth <= 10)
);

-- Steps table: stores individual execution steps
CREATE TABLE steps (
  -- Primary identification
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  
  -- LLM interaction
  llm_prompt TEXT,
  llm_response TEXT,
  
  -- Agent decision
  action TEXT NOT NULL,
  reasoning TEXT,
  selected_tool TEXT,
  parameters TEXT,
  
  -- Execution result
  step_result TEXT,
  error_message TEXT,
  
  -- Status and control
  status TEXT DEFAULT 'pending',
  discarded INTEGER DEFAULT 0,
  
  -- Parallel execution support
  is_parallel INTEGER DEFAULT 0,
  wait_strategy TEXT,
  parallel_status TEXT,
  
  -- Timing
  started_at TEXT,
  completed_at TEXT,
  execution_duration_ms INTEGER,
  
  -- Audit fields
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  -- Constraints
  UNIQUE(session_id, step_number),
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout'))
);

-- Todos table: tracks task decomposition and progress
CREATE TABLE todos (
  -- Primary identification
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Todo information
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  
  -- Status and dependencies
  status TEXT DEFAULT 'pending',
  dependencies TEXT,
  priority INTEGER DEFAULT 0,
  
  -- Estimation and tracking
  estimated_steps INTEGER,
  actual_steps INTEGER DEFAULT 0,
  estimated_tokens INTEGER,
  actual_tokens INTEGER DEFAULT 0,
  
  -- Results
  result TEXT,
  error TEXT,
  
  -- Timing
  started_at TEXT,
  completed_at TEXT,
  duration_seconds INTEGER,
  
  -- Audit fields
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Checkpoints table: stores session snapshots
CREATE TABLE checkpoints (
  -- Primary identification
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Checkpoint information
  name TEXT,
  description TEXT,
  checkpoint_type TEXT,
  
  -- Snapshot data
  session_state TEXT NOT NULL,
  step_number INTEGER,
  
  -- Audit fields
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Sessions indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_parent_session_id ON sessions(parent_session_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_is_running ON sessions(is_running);
CREATE INDEX idx_sessions_depth ON sessions(depth);
CREATE INDEX idx_sessions_share_key ON sessions(share_secret_key) WHERE share_secret_key IS NOT NULL;
CREATE INDEX idx_sessions_user_updated ON sessions(user_id, updated_at) WHERE is_deleted = 0;

-- Steps indexes
CREATE INDEX idx_steps_session_id ON steps(session_id);
CREATE INDEX idx_steps_status ON steps(status);
CREATE INDEX idx_steps_is_parallel ON steps(is_parallel);
CREATE INDEX idx_steps_discarded ON steps(discarded);
CREATE INDEX idx_steps_action ON steps(action);
CREATE INDEX idx_steps_session_active ON steps(session_id, step_number) WHERE discarded = 0;

-- Todos indexes
CREATE INDEX idx_todos_session_id ON todos(session_id);
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_order ON todos(session_id, order_index);

-- Checkpoints indexes
CREATE INDEX idx_checkpoints_session_id ON checkpoints(session_id);
CREATE INDEX idx_checkpoints_created_at ON checkpoints(created_at);

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT OR IGNORE INTO schema_versions (version, description) 
VALUES (1, 'Initial schema with core tables');


