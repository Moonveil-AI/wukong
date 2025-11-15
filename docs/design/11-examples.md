# Usage Examples

This chapter provides complete usage examples to help you get started quickly.

## Table of Contents
- [Basic Usage](#basic-usage)
- [React Component Integration](#react-component-integration)
- [Complete Application Example](#complete-application-example)

---

## Basic Usage

### Installation

```bash
npm install @wukong/agent
```

### Environment Configuration

```bash
# .env.local
OPENAI_API_KEY=sk-...
POSTGRES_URL=postgres://...
KV_URL=redis://...
```

### Create Agent

```typescript
import { WukongAgent } from '@wukong/agent'
import { VercelAdapter } from '@wukong/adapter-vercel'

const agent = new WukongAgent({
  llmKey: process.env.OPENAI_API_KEY!,
  adapter: new VercelAdapter({
    postgres: process.env.POSTGRES_URL,
    kv: process.env.KV_URL
  }),
  knowledgeBase: {
    type: 'local',
    path: './knowledge'
  },
  tools: {
    path: './tools',
    autoDiscover: true
  },
  trustConfig: {
    showPlan: true,
    requireConfirmation: ['delete', 'publish', 'payment']
  },
  tokenConfig: {
    enableToolExecutor: true,
    enableSkills: true,
    autoDiscard: true
  }
})

// Execute task
const result = await agent.execute({
  goal: "Analyze sales.csv and generate monthly report",
  mode: 'interactive'
})

console.log("Result:", result)
```

---

## React Component Integration

### Using UI Component Package

```bash
npm install @wukong/agent @wukong/agent-ui
```

### Complete Chat Interface

```tsx
// components/AgentChat.tsx
'use client'

import { WukongAgentUI } from '@wukong/agent-ui'

export function AgentChat() {
  return (
    <WukongAgentUI
      config={{
        llmKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        knowledgeBase: { type: 'local', path: './knowledge' },
        tools: { path: './tools' }
      }}
      theme="light"
      showCapabilities={true}
      showProgress={true}
      enableFeedback={true}
      onPlanReady={(plan) => {
        return window.confirm(`Execute this plan?\n${plan.summary}`)
      }}
      onProgress={(progress) => {
        console.log("Progress:", progress)
      }}
    />
  )
}
```

### Using Individual Components

```tsx
import {
  CapabilitiesPanel,
  ExecutionPlan,
  TodoList,
  ProgressBar,
  ThinkingBox,
  StopButton
} from '@wukong/agent-ui'

function CustomAgentUI() {
  return (
    <div className="agent-container">
      <CapabilitiesPanel agent={agent} />
      <ExecutionPlan plan={plan} />
      <ProgressBar progress={progress} />
      <TodoList todos={todos} />
      <ThinkingBox thinking={llmThinking} />
      <StopButton onStop={handleStop} />
    </div>
  )
}
```

### Using Hooks

```tsx
import {
  useAgent,
  useProgress,
  useTodos
} from '@wukong/agent-ui'

function MyCustomUI() {
  const { agent, execute, stop } = useAgent(config)
  const { progress, todos } = useProgress(agent)
  const [goal, setGoal] = useState('')
  
  const handleExecute = async () => {
    await execute({ goal, mode: 'interactive' })
  }
  
  return (
    <div>
      <input 
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
      />
      <button onClick={handleExecute}>Execute</button>
      <button onClick={stop}>Stop</button>
      
      <ProgressBar progress={progress} />
      <TodoList todos={todos} />
    </div>
  )
}
```

---

## Complete Application Example

### Main Page Component

```tsx
// app/page.tsx
'use client'

import { useState, useRef } from 'react'
import { WukongAgent } from '@wukong/agent'

export default function Home() {
  const [agent] = useState(() => new WukongAgent({
    llmKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
    knowledgeBase: { type: 'local', path: './knowledge' },
    tools: { path: './tools' }
  }))
  
  const [goal, setGoal] = useState('')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [todos, setTodos] = useState<Todo[]>([])
  const [result, setResult] = useState<any>(null)
  const [isRunning, setIsRunning] = useState(false)
  
  // 🆕 LLM streaming output
  const [llmThinking, setLlmThinking] = useState('')
  const thinkingBoxRef = useRef<HTMLDivElement>(null)
  
  // 🆕 Current session ID
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  
  // Listen to events
  agent.on('session:created', (session) => {
    setCurrentSessionId(session.id)
  })
  
  agent.on('plan:generated', (plan) => {
    setTodos(plan.todos)
    const confirmed = window.confirm(
      `Ready to execute these tasks:\n${plan.todos.map(t => `- ${t.title}`).join('\n')}`
    )
    return confirmed
  })
  
  agent.on('step:started', (step) => {
    setStatus(step.description)
  })
  
  agent.on('progress:updated', (p) => {
    setProgress(p)
  })
  
  agent.on('todo:completed', (todo) => {
    setTodos(prev => prev.map(t => 
      t.id === todo.id ? { ...t, status: 'completed' } : t
    ))
  })
  
  // 🆕 Listen to LLM streaming output
  agent.on('llm:streaming', (chunk) => {
    setLlmThinking(prev => prev + chunk.text)
    // Auto-scroll to bottom
    if (thinkingBoxRef.current) {
      thinkingBoxRef.current.scrollTop = thinkingBoxRef.current.scrollHeight
    }
  })
  
  agent.on('llm:complete', () => {
    // Clear after LLM completes (or keep for debugging)
    setTimeout(() => setLlmThinking(''), 1000)
  })
  
  agent.on('task:completed', (r) => {
    setResult(r)
    setStatus('Task completed!')
    setIsRunning(false)
  })
  
  // 🆕 Listen to stop events
  agent.on('task:stopped', (state) => {
    setStatus('Task stopped')
    setResult(state.partialResult)
    setIsRunning(false)
  })
  
  const handleSubmit = async () => {
    setResult(null)
    setProgress(0)
    setTodos([])
    setLlmThinking('')
    setIsRunning(true)
    
    try {
      await agent.execute({
        goal,
        mode: 'interactive',
        showProgress: true
      })
    } catch (error) {
      if (error.code !== 'TASK_STOPPED') {
        console.error('Task execution failed:', error)
        setStatus('Task failed')
      }
    } finally {
      setIsRunning(false)
    }
  }
  
  // 🆕 Stop handling
  const handleStop = async () => {
    if (!currentSessionId) return
    
    const action = await showStopDialog()
    
    if (action === 'graceful') {
      await agent.stop(currentSessionId, { graceful: true, saveState: true })
    } else if (action === 'immediate') {
      await agent.forceStop(currentSessionId)
    }
  }
  
  // 🆕 Resume task
  const handleResume = async () => {
    if (!currentSessionId) return
    setIsRunning(true)
    await agent.resume(currentSessionId)
  }
  
  return (
    <div className="container">
      <h1>Wukong Agent Demo</h1>
      
      <div className="input-area">
        <input 
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Tell me what you want to do..."
          disabled={isRunning}
        />
        <button 
          onClick={handleSubmit}
          disabled={isRunning || !goal}
        >
          Start
        </button>
        
        {/* 🆕 Stop button (always visible) */}
        {isRunning && (
          <button 
            onClick={handleStop}
            className="stop-button"
          >
            ⏸ Stop
          </button>
        )}
      </div>
      
      {/* Status and progress */}
      {status && <div className="status">Status: {status}</div>}
      {progress > 0 && (
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          />
          <span>{progress}%</span>
        </div>
      )}
      
      {/* 🆕 LLM thinking process (streaming display) */}
      {llmThinking && (
        <div className="thinking-box" ref={thinkingBoxRef}>
          <h3>🧠 Agent is thinking...</h3>
          <pre>{llmThinking}</pre>
        </div>
      )}
      
      {/* Task list */}
      {todos.length > 0 && (
        <div className="todos">
          <h2>Task List:</h2>
          {todos.map(todo => (
            <div key={todo.id} className="todo-item">
              <span className="todo-icon">
                {todo.status === 'completed' ? '✓' : 
                 todo.status === 'in_progress' ? '⟳' : '○'}
              </span>
              <span className="todo-title">{todo.title}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Result */}
      {result && (
        <div className="result">
          <h2>Result:</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
          
          <div className="actions">
            <button onClick={() => agent.undo()}>Undo</button>
            <button onClick={() => agent.edit(result)}>Edit</button>
            
            {/* 🆕 If partial result, show resume button */}
            {result.partial && (
              <button onClick={handleResume}>Continue Execution</button>
            )}
          </div>
        </div>
      )}
      
      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .input-area {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        
        input {
          flex: 1;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        
        button {
          padding: 10px 20px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          background: #0070f3;
          color: white;
        }
        
        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        
        .stop-button {
          background: #ff4444;
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        
        .stop-button:hover {
          background: #cc0000;
        }
        
        .thinking-box {
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 15px;
          margin: 20px 0;
          max-height: 200px;
          overflow-y: auto;
        }
        
        .thinking-box pre {
          white-space: pre-wrap;
          word-wrap: break-word;
          margin: 0;
          font-family: monospace;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .progress-bar {
          width: 100%;
          height: 30px;
          background: #f0f0f0;
          border-radius: 15px;
          overflow: hidden;
          position: relative;
          margin: 10px 0;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #8BC34A);
          transition: width 0.3s ease;
        }
        
        .progress-bar span {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-weight: bold;
        }
        
        .todos {
          margin: 20px 0;
        }
        
        .todo-item {
          padding: 10px;
          border-bottom: 1px solid #eee;
        }
        
        .todo-icon {
          margin-right: 10px;
        }
        
        .result {
          margin-top: 20px;
          padding: 20px;
          background: #f9f9f9;
          border-radius: 5px;
        }
        
        .result pre {
          background: white;
          padding: 15px;
          border-radius: 5px;
          overflow-x: auto;
        }
        
        .actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
      `}</style>
    </div>
  )
}

// Stop dialog component
async function showStopDialog(): Promise<'graceful' | 'immediate' | 'cancel'> {
  return new Promise((resolve) => {
    // Implement dialog UI
    const dialog = document.createElement('div')
    dialog.innerHTML = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                  background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                  z-index: 9999;">
        <h2>Stop Task</h2>
        <p>Currently executing, how would you like to stop?</p>
        <button id="graceful-stop">Stop after current step</button>
        <button id="immediate-stop">Stop immediately</button>
        <button id="cancel-stop">Cancel (continue execution)</button>
      </div>
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9998;"></div>
    `
    document.body.appendChild(dialog)
    
    dialog.querySelector('#graceful-stop')?.addEventListener('click', () => {
      document.body.removeChild(dialog)
      resolve('graceful')
    })
    
    dialog.querySelector('#immediate-stop')?.addEventListener('click', () => {
      document.body.removeChild(dialog)
      resolve('immediate')
    })
    
    dialog.querySelector('#cancel-stop')?.addEventListener('click', () => {
      document.body.removeChild(dialog)
      resolve('cancel')
    })
  })
}
```

### Complete Directory Structure

```
my-app/
├── app/
│   ├── api/
│   │   ├── agent/
│   │   │   └── route.ts
│   │   ├── async/
│   │   │   └── poll-next/
│   │   │       └── route.ts
│   │   └── webhooks/
│   │       └── [toolName]/
│   │           └── route.ts
│   ├── page.tsx
│   └── layout.tsx
├── knowledge/
│   ├── product-guide.md
│   ├── api-docs.pdf
│   └── faq.txt
├── tools/
│   ├── image-generator/
│   │   ├── metadata.json
│   │   ├── handler.ts
│   │   └── schema.json
│   └── data-analyzer/
│       ├── metadata.json
│       ├── handler.ts
│       └── schema.json
├── .env.local
├── package.json
└── next.config.js
```

---

## More Examples

Complete example code can be found in the GitHub repository:
- [Basic Examples](https://github.com/wukong-agent/examples/basic)
- [React Integration Examples](https://github.com/wukong-agent/examples/react)
- [Custom Adapter Examples](https://github.com/wukong-agent/examples/custom-adapter)
- [Custom Tools Examples](https://github.com/wukong-agent/examples/custom-tools)

[← Previous Chapter: Implementation Details](./10-implementation.md) | [Appendices →](./appendix-trustworthiness.md)

