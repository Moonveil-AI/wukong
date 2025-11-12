# Todo List Mechanism

## Table of Contents
- [Why Todo Lists Are Needed](#why-todo-lists-are-needed)
- [Data Structures](#data-structures)
- [Auto-Generate Todos](#auto-generate-todos)
- [Progress Tracking](#progress-tracking)
- [Dynamic Adjustment](#dynamic-adjustment)

---

## Why Todo Lists Are Needed

When Agents execute complex tasks, hundreds of steps may be required. The Todo List mechanism provides:

1. **Task Decomposition** - Break large tasks into small tasks
2. **Progress Tracking** - Clearly see how much has been completed
3. **Parallel Execution** - Identify tasks that can be done in parallel
4. **Dynamic Adjustment** - Adjust plans based on execution status

---

## Data Structures

### Todo Definition

```typescript
interface Todo {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  dependencies: string[]  // Other todo ids depended upon
  priority: number
  estimatedSteps: number
  actualSteps?: number
  result?: any
  error?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}
```

### TodoList Definition

```typescript
interface TodoList {
  sessionId: string
  todos: Todo[]
  currentTodo: string | null
  progress: number  // 0-100
  totalEstimatedSteps: number
  actualSteps: number
}
```

---

## Auto-Generate Todos

### Generation Process

When users present complex tasks, the Agent automatically:

```typescript
const result = await agent.execute({
  goal: "Analyze sales.csv, generate report, and send to team"
})

// Agent internal process:
// 1. LLM analyzes task
// 2. Generate task list
// 3. Trigger event to show user
```

### User Listen to Todo Generation

```typescript
agent.on('todos:generated', (todos) => {
  console.log("Task list:")
  todos.forEach((todo, index) => {
    console.log(`- [ ] ${index + 1}. ${todo.title}`)
    if (todo.description) {
      console.log(`     ${todo.description}`)
    }
  })
  
  // Display to user
  showTodoList(todos)
})
```

### Output Example

```
Task list:
- [ ] 1. Read sales.csv file
     Use file reading tool to load data
- [ ] 2. Clean and validate data
     Check for missing and anomalous values
- [ ] 3. Calculate key metrics
     Sales, growth rate, top products, etc.
- [ ] 4. Generate charts
     Trend charts, bar charts, pie charts
- [ ] 5. Write analysis report
     Summarize data insights and recommendations
- [ ] 6. Send email to team
     Attach report and charts
```

### Dependencies

```typescript
const todos = [
  {
    id: 'todo-1',
    title: 'Read data',
    dependencies: []  // No dependencies, can execute immediately
  },
  {
    id: 'todo-2',
    title: 'Clean data',
    dependencies: ['todo-1']  // Depends on "Read data"
  },
  {
    id: 'todo-3',
    title: 'Calculate metrics',
    dependencies: ['todo-2']  // Depends on "Clean data"
  },
  {
    id: 'todo-4',
    title: 'Generate charts',
    dependencies: ['todo-3']  // Depends on "Calculate metrics"
  },
  {
    id: 'todo-5',
    title: 'Write report',
    dependencies: ['todo-3', 'todo-4']  // Depends on "Calculate metrics" and "Generate charts"
  }
]

// Agent automatically identifies tasks that can be parallel
// todo-1 must complete first
// todo-2 waits for todo-1 to complete
// todo-3 waits for todo-2 to complete
// todo-4 can parallel with text part of todo-5
```

---

## Progress Tracking

### Real-time Update Todo Status

```typescript
// Todo started
agent.on('todo:started', (todo) => {
  console.log(`Started: ${todo.title}`)
  updateTodoStatus(todo.id, 'in_progress')
})

// Todo completed
agent.on('todo:completed', (todo) => {
  console.log(`✓ Completed: ${todo.title}`)
  updateTodoStatus(todo.id, 'completed')
  showResult(todo.result)
})

// Todo failed
agent.on('todo:failed', (todo) => {
  console.error(`✗ Failed: ${todo.title}`)
  console.error(`Reason: ${todo.error}`)
  updateTodoStatus(todo.id, 'failed')
  showError(todo.error)
})

// Overall progress
agent.on('progress:updated', (progress) => {
  console.log(`Overall progress: ${progress}%`)
  updateProgressBar(progress)
})
```

### Progress Calculation

```typescript
function calculateProgress(todos: Todo[]): number {
  const completed = todos.filter(t => t.status === 'completed').length
  const total = todos.length
  return Math.round((completed / total) * 100)
}

// Progress considering step weights
function calculateWeightedProgress(todos: Todo[]): number {
  const totalWeight = todos.reduce((sum, t) => sum + t.estimatedSteps, 0)
  const completedWeight = todos
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.estimatedSteps, 0)
  
  return Math.round((completedWeight / totalWeight) * 100)
}
```

### UI Display Example

```typescript
function TodoListUI({ todos }: { todos: Todo[] }) {
  return (
    <div className="todo-list">
      <h2>Task List</h2>
      <ProgressBar progress={calculateProgress(todos)} />
      
      {todos.map(todo => (
        <div key={todo.id} className="todo-item">
          <span className="todo-icon">
            {todo.status === 'completed' ? '✓' : 
             todo.status === 'in_progress' ? '⟳' : 
             todo.status === 'failed' ? '✗' : '○'}
          </span>
          <span className="todo-title">{todo.title}</span>
          {todo.status === 'in_progress' && (
            <Spinner />
          )}
          {todo.result && (
            <button onClick={() => showDetails(todo.result)}>
              View Result
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
```

---

## Dynamic Adjustment

### Why Dynamic Adjustment Is Needed

During execution, the following may occur:
- Discover new sub-tasks
- Some tasks are no longer needed
- Priority needs adjustment
- Dependency relationships change

### Agent Proactive Adjustment

```typescript
// Agent can adjust Todos based on execution status
agent.on('todos:updated', (change) => {
  console.log("Todo list updated:", change)
  
  switch (change.type) {
    case 'added':
      console.log(`+ Added new task: ${change.todo.title}`)
      break
    case 'removed':
      console.log(`- Removed task: ${change.todo.title}`)
      break
    case 'reordered':
      console.log(`↕ Adjusted priority`)
      break
    case 'dependency_changed':
      console.log(`🔗 Updated dependencies`)
      break
  }
  
  refreshTodoList()
})
```

### User Manual Adjustment

```typescript
// Users can manually adjust Todos
await agent.updateTodo(todoId, {
  priority: 10,        // Increase priority
  status: 'pending'    // Reset status
})

// Add new Todo
await agent.addTodo({
  title: 'Additional data validation',
  description: 'Step requested by user',
  dependencies: ['todo-2'],
  priority: 5
})

// Delete Todo
await agent.removeTodo(todoId)

// Adjust execution order
await agent.reorderTodos([
  'todo-1',
  'todo-3',  // Move todo-3 forward
  'todo-2',
  'todo-4'
])
```

### Conditional Branches

```typescript
// Agent decides subsequent Todos based on intermediate results
agent.on('todo:completed', async (todo) => {
  if (todo.id === 'data-analysis') {
    const result = todo.result
    
    // Decide next step based on analysis results
    if (result.hasAnomalies) {
      // Add anomaly handling task
      await agent.addTodo({
        title: 'Handle data anomalies',
        description: `Found ${result.anomalyCount} anomalous values`,
        dependencies: [todo.id],
        priority: 10
      })
    }
  }
})
```

### Failure Retry

```typescript
agent.on('todo:failed', async (todo) => {
  // Auto-retry if failure count is less than 3
  if (todo.retryCount < 3) {
    console.log(`Retrying task: ${todo.title} (attempt ${todo.retryCount + 1})`)
    
    await agent.updateTodo(todo.id, {
      status: 'pending',
      retryCount: todo.retryCount + 1
    })
  } else {
    // After multiple failures, ask user
    const action = await askUser({
      title: 'Task Failed',
      message: `"${todo.title}" has failed 3 times`,
      options: [
        'Skip this task',
        'Manually fix and retry',
        'Cancel entire process'
      ]
    })
    
    if (action === 'Skip this task') {
      await agent.removeTodo(todo.id)
    }
  }
})
```

---

## Best Practices

### 1. Reasonable Granularity

```typescript
// ❌ Too coarse: can't see progress
todos = [
  { title: 'Complete entire report' }
]

// ❌ Too fine: too many tasks
todos = [
  { title: 'Open file' },
  { title: 'Read first line' },
  { title: 'Read second line' },
  // ... 1000 lines
]

// ✅ Appropriate: clear and meaningful
todos = [
  { title: 'Read data file' },
  { title: 'Clean and validate' },
  { title: 'Calculate metrics' },
  { title: 'Generate visualization' },
  { title: 'Write analysis' }
]
```

### 2. Clear Titles

```typescript
// ❌ Unclear
{ title: 'Process data' }

// ✅ Clear
{ title: 'Clean data: remove missing and anomalous values' }
```

### 3. Estimate Steps

```typescript
// Helps calculate progress more accurately
{
  title: 'Generate charts',
  estimatedSteps: 5,  // Estimated 5 steps needed
  // Actual might be:
  // 1. Prepare data
  // 2. Generate trend chart
  // 3. Generate bar chart
  // 4. Generate pie chart
  // 5. Save images
}
```

### 4. Provide Estimated Time

```typescript
{
  title: 'Generate video',
  estimatedSteps: 3,
  estimatedTime: 120,  // Estimated 120 seconds
  // Helps users understand wait time
}
```

[← Previous Chapter: Advanced Features](./06-advanced-features.md) | [Next Chapter: Token Optimization →](./08-token-optimization.md)

