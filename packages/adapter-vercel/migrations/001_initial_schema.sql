-- ============================================================================
-- Migration 001: Initial Schema
-- Description: Core tables for sessions, steps, todos, and checkpoints
-- ============================================================================

-- Enable pgvector extension (required for knowledge embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Schema versions table for migration tracking
CREATE TABLE IF NOT EXISTS schema_versions (
  version INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Sessions table: stores agent session information
CREATE TABLE sessions (
  -- Primary identification
  id VARCHAR(255) PRIMARY KEY,
  
  -- Goal and status
  goal TEXT NOT NULL,
  initial_goal TEXT,
  status VARCHAR(50) DEFAULT 'active',
  
  -- User identification
  user_id VARCHAR(255),
  api_key VARCHAR(255),
  organization_id VARCHAR(255),
  
  -- Agent configuration
  agent_type VARCHAR(100) DEFAULT 'InteractiveAgent',
  auto_run BOOLEAN DEFAULT false,
  tools_config JSONB,
  
  -- Agent Fork support
  parent_session_id VARCHAR(255) REFERENCES sessions(id),
  depth INTEGER DEFAULT 0,
  inherited_context TEXT,
  result_summary TEXT,
  is_sub_agent BOOLEAN DEFAULT false,
  
  -- History compression
  last_compressed_step_id INTEGER DEFAULT -1,
  compressed_summary TEXT,
  is_compressing BOOLEAN DEFAULT false,
  compressing_started_at TIMESTAMP WITH TIME ZONE,
  
  -- Execution control
  is_running BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  
  -- Knowledge extraction
  last_knowledge_extraction_at TIMESTAMP WITH TIME ZONE,
  
  -- Sharing
  share_secret_key VARCHAR(255) UNIQUE,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_session_depth CHECK (depth >= 0 AND depth <= 10)
);

-- Steps table: stores individual execution steps
CREATE TABLE steps (
  -- Primary identification
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  
  -- LLM interaction
  llm_prompt TEXT,
  llm_response TEXT,
  
  -- Agent decision
  action VARCHAR(100) NOT NULL,
  reasoning TEXT,
  selected_tool VARCHAR(255),
  parameters JSONB,
  
  -- Execution result
  step_result TEXT,
  error_message TEXT,
  
  -- Status and control
  status VARCHAR(50) DEFAULT 'pending',
  discarded BOOLEAN DEFAULT FALSE,
  
  -- Parallel execution support
  is_parallel BOOLEAN DEFAULT FALSE,
  wait_strategy VARCHAR(50),
  parallel_status VARCHAR(50),
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  execution_duration_ms INTEGER,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(session_id, step_number),
  CONSTRAINT chk_step_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout'))
);

-- Todos table: tracks task decomposition and progress
CREATE TABLE todos (
  -- Primary identification
  id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Todo information
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  
  -- Status and dependencies
  status VARCHAR(50) DEFAULT 'pending',
  dependencies JSONB,
  priority INTEGER DEFAULT 0,
  
  -- Estimation and tracking
  estimated_steps INTEGER,
  actual_steps INTEGER DEFAULT 0,
  estimated_tokens INTEGER,
  actual_tokens INTEGER DEFAULT 0,
  
  -- Results
  result JSONB,
  error TEXT,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Checkpoints table: stores session snapshots
CREATE TABLE checkpoints (
  -- Primary identification
  id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Checkpoint information
  name VARCHAR(255),
  description TEXT,
  checkpoint_type VARCHAR(50),
  
  -- Snapshot data
  session_state JSONB NOT NULL,
  step_number INTEGER,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
CREATE INDEX idx_sessions_user_updated ON sessions(user_id, updated_at DESC) WHERE is_deleted = FALSE;

-- Steps indexes
CREATE INDEX idx_steps_session_id ON steps(session_id);
CREATE INDEX idx_steps_status ON steps(status);
CREATE INDEX idx_steps_is_parallel ON steps(is_parallel);
CREATE INDEX idx_steps_discarded ON steps(discarded);
CREATE INDEX idx_steps_action ON steps(action);
CREATE INDEX idx_steps_session_active ON steps(session_id, step_number) WHERE discarded = FALSE;

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

INSERT INTO schema_versions (version, description) 
VALUES (1, 'Initial schema with core tables')
ON CONFLICT (version) DO NOTHING;


