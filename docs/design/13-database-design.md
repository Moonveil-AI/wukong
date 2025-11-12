# Database Design

Comprehensive database schema for the Wukong Agent system, supporting all features including Agent Fork, parallel execution, and knowledge management.

## Table of Contents
- [Overview](#overview)
- [Core Tables](#core-tables)
- [Parallel Execution Tables](#parallel-execution-tables)
- [Knowledge Management Tables](#knowledge-management-tables)
- [Indexes and Performance](#indexes-and-performance)
- [Relationships Diagram](#relationships-diagram)

---

## Overview

### Database Requirements

- **Vercel Postgres** (recommended) or any PostgreSQL-compatible database
- **pgvector extension** for vector search
- Support for JSONB for flexible parameter storage
- Transaction support for data consistency

### Design Principles

1. **Referential Integrity**: Foreign keys ensure data consistency
2. **Flexible Parameters**: JSONB for tool parameters and metadata
3. **Audit Trail**: Created/updated timestamps on all tables
4. **Soft Deletes**: Mark as deleted rather than hard delete
5. **Efficient Queries**: Indexes on commonly queried fields

---

## Core Tables

### sessions Table

Stores Agent session information including conversation state and hierarchy.

```sql
CREATE TABLE sessions (
  -- Primary identification
  id VARCHAR(255) PRIMARY KEY,
  
  -- Goal and status
  goal TEXT NOT NULL,
  initial_goal TEXT,  -- Original goal before modifications
  status VARCHAR(50) DEFAULT 'active',  -- active, paused, completed, failed
  
  -- User identification
  user_id VARCHAR(255),
  api_key VARCHAR(255),
  organization_id VARCHAR(255),
  
  -- Agent configuration
  agent_type VARCHAR(100) DEFAULT 'InteractiveAgent',  -- InteractiveAgent or AutoAgent
  auto_run BOOLEAN DEFAULT false,
  tools_config JSONB,  -- Tool configuration for this session
  
  -- Agent Fork support
  parent_session_id VARCHAR(255) REFERENCES sessions(id),
  depth INTEGER DEFAULT 0,  -- Nesting depth (0 = root agent)
  inherited_context TEXT,  -- Compressed context from parent
  result_summary TEXT,  -- Compressed result for parent
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_parent_session_id ON sessions(parent_session_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_is_running ON sessions(is_running);
CREATE INDEX idx_sessions_depth ON sessions(depth);
CREATE INDEX idx_sessions_share_key ON sessions(share_secret_key) WHERE share_secret_key IS NOT NULL;
```

### steps Table

Stores individual execution steps within a session.

```sql
CREATE TABLE steps (
  -- Primary identification
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  
  -- LLM interaction
  llm_prompt TEXT,  -- Complete prompt sent to LLM
  llm_response TEXT,  -- Raw LLM response
  
  -- Agent decision
  action VARCHAR(100) NOT NULL,  -- CallTool, CallToolsParallel, ForkAutoAgent, AskUser, Plan, Finish
  reasoning TEXT,  -- Agent's reasoning
  selected_tool VARCHAR(255),  -- For CallTool action
  parameters JSONB,  -- Tool parameters
  
  -- Execution result
  step_result TEXT,  -- Tool execution result or outcome
  error_message TEXT,  -- Error if step failed
  
  -- Status and control
  status VARCHAR(50) DEFAULT 'pending',  -- pending, running, completed, failed
  discarded BOOLEAN DEFAULT FALSE,  -- Marked for token optimization
  
  -- Parallel execution support
  is_parallel BOOLEAN DEFAULT FALSE,
  wait_strategy VARCHAR(50),  -- all, any, majority (for parallel execution)
  parallel_status VARCHAR(50),  -- waiting, partial, completed
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  execution_duration_ms INTEGER,  -- Milliseconds
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(session_id, step_number)
);

-- Indexes
CREATE INDEX idx_steps_session_id ON steps(session_id);
CREATE INDEX idx_steps_status ON steps(status);
CREATE INDEX idx_steps_is_parallel ON steps(is_parallel);
CREATE INDEX idx_steps_discarded ON steps(discarded);
CREATE INDEX idx_steps_action ON steps(action);
```

### todos Table

Tracks task decomposition and progress.

```sql
CREATE TABLE todos (
  -- Primary identification
  id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Todo information
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,  -- Display order
  
  -- Status and dependencies
  status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed, cancelled, failed
  dependencies JSONB,  -- Array of todo IDs that must complete first
  priority INTEGER DEFAULT 0,  -- Higher = more important
  
  -- Estimation and tracking
  estimated_steps INTEGER,
  actual_steps INTEGER DEFAULT 0,
  estimated_tokens INTEGER,
  actual_tokens INTEGER DEFAULT 0,
  
  -- Results
  result JSONB,  -- Structured result data
  error TEXT,  -- Error message if failed
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_todos_session_id ON todos(session_id);
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_order ON todos(session_id, order_index);
```

### checkpoints Table

Stores session snapshots for undo/restore functionality.

```sql
CREATE TABLE checkpoints (
  -- Primary identification
  id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Checkpoint information
  name VARCHAR(255),
  description TEXT,
  checkpoint_type VARCHAR(50),  -- manual, auto, before_tool, milestone
  
  -- Snapshot data
  session_state JSONB NOT NULL,  -- Complete session state
  step_number INTEGER,  -- Step number when checkpoint was created
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_checkpoints_session_id ON checkpoints(session_id);
CREATE INDEX idx_checkpoints_created_at ON checkpoints(created_at);
```

---

## Parallel Execution Tables

### parallel_tool_calls Table

Tracks individual tool calls in parallel execution.

```sql
CREATE TABLE parallel_tool_calls (
  -- Primary identification
  id SERIAL PRIMARY KEY,
  step_id INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  
  -- Tool identification
  tool_id VARCHAR(255) NOT NULL,  -- User-defined unique identifier
  tool_name VARCHAR(255) NOT NULL,
  parameters JSONB NOT NULL,
  
  -- Execution status
  status VARCHAR(50) DEFAULT 'pending',  -- pending, running, completed, failed, timeout
  result TEXT,
  error_message TEXT,
  
  -- Progress tracking
  progress_percentage INTEGER DEFAULT 0,
  status_message TEXT,
  
  -- External API tracking (for async tools)
  external_task_id VARCHAR(255),  -- ID from external API (e.g., video generation service)
  external_status VARCHAR(100),
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  execution_duration_ms INTEGER,
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(step_id, tool_id)
);

-- Indexes
CREATE INDEX idx_parallel_calls_step_id ON parallel_tool_calls(step_id);
CREATE INDEX idx_parallel_calls_status ON parallel_tool_calls(status);
CREATE INDEX idx_parallel_calls_tool_id ON parallel_tool_calls(tool_id);
CREATE INDEX idx_parallel_calls_external_task ON parallel_tool_calls(external_task_id) WHERE external_task_id IS NOT NULL;
```

### fork_agent_tasks Table

Tracks Agent Fork tasks for sub-agent execution.

```sql
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
  status VARCHAR(50) DEFAULT 'pending',  -- pending, running, completed, failed, timeout
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

-- Indexes
CREATE INDEX idx_fork_tasks_parent_session ON fork_agent_tasks(parent_session_id);
CREATE INDEX idx_fork_tasks_sub_session ON fork_agent_tasks(sub_session_id);
CREATE INDEX idx_fork_tasks_status ON fork_agent_tasks(status);
CREATE INDEX idx_fork_tasks_depth ON fork_agent_tasks(depth);
```

---

## Knowledge Management Tables

### knowledge_entities Table

Stores extracted knowledge with embeddings for vector search.

```sql
CREATE TABLE knowledge_entities (
  -- Primary identification
  id SERIAL PRIMARY KEY,
  entity_id VARCHAR(255) UNIQUE NOT NULL,  -- UUID for Azure AI Search sync
  
  -- Source information
  source_session_id VARCHAR(255) REFERENCES sessions(id),
  source_type VARCHAR(50) DEFAULT 'conversation',  -- conversation, document, manual
  
  -- Knowledge content
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI ada-002 embedding dimension
  
  -- Classification
  level VARCHAR(50) NOT NULL,  -- public, organization, individual
  category VARCHAR(100),  -- methodology, preference, error_lesson, etc.
  tags JSONB,  -- Array of tags for categorization
  
  -- Quality metrics
  confidence_score FLOAT DEFAULT 0.5,  -- 0.0 to 1.0
  usage_count INTEGER DEFAULT 0,  -- How many times this knowledge was retrieved
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Permissions
  user_id VARCHAR(255),
  organization_id VARCHAR(255),
  
  -- Sync status
  is_indexed BOOLEAN DEFAULT FALSE,  -- Synced to Azure AI Search
  is_to_remove BOOLEAN DEFAULT FALSE,  -- Marked for deletion
  index_updated_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB,  -- Additional structured data
  session_time TIMESTAMP WITH TIME ZONE,  -- When the source conversation happened
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_knowledge_entity_id ON knowledge_entities(entity_id);
CREATE INDEX idx_knowledge_session ON knowledge_entities(source_session_id);
CREATE INDEX idx_knowledge_level ON knowledge_entities(level);
CREATE INDEX idx_knowledge_user ON knowledge_entities(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_knowledge_org ON knowledge_entities(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_knowledge_indexed ON knowledge_entities(is_indexed);
CREATE INDEX idx_knowledge_to_remove ON knowledge_entities(is_to_remove);

-- Vector index (using ivfflat for pgvector)
CREATE INDEX idx_knowledge_embedding ON knowledge_entities 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### knowledge_feedback Table

Tracks user feedback on knowledge quality.

```sql
CREATE TABLE knowledge_feedback (
  id SERIAL PRIMARY KEY,
  knowledge_id INTEGER NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  
  -- Feedback
  user_id VARCHAR(255) NOT NULL,
  helpful BOOLEAN,  -- Was this knowledge helpful?
  accuracy_rating INTEGER,  -- 1-5 stars
  comment TEXT,
  
  -- Context
  session_id VARCHAR(255) REFERENCES sessions(id),
  used_in_step INTEGER,  -- Which step used this knowledge
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_feedback_knowledge ON knowledge_feedback(knowledge_id);
CREATE INDEX idx_feedback_user ON knowledge_feedback(user_id);
```

---

## Indexes and Performance

### Query Patterns and Optimization

#### 1. Session Retrieval by User

```sql
-- Common query: Get user's recent sessions
SELECT * FROM sessions 
WHERE user_id = ? 
  AND is_deleted = FALSE 
ORDER BY updated_at DESC 
LIMIT 20;

-- Optimized with composite index
CREATE INDEX idx_sessions_user_updated 
  ON sessions(user_id, updated_at DESC) 
  WHERE is_deleted = FALSE;
```

#### 2. Step History for Session

```sql
-- Common query: Get non-discarded steps for session
SELECT * FROM steps 
WHERE session_id = ? 
  AND discarded = FALSE 
ORDER BY step_number ASC;

-- Optimized with composite index
CREATE INDEX idx_steps_session_active 
  ON steps(session_id, step_number) 
  WHERE discarded = FALSE;
```

#### 3. Parallel Tool Status Check

```sql
-- Common query: Check parallel tools status for a step
SELECT status, COUNT(*) 
FROM parallel_tool_calls 
WHERE step_id = ? 
GROUP BY status;

-- Optimized with covering index
CREATE INDEX idx_parallel_status_count 
  ON parallel_tool_calls(step_id, status);
```

#### 4. Knowledge Vector Search

```sql
-- Common query: Find similar knowledge with permissions
SELECT content, 
       1 - (embedding <=> ?::vector) as similarity
FROM knowledge_entities
WHERE (level = 'public' 
   OR (level = 'organization' AND organization_id = ?)
   OR (level = 'individual' AND user_id = ?))
  AND is_indexed = TRUE
  AND is_to_remove = FALSE
ORDER BY embedding <=> ?::vector
LIMIT 5;

-- Optimized with partial indexes
CREATE INDEX idx_knowledge_public_embedding 
  ON knowledge_entities USING ivfflat (embedding vector_cosine_ops)
  WHERE level = 'public' AND is_indexed = TRUE AND is_to_remove = FALSE;
  
CREATE INDEX idx_knowledge_org_embedding 
  ON knowledge_entities USING ivfflat (embedding vector_cosine_ops)
  WHERE level = 'organization' AND is_indexed = TRUE AND is_to_remove = FALSE;
```

---

## Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Database Relationships                      │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────┐
│  sessions              │  (Core session table)
├────────────────────────┤
│ PK: id                │
│    user_id            │
│    parent_session_id  │◄──┐ (Self-reference for Fork)
│    depth              │   │
│    status             │   │
│    is_running         │   │
└────────┬───────────────┘   │
         │                   │
         │ 1:N               │
         ↓                   │
┌────────────────────────┐   │
│  steps                 │  (Execution steps)
├────────────────────────┤   │
│ PK: id                │   │
│ FK: session_id        │───┘
│    step_number        │
│    action             │
│    is_parallel        │
│    wait_strategy      │
│    discarded          │
└────────┬───────────────┘
         │
         │ 1:N (if is_parallel)
         ↓
┌────────────────────────────┐
│ parallel_tool_calls        │  (Parallel execution tracking)
├────────────────────────────┤
│ PK: id                    │
│ FK: step_id               │
│    tool_id (unique)       │
│    tool_name              │
│    status                 │
│    result                 │
│    external_task_id       │
└────────────────────────────┘

┌────────────────────────┐
│  fork_agent_tasks      │  (Agent Fork tracking)
├────────────────────────┤
│ PK: id                │
│ FK: parent_session_id │───┐ Links to parent session
│ FK: sub_session_id    │   │
│    goal               │   │
│    context_summary    │   │
│    status             │   │
│    result_summary     │   │
└────────────────────────┘   │
                             │
                             └──> sessions (parent_session_id)

┌────────────────────────┐
│  todos                 │  (Task decomposition)
├────────────────────────┤
│ PK: id                │
│ FK: session_id        │───┐
│    title              │   │
│    status             │   │
│    dependencies       │   │  Links to session
│    order_index        │   │
└────────────────────────┘   │
                             │
                             └──> sessions

┌────────────────────────┐
│  checkpoints           │  (Undo/restore points)
├────────────────────────┤
│ PK: id                │
│ FK: session_id        │───┐
│    session_state      │   │  Links to session
│    step_number        │   │
└────────────────────────┘   │
                             │
                             └──> sessions

┌────────────────────────┐
│  knowledge_entities    │  (Knowledge base)
├────────────────────────┤
│ PK: id                │
│    entity_id          │
│ FK: source_session_id │───┐  Links to source session
│    content            │   │
│    embedding          │   │
│    level              │   │
│    user_id            │   │
│    organization_id    │   │
└────────┬───────────────┘   │
         │                   │
         │                   └──> sessions
         │ 1:N
         ↓
┌────────────────────────┐
│  knowledge_feedback    │  (Quality tracking)
├────────────────────────┤
│ PK: id                │
│ FK: knowledge_id      │
│    user_id            │
│    helpful            │
│    accuracy_rating    │
└────────────────────────┘

Key Relationships:
1. sessions 1:N steps - One session has many steps
2. sessions 1:N sessions - Parent-child fork relationship
3. steps 1:N parallel_tool_calls - One step can launch multiple parallel tools
4. sessions 1:N fork_agent_tasks - One session can fork multiple sub-agents
5. sessions 1:N todos - One session has multiple todo items
6. sessions 1:N checkpoints - One session can have multiple restore points
7. sessions 1:N knowledge_entities - One session can generate multiple knowledge pieces
8. knowledge_entities 1:N knowledge_feedback - Knowledge can have multiple feedback entries
```

---

## Data Integrity and Constraints

### Foreign Key Policies

```sql
-- Cascade delete: When session is deleted, remove all related data
ALTER TABLE steps 
  ADD CONSTRAINT fk_steps_session 
  FOREIGN KEY (session_id) REFERENCES sessions(id) 
  ON DELETE CASCADE;

ALTER TABLE todos 
  ADD CONSTRAINT fk_todos_session 
  FOREIGN KEY (session_id) REFERENCES sessions(id) 
  ON DELETE CASCADE;

ALTER TABLE checkpoints 
  ADD CONSTRAINT fk_checkpoints_session 
  FOREIGN KEY (session_id) REFERENCES sessions(id) 
  ON DELETE CASCADE;

-- Set null: When session is deleted, keep knowledge but remove link
ALTER TABLE knowledge_entities 
  ADD CONSTRAINT fk_knowledge_session 
  FOREIGN KEY (source_session_id) REFERENCES sessions(id) 
  ON DELETE SET NULL;
```

### Check Constraints

```sql
-- Ensure valid depth for forked agents
ALTER TABLE sessions 
  ADD CONSTRAINT chk_session_depth 
  CHECK (depth >= 0 AND depth <= 10);

-- Ensure valid confidence score
ALTER TABLE knowledge_entities 
  ADD CONSTRAINT chk_knowledge_confidence 
  CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0);

-- Ensure valid status transitions
ALTER TABLE steps 
  ADD CONSTRAINT chk_step_status 
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout'));

ALTER TABLE parallel_tool_calls 
  ADD CONSTRAINT chk_parallel_status 
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout'));
```

---

## Migration and Versioning

### Schema Versioning Table

```sql
CREATE TABLE schema_versions (
  version INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial version
INSERT INTO schema_versions (version, description) 
VALUES (1, 'Initial schema with core tables');

INSERT INTO schema_versions (version, description) 
VALUES (2, 'Added parallel execution support');

INSERT INTO schema_versions (version, description) 
VALUES (3, 'Added Agent Fork support');

INSERT INTO schema_versions (version, description) 
VALUES (4, 'Added knowledge management tables');
```

### Example Migration

```sql
-- Migration: Add parallel execution support
BEGIN;

-- Add new columns to steps table
ALTER TABLE steps ADD COLUMN is_parallel BOOLEAN DEFAULT FALSE;
ALTER TABLE steps ADD COLUMN wait_strategy VARCHAR(50);
ALTER TABLE steps ADD COLUMN parallel_status VARCHAR(50);

-- Create new parallel_tool_calls table
CREATE TABLE parallel_tool_calls (
  -- ... (full schema above)
);

-- Create indexes
CREATE INDEX idx_steps_is_parallel ON steps(is_parallel);
CREATE INDEX idx_parallel_calls_step_id ON parallel_tool_calls(step_id);

-- Update version
INSERT INTO schema_versions (version, description) 
VALUES (2, 'Added parallel execution support');

COMMIT;
```

---

[← Previous Chapter: Prompt Engineering](./12-prompt-engineering.md) | [Back to README →](./README.md)

