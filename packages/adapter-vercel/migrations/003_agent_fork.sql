-- ============================================================================
-- Migration 003: Agent Fork
-- Description: Support for agent forking and sub-agents
-- ============================================================================

-- Fork agent tasks table
CREATE TABLE fork_agent_tasks (
  -- Primary identification
  id VARCHAR(255) PRIMARY KEY,
  
  -- Parent relationship
  parent_session_id VARCHAR(255) NOT NULL REFERENCES sessions(id),
  parent_step_id INTEGER REFERENCES steps(id),
  
  -- Sub-agent information
  sub_session_id VARCHAR(255) REFERENCES sessions(id),
  goal TEXT NOT NULL,
  context_summary TEXT,
  depth INTEGER NOT NULL,
  
  -- Execution configuration
  max_steps INTEGER DEFAULT 20,
  timeout_seconds INTEGER DEFAULT 300,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending',
  result_summary TEXT,
  error_message TEXT,
  
  -- Resource tracking
  steps_executed INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  tools_called INTEGER DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  execution_duration_ms INTEGER,
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX idx_fork_tasks_parent_session ON fork_agent_tasks(parent_session_id);
CREATE INDEX idx_fork_tasks_sub_session ON fork_agent_tasks(sub_session_id);
CREATE INDEX idx_fork_tasks_status ON fork_agent_tasks(status);
CREATE INDEX idx_fork_tasks_depth ON fork_agent_tasks(depth);

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT INTO schema_versions (version, description) 
VALUES (3, 'Added Agent Fork support')
ON CONFLICT (version) DO NOTHING;

