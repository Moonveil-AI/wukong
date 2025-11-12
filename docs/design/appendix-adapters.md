# Appendix C: Adapter Architecture Design

This appendix introduces Wukong's Adapter architecture for platform-agnostic deployment.

---

## Core Dependencies (Platform-Agnostic)

| Dependency | Required | Description |
|-----------|----------|-------------|
| **LLM Provider** | ✅ | OpenAI / Anthropic / Google |
| **Storage Adapter** | ✅ | Database persistence |
| **Cache Adapter** | ✅ | Temporary state caching |
| **Files Adapter** | ⚠️ | Knowledge base file storage (optional) |
| **Vector Adapter** | ⚠️ | Vector retrieval (optional) |

---

## Adapter Interfaces

### StorageAdapter

For persisting data (Sessions, Steps, Todos, etc.).

```typescript
interface StorageAdapter {
  // Sessions
  saveSession(session: Session): Promise<void>
  getSession(id: string): Promise<Session | null>
  updateSession(id: string, updates: Partial<Session>): Promise<void>
  deleteSession(id: string): Promise<void>
  listSessions(userId?: string): Promise<Session[]>
  
  // Steps
  saveStep(step: Step): Promise<void>
  getSteps(sessionId: string): Promise<Step[]>
  getStep(id: string): Promise<Step | null>
  updateStep(id: string, updates: Partial<Step>): Promise<void>
  deleteStep(id: string): Promise<void>
  
  // Todos
  saveTodo(todo: Todo): Promise<void>
  getTodos(sessionId: string): Promise<Todo[]>
  updateTodo(id: string, updates: Partial<Todo>): Promise<void>
  deleteTodo(id: string): Promise<void>
  
  // Checkpoints
  saveCheckpoint(checkpoint: Checkpoint): Promise<void>
  getCheckpoints(sessionId: string): Promise<Checkpoint[]>
  restoreCheckpoint(id: string): Promise<Checkpoint>
}
```

### CacheAdapter

For temporary state caching (async task status, temporary data, etc.).

```typescript
interface CacheAdapter {
  // Basic cache
  set(key: string, value: any, ttl?: number): Promise<void>
  get(key: string): Promise<any>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  
  // Batch operations
  mset(entries: Array<[string, any]>, ttl?: number): Promise<void>
  mget(keys: string[]): Promise<any[]>
  
  // Set operations (for queues)
  sadd(key: string, ...members: string[]): Promise<void>
  smembers(key: string): Promise<string[]>
  srem(key: string, member: string): Promise<void>
  spop(key: string): Promise<string | null>
  
  // 🆕 Async task queue support
  enqueueAsyncTask(task: AsyncTask): Promise<void>
  getAsyncTaskStatus(taskId: string): Promise<TaskStatus | null>
  updateAsyncTaskStatus(taskId: string, status: TaskStatus): Promise<void>
}
```

### FilesAdapter

For knowledge base file storage (optional).

```typescript
interface FilesAdapter {
  // File operations
  upload(path: string, content: Buffer): Promise<string>
  download(path: string): Promise<Buffer>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>
  
  // Directory operations
  list(prefix: string): Promise<string[]>
  listWithMetadata(prefix: string): Promise<FileMetadata[]>
  
  // Metadata
  getMetadata(path: string): Promise<FileMetadata>
}

interface FileMetadata {
  path: string
  size: number
  mimeType: string
  createdAt: Date
  updatedAt: Date
}
```

### VectorAdapter

For vector retrieval (optional).

```typescript
interface VectorAdapter {
  // Vector operations
  upsert(id: string, vector: number[], metadata: any): Promise<void>
  upsertBatch(items: VectorItem[]): Promise<void>
  
  // Search
  search(vector: number[], topK: number, filter?: any): Promise<SearchResult[]>
  
  // Delete
  delete(id: string): Promise<void>
  deleteBatch(ids: string[]): Promise<void>
  
  // Metadata update
  updateMetadata(id: string, metadata: any): Promise<void>
}

interface VectorItem {
  id: string
  vector: number[]
  metadata: any
}

interface SearchResult {
  id: string
  score: number
  metadata: any
}
```

---

## Official Adapters

### 1. Vercel Adapter

For Vercel deployment, using Vercel Postgres + KV + Blob.

```bash
npm install @wukong/adapter-vercel
```

```typescript
import { VercelAdapter } from '@wukong/adapter-vercel'

const agent = new WukongAgent({
  llmKey: process.env.OPENAI_API_KEY,
  adapter: new VercelAdapter({
    postgres: process.env.POSTGRES_URL,
    kv: process.env.KV_URL,
    blob: process.env.BLOB_READ_WRITE_TOKEN
  }),
  knowledgeBase: { path: './knowledge' },
  tools: { path: './tools' }
})
```

**Features:**
- Storage: Vercel Postgres
- Cache: Vercel KV (Redis)
- Files: Vercel Blob
- Vector: Postgres pgvector extension

### 2. AWS Adapter

For AWS deployment, using RDS + ElastiCache + S3.

```bash
npm install @wukong/adapter-aws
```

```typescript
import { AWSAdapter } from '@wukong/adapter-aws'

const agent = new WukongAgent({
  llmKey: process.env.OPENAI_API_KEY,
  adapter: new AWSAdapter({
    region: 'us-east-1',
    rds: {
      endpoint: process.env.RDS_ENDPOINT,
      database: 'wukong',
      username: process.env.RDS_USERNAME,
      password: process.env.RDS_PASSWORD
    },
    elasticache: {
      endpoint: process.env.ELASTICACHE_ENDPOINT
    },
    s3: {
      bucket: 'my-knowledge-base',
      region: 'us-east-1'
    }
  }),
  knowledgeBase: { path: 's3://my-knowledge-base/docs' },
  tools: { path: './tools' }
})
```

**Features:**
- Storage: RDS (PostgreSQL)
- Cache: ElastiCache (Redis)
- Files: S3
- Vector: RDS pgvector extension

### 3. Supabase Adapter

For Supabase full stack.

```bash
npm install @wukong/adapter-supabase
```

```typescript
import { SupabaseAdapter } from '@wukong/adapter-supabase'

const agent = new WukongAgent({
  llmKey: process.env.OPENAI_API_KEY,
  adapter: new SupabaseAdapter({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY
  }),
  knowledgeBase: { path: 'supabase://storage/knowledge' },
  tools: { path: './tools' }
})
```

**Features:**
- Storage: Supabase Database (PostgreSQL)
- Cache: Supabase Realtime
- Files: Supabase Storage
- Vector: Supabase Vector (pgvector)

### 4. Local Adapter

For local development, using SQLite + file system.

```bash
npm install @wukong/adapter-local
```

```typescript
import { LocalAdapter } from '@wukong/adapter-local'

const agent = new WukongAgent({
  llmKey: process.env.OPENAI_API_KEY,
  adapter: new LocalAdapter({
    dbPath: './data/wukong.db',
    filesPath: './data/files',
    cachePath: './data/cache'
  }),
  knowledgeBase: { path: './knowledge' },
  tools: { path: './tools' }
})
```

**Features:**
- Storage: SQLite
- Cache: Memory + files
- Files: Local file system
- Vector: SQLite-VSS

---

## Custom Adapter

### Implement StorageAdapter

```typescript
import { StorageAdapter, Session, Step, Todo } from '@wukong/agent'

export class CustomStorageAdapter implements StorageAdapter {
  private db: YourDatabaseClient
  
  constructor(config: CustomConfig) {
    this.db = new YourDatabaseClient(config)
  }
  
  async saveSession(session: Session): Promise<void> {
    await this.db.insert('sessions', {
      id: session.id,
      goal: session.goal,
      status: session.status,
      user_id: session.userId,
      created_at: session.createdAt
    })
  }
  
  async getSession(id: string): Promise<Session | null> {
    const row = await this.db.query('sessions')
      .where('id', id)
      .first()
    
    if (!row) return null
    
    return {
      id: row.id,
      goal: row.goal,
      status: row.status,
      userId: row.user_id,
      createdAt: row.created_at
    }
  }
  
  // Implement other methods...
}
```

### Implement CacheAdapter

```typescript
import { CacheAdapter, AsyncTask, TaskStatus } from '@wukong/agent'

export class CustomCacheAdapter implements CacheAdapter {
  private cache: YourCacheClient
  
  constructor(config: CustomConfig) {
    this.cache = new YourCacheClient(config)
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.cache.set(key, JSON.stringify(value), ttl)
  }
  
  async get(key: string): Promise<any> {
    const value = await this.cache.get(key)
    return value ? JSON.parse(value) : null
  }
  
  async enqueueAsyncTask(task: AsyncTask): Promise<void> {
    // Save task status
    await this.set(`async:task:${task.internalTaskId}`, task)
    
    // Add to queue
    await this.sadd('async:polling:queue', task.internalTaskId)
  }
  
  async getAsyncTaskStatus(taskId: string): Promise<TaskStatus | null> {
    return await this.get(`async:task:${taskId}`)
  }
  
  // Implement other methods...
}
```

### Use Custom Adapter

```typescript
const agent = new WukongAgent({
  llmKey: process.env.OPENAI_API_KEY,
  adapter: new CustomStorageAdapter(config),
  // If needed, can combine multiple adapters
  cache: new CustomCacheAdapter(cacheConfig),
  files: new CustomFilesAdapter(filesConfig),
  vector: new CustomVectorAdapter(vectorConfig)
})
```

---

## Adapter Selection Guide

### Select by Deployment Platform

| Platform | Recommended Adapter | Reason |
|----------|-------------------|--------|
| **Vercel** | VercelAdapter | Native integration, best performance |
| **AWS Lambda** | AWSAdapter | Complete AWS ecosystem support |
| **Supabase** | SupabaseAdapter | Ready-to-use |
| **Local Dev** | LocalAdapter | No external services needed |
| **Other** | Custom Adapter | Flexible adaptation |

### Select by Requirements

#### Requirement 1: Fastest Deployment
Recommended: SupabaseAdapter or VercelAdapter
- Free tier
- Zero configuration
- Immediately available

#### Requirement 2: Lowest Cost
Recommended: LocalAdapter (dev) + Custom Adapter (production)
- Local dev free
- Production uses cheapest service

#### Requirement 3: Highest Performance
Recommended: AWSAdapter
- Complete control
- Can optimize each component
- Supports dedicated instances

#### Requirement 4: Data Privacy
Recommended: Custom Adapter (private cloud)
- Data doesn't leave country
- Complete control
- Compliant with regulations

---

## Best Practices

### 1. Separate Dev and Production

```typescript
// Development environment
if (process.env.NODE_ENV === 'development') {
  agent = new WukongAgent({
    adapter: new LocalAdapter({
      dbPath: './dev/wukong.db'
    })
  })
}

// Production environment
if (process.env.NODE_ENV === 'production') {
  agent = new WukongAgent({
    adapter: new VercelAdapter({
      postgres: process.env.POSTGRES_URL,
      kv: process.env.KV_URL
    })
  })
}
```

### 2. Progressive Migration

```typescript
// Phase 1: Use official Adapter
const agent = new WukongAgent({
  adapter: new VercelAdapter(config)
})

// Phase 2: Only replace Storage, keep others
const agent = new WukongAgent({
  adapter: new CustomStorageAdapter(config),
  cache: new VercelCacheAdapter(kvConfig)
})

// Phase 3: Fully custom
const agent = new WukongAgent({
  adapter: new FullyCustomAdapter(config)
})
```

### 3. Connection Pool Management

```typescript
class PooledStorageAdapter implements StorageAdapter {
  private pool: DatabasePool
  
  constructor(config: PoolConfig) {
    this.pool = createPool({
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000
    })
  }
  
  async saveSession(session: Session) {
    const client = await this.pool.connect()
    try {
      await client.query('INSERT INTO sessions ...')
    } finally {
      client.release()
    }
  }
}
```

### 4. Error Handling and Retry

```typescript
class ResilientAdapter implements StorageAdapter {
  async saveSession(session: Session) {
    return await retry(
      async () => {
        await this.innerAdapter.saveSession(session)
      },
      {
        retries: 3,
        minTimeout: 1000,
        onRetry: (error, attempt) => {
          console.warn(`Retry attempt ${attempt}:`, error)
        }
      }
    )
  }
}
```

---

## Comparison Table

| Feature | Vercel | AWS | Supabase | Local |
|---------|--------|-----|----------|-------|
| **Deployment Difficulty** | ⭐ | ⭐⭐⭐ | ⭐ | ⭐ |
| **Initial Cost** | Free | Paid | Free | Free |
| **Scalability** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ |
| **Performance** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Customizability** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Use Case** | Next.js apps | Enterprise apps | Rapid prototypes | Local dev |

[← Previous: UI Component Package](./appendix-ui-components.md) | [Back to README](./README.md)

