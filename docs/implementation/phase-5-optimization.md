# Phase 5: Optimization & Polish

> **Status:** In Progress
> 
> This phase focuses on optimizing the agent's performance, reliability, and security through token monitoring, concurrency control, batch processing, and input sanitization.

---

## Task 5.1: Token Counting and Monitoring ✅

**Status:** Completed

**Purpose:** Track token usage and cost for optimization.

**Referenced Documentation:**
- `docs/design/08-token-optimization.md` - Token usage monitoring

**Implementation:**
1. Create `packages/agent/src/monitoring/TokenMonitor.ts`:
   - Count tokens for prompts
   - Count tokens for responses
   - Calculate costs
   - Track savings from optimizations
   - Emit `tokens:used` events

**Tests:** ✅
- ✅ Token counting is accurate
- ✅ Cost calculation is correct
- ✅ Savings are tracked
- ✅ Events are emitted

**Verify Steps:**
```typescript
const monitor = new TokenMonitor()

agent.on('tokens:used', (usage) => {
  console.log('Tokens:', usage.totalTokens)
  console.log('Cost:', usage.estimatedCost)
  console.log('Savings:', usage.savings)
})

await agent.execute({ goal: 'test' })
```

---

## Task 5.2: Concurrency Control

**Purpose:** Prevent race conditions and ensure data consistency.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Concurrency control

**Implementation:**
1. Create distributed locks using cache adapter
2. Implement database row locking where needed
3. Add lock utilities

**Tests:**
- Locks prevent concurrent modifications
- Locks are released on errors
- Lock timeouts work
- Deadlocks are prevented

**Verify Steps:**
```typescript
const lock = new DistributedLock(cacheAdapter)

await lock.withLock(`session:${sessionId}`, async () => {
  // Critical section - only one process at a time
  const session = await getSession(sessionId)
  session.status = 'running'
  await saveSession(session)
})
```

---

## Task 5.3: Batch Processing

**Purpose:** Batch multiple operations for better performance.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Batch operations

**Implementation:**
1. Create `packages/agent/src/utils/BatchProcessor.ts`:
   - Queue operations
   - Flush on batch size or timeout
   - Handle errors

2. Apply to embedding generation

**Tests:**
- Multiple calls are batched
- Flush on size works
- Flush on timeout works
- Errors don't affect other items

**Verify Steps:**
```typescript
const batcher = new BatchProcessor(
  async (items) => await generateEmbeddings(items),
  { maxBatchSize: 100, maxWaitMs: 100 }
)

// These three calls are batched into one API call
const e1 = await batcher.add('text 1')
const e2 = await batcher.add('text 2')
const e3 = await batcher.add('text 3')
```

---

## Task 5.4: Input Sanitization ✅

**Status:** Completed

**Purpose:** Prevent injection attacks and validate all inputs.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Security best practices

**Implementation:**
1. Create sanitization utilities ✅
2. Apply to all user inputs ✅
3. Apply to tool parameters ✅
4. Apply to database queries ✅

**Tests:** ✅
- ✅ Malicious inputs are sanitized
- ✅ Valid inputs pass through
- ✅ SQL injection is prevented
- ✅ XSS is prevented

**Verify Steps:**
```typescript
const sanitized = sanitizeToolParameters(
  { prompt: '<script>alert("xss")</script>' },
  schema
)

expect(sanitized.prompt).not.toContain('<script>')
```

---

## Summary

Phase 5 focuses on making the system production-ready by:
- ✅ Tracking token usage and costs (Task 5.1)
- ✅ Securing inputs against attacks (Task 5.4)
- Implementing concurrency controls (Task 5.2)
- Implementing batch processing for efficiency (Task 5.3)

