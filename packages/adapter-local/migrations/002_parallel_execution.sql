-- ============================================================================
-- Migration 002: Parallel Execution (SQLite)
-- Description: Support for parallel tool execution
-- ============================================================================

-- Parallel tool calls table
CREATE TABLE parallel_tool_calls (
  -- Primary identification
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  
  -- Tool identification
  tool_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  parameters TEXT NOT NULL,
  
  -- Execution status
  status TEXT DEFAULT 'pending',
  result TEXT,
  error_message TEXT,
  
  -- Progress tracking
  progress_percentage INTEGER DEFAULT 0,
  status_message TEXT,
  
  -- External API tracking (for async tools)
  external_task_id TEXT,
  external_status TEXT,
  
  -- Timing
  started_at TEXT,
  completed_at TEXT,
  execution_duration_ms INTEGER,
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Audit fields
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  -- Constraints
  UNIQUE(step_id, tool_id),
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout'))
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX idx_parallel_calls_step_id ON parallel_tool_calls(step_id);
CREATE INDEX idx_parallel_calls_status ON parallel_tool_calls(status);
CREATE INDEX idx_parallel_calls_tool_id ON parallel_tool_calls(tool_id);
CREATE INDEX idx_parallel_calls_external_task ON parallel_tool_calls(external_task_id) WHERE external_task_id IS NOT NULL;
CREATE INDEX idx_parallel_status_count ON parallel_tool_calls(step_id, status);

-- ============================================================================
-- Record Migration
-- ============================================================================

INSERT OR IGNORE INTO schema_versions (version, description) 
VALUES (2, 'Added parallel execution support');

