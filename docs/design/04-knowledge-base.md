# Knowledge Base System

> **Note:** For an analysis of why we built a custom knowledge base instead of using existing solutions like mem0, see [Why Not Use mem0?](../why-not-mem0.md)

## Table of Contents
- [Knowledge Integration](#knowledge-integration)
- [Auto-Indexing](#auto-indexing)
- [Vector Retrieval](#vector-retrieval)
- [Permission Control](#permission-control)

---

## Knowledge Integration

Wukong supports multiple knowledge sources through a unified interface.

### Local File System

```typescript
knowledgeBase: {
  type: 'local',
  path: './docs',
  includes: ['**/*.md', '**/*.pdf', '**/*.txt'],
  excludes: ['node_modules/**']
}
```

### Vercel Blob Storage

```typescript
knowledgeBase: {
  type: 'vercel-blob',
  path: 'knowledge-base',
  apiToken: process.env.BLOB_READ_WRITE_TOKEN
}
```

### S3-Compatible Storage

```typescript
knowledgeBase: {
  type: 's3',
  bucket: 'my-knowledge-base',
  prefix: 'docs/',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
}
```

### Custom Knowledge Source

Support any storage by implementing the `FilesAdapter` interface:

```typescript
interface FilesAdapter {
  upload(path: string, content: Buffer): Promise<string>
  download(path: string): Promise<Buffer>
  list(prefix: string): Promise<string[]>
}
```

---

## Auto-Indexing

### Indexing Process

The Agent automatically completes the following steps during initialization:

```typescript
// 1. Scan knowledge base files
const files = await filesAdapter.list(knowledgeBasePath)

// 2. Extract text content
const documents = await Promise.all(
  files.map(async file => {
    const content = await filesAdapter.download(file)
    return extractText(content, file.extension)
  })
)

// 3. Chunking
const chunks = documents.flatMap(doc => 
  chunkDocument(doc, {
    chunkSize: 1000,      // About 1000 characters per chunk
    overlap: 200          // 200 characters overlap
  })
)

// 4. Generate embeddings
const embeddings = await Promise.all(
  chunks.map(chunk => 
    generateEmbedding(chunk.text, embedModel)
  )
)

// 5. Store to vector database
await vectorAdapter.upsertBatch(
  chunks.map((chunk, i) => ({
    id: chunk.id,
    vector: embeddings[i],
    metadata: {
      filename: chunk.filename,
      pageNumber: chunk.pageNumber,
      text: chunk.text
    }
  }))
)
```

### Manual Trigger Indexing

```typescript
// Rebuild entire index
await agent.rebuildKnowledgeIndex()

// Incremental update
await agent.updateKnowledge({
  action: 'add',
  files: ['new-doc.md', 'update-doc.pdf']
})

// Delete document
await agent.updateKnowledge({
  action: 'remove',
  files: ['old-doc.md']
})
```

### Supported Document Formats

| Format | Extraction Method | Special Processing |
|--------|-------------------|-------------------|
| Markdown | Direct read | Preserve heading structure |
| PDF | pdf-parse | Chunk by page |
| TXT | Direct read | Chunk by paragraph |
| DOCX | mammoth.js | Extract plain text |
| HTML | cheerio | Remove tags |

---

## Vector Retrieval

### Retrieval Interface

```typescript
interface SearchOptions {
  query: string        // Query text
  topK?: number        // Return top K results (default 5)
  minScore?: number    // Minimum similarity (0-1, default 0.7)
  filters?: {          // Filter conditions
    filename?: string
    userId?: string
    tags?: string[]
  }
}
```

### Usage Example

```typescript
// Basic search
const results = await agent.searchKnowledge({
  query: "How to use tools",
  topK: 5,
  minScore: 0.7
})

console.log("Found relevant knowledge:")
results.forEach(result => {
  console.log(`- ${result.filename}: ${result.text}`)
  console.log(`  Similarity: ${result.score}`)
})

// Search with filters
const results = await agent.searchKnowledge({
  query: "Product usage instructions",
  topK: 3,
  filters: {
    tags: ['tutorial', 'user-guide']
  }
})
```

### Agent Internal Usage

The Agent automatically queries the knowledge base in each step:

```typescript
// Agent internal execution
async function executeStep(step: Step) {
  // 1. Query knowledge base based on current context
  const relevantKnowledge = await this.knowledgeBase.search({
    query: step.context,
    topK: 3
  })
  
  // 2. Inject knowledge into Prompt
  const prompt = this.promptBuilder.build({
    goal: this.session.goal,
    history: this.session.history,
    knowledge: relevantKnowledge,  // 🔑 Inject relevant knowledge
    skills: this.matchedSkills
  })
  
  // 3. Call LLM
  const response = await this.llm.call(prompt)
  
  return response
}
```

### Retrieval Strategies

#### 1. Hybrid Search

Combine vector retrieval and keyword search:

```typescript
const vectorResults = await vectorSearch(query, topK: 10)
const keywordResults = await keywordSearch(query, topK: 10)

// Fusion ranking (RRF - Reciprocal Rank Fusion)
const finalResults = fuseResults(vectorResults, keywordResults, topK: 5)
```

#### 2. Reranking

Use specialized reranking model to improve accuracy:

```typescript
const candidates = await vectorSearch(query, topK: 20)

// Use Cohere/Cross-encoder for reranking
const reranked = await rerank(query, candidates, topK: 5)
```

---

## Permission Control

### Permission Levels

```typescript
enum PermissionLevel {
  PUBLIC = 'public',           // Visible to everyone
  ORGANIZATION = 'organization', // Visible within organization
  INDIVIDUAL = 'individual'     // Visible only to individual
}
```

### Configure Permissions

```typescript
knowledgeBase: {
  path: './docs',
  permissions: {
    level: 'individual',
    userId: 'user-123',
    orgId: 'org-456'
  }
}
```

### Agent Auto-Filtering

```typescript
// Agent automatically filters based on permissions during retrieval
async search(query: string, userId: string) {
  const results = await vectorAdapter.search(query, topK: 10)
  
  // Filter permissions
  return results.filter(result => {
    if (result.permissions.level === 'public') return true
    if (result.permissions.level === 'organization') {
      return result.permissions.orgId === this.session.orgId
    }
    if (result.permissions.level === 'individual') {
      return result.permissions.userId === userId
    }
    return false
  })
}
```

### Metadata Management

Each document chunk contains complete metadata:

```typescript
interface DocumentChunk {
  id: string
  text: string
  embedding: number[]
  metadata: {
    filename: string
    filesize: number
    uploadedAt: Date
    uploadedBy: string
    tags: string[]
    permissions: {
      level: PermissionLevel
      userId?: string
      orgId?: string
    }
    // Document location information
    pageNumber?: number
    chunkIndex: number
    totalChunks: number
  }
}
```

---

## Knowledge Extraction and Management

### Automated Knowledge Extraction

The system automatically extracts valuable knowledge from completed sessions:

```typescript
// Triggered after session completion
async function extractKnowledgeFromSession(sessionId: string) {
  const session = await getSession(sessionId)
  const conversationText = formatConversationHistory(session.history)
  
  // Use LLM to extract knowledge
  const extracted = await llm.call({
    prompt: `
# Task
Extract important knowledge entities from the given conversation.

# Instructions for Knowledge Extraction
- Extract methodology that could be useful in the future for creating similar content
- Extract knowledge for 3 levels (Public, Organization, or Individual):
  * Public: Methodology that can be useful for similar tasks, publicly available
  * Organization: Knowledge specific to the organization, not sharable
  * Individual: Personal information, especially with privacy
- For each level, combine key information into a single entity
- Assign a confidence score (0.0-1.0) for each knowledge piece

# Conversation
${conversationText}

# Output Format
{
  "knowledges": [{
    "content": "extracted knowledge",
    "confidence_score": 0.8,
    "level": "Public" | "Organization" | "Individual"
  }]
}
`,
    model: 'gpt-4o'
  })
  
  // Generate embeddings for each knowledge piece
  for (const knowledge of extracted.knowledges) {
    const embedding = await generateEmbedding(knowledge.content)
    
    // Check for duplicates before storing
    await deduplicateAndStore({
      content: knowledge.content,
      embedding: embedding,
      level: knowledge.level,
      confidenceScore: knowledge.confidence_score,
      sessionId: sessionId,
      userId: session.userId,
      orgId: session.orgId
    })
  }
}
```

### Knowledge Types Extracted

| Type | Description | Example |
|------|-------------|---------|
| **Methodology** | Steps and techniques for completing tasks | "To create vertical videos, first generate 9:16 images, then use P0 tool for video generation" |
| **User Preferences** | User's style and preferences | "User prefers concise subtitles with 48px font size" |
| **Tool Selection** | Tool choices for specific scenarios | "For short videos with audio, prioritize P0 tool" |
| **Error Lessons** | Past errors and solutions | "Kling tool doesn't support audio, need to add separately" |

### Deduplication Process

```typescript
async function deduplicateAndStore(newKnowledge: KnowledgeEntity) {
  // 1. Build permission filter
  const filter = buildPermissionFilter(
    newKnowledge.level,
    newKnowledge.orgId,
    newKnowledge.userId
  )
  
  // 2. Vector search for similar knowledge (top 5, similarity > 0.8)
  const similarKnowledge = await vectorSearch({
    embedding: newKnowledge.embedding,
    filter: filter,
    topK: 5,
    minScore: 0.8
  })
  
  if (similarKnowledge.length === 0) {
    // No similar knowledge, store directly
    await storeKnowledge(newKnowledge)
    return
  }
  
  // 3. Use LLM to compare and decide
  const comparisonResult = await llm.call({
    prompt: `
# Task
Compare new knowledge with existing similar ones and decide:
1. Is the new knowledge truly new?
2. Should it be merged with existing knowledge?

# New Knowledge
${newKnowledge.content}

# Existing Similar Knowledge
${similarKnowledge.map(k => k.content).join('\n---\n')}

# Output Format
{
  "result": "new" | "existing" | "merged",
  "reasoning": "explanation",
  "merged_content": "combined knowledge (only if result is merged)",
  "to_remove_ids": [indices of existing knowledge to remove]
}
`,
    model: 'gpt-4o'
  })
  
  // 4. Execute decision
  switch (comparisonResult.result) {
    case 'new':
      await storeKnowledge(newKnowledge)
      break
      
    case 'existing':
      // Already exists, skip
      break
      
    case 'merged':
      // Store merged version, remove old ones
      const mergedEmbedding = await generateEmbedding(
        comparisonResult.merged_content
      )
      await storeKnowledge({
        ...newKnowledge,
        content: comparisonResult.merged_content,
        embedding: mergedEmbedding
      })
      await deleteKnowledge(comparisonResult.to_remove_ids)
      break
  }
}
```

### Vector Search Algorithm

The system uses HNSW (Hierarchical Navigable Small World) algorithm for efficient vector search:

```typescript
// Azure AI Search configuration
const vectorSearchConfig = {
  algorithm: 'hnsw',
  parameters: {
    m: 4,                  // Number of neighbors per node
    efConstruction: 400,   // Search width during construction
    efSearch: 500,         // Search width during query
    metric: 'cosine'       // Distance metric
  }
}

// Search performance
// - Time complexity: O(log N)
// - Recall rate: >95%
// - Supports millions of vectors
```

---

## Performance Optimization

### 1. Caching Strategy

```typescript
// Cache common queries
const cacheKey = `knowledge:${hash(query)}`
let results = await cache.get(cacheKey)

if (!results) {
  results = await vectorAdapter.search(query)
  await cache.set(cacheKey, results, ttl: 3600)
}
```

### 2. Batch Queries

```typescript
// Query multiple related topics at once
const queries = [
  "How to use tool A",
  "Tool A parameter description",
  "Tool A examples"
]

const allResults = await Promise.all(
  queries.map(q => agent.searchKnowledge({ query: q, topK: 2 }))
)
```

### 3. Lazy Loading

```typescript
// Return summary first, load full content when needed
interface SearchResult {
  id: string
  summary: string      // Immediately returned
  score: number
  loadFull: () => Promise<string>  // Lazy load full content
}
```

---

## Monitoring and Debugging

### Retrieval Quality Monitoring

```typescript
agent.on('knowledge:searched', (event) => {
  console.log("Knowledge retrieval:")
  console.log(`- Query: ${event.query}`)
  console.log(`- Result count: ${event.results.length}`)
  console.log(`- Average similarity: ${event.avgScore}`)
  console.log(`- Duration: ${event.duration}ms`)
})
```

### Debugging Interface

```typescript
// View detailed information for a retrieval
const debug = await agent.debugKnowledgeSearch({
  query: "How to use tools",
  showEmbedding: true,
  showScores: true
})

console.log("Query vector:", debug.queryEmbedding)
console.log("Candidate results:")
debug.candidates.forEach(c => {
  console.log(`- ${c.text}`)
  console.log(`  Vector similarity: ${c.vectorScore}`)
  console.log(`  Keyword match: ${c.keywordScore}`)
  console.log(`  Final score: ${c.finalScore}`)
})
```

[← Previous Chapter: Core Interface Design](./03-interfaces.md) | [Next Chapter: Tools System →](./05-tools-system.md)

