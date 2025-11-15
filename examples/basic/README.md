# Wukong Agent - Basic Example

> A minimal working example to test Wukong and learn the basics.

This example demonstrates:
- ✅ Setting up storage (local SQLite)
- ✅ Configuring LLM with fallback
- ✅ Creating custom tools
- ✅ Executing multi-step tasks
- ✅ Event-based monitoring

**Time to run:** 5-10 minutes

---

## Quick Start

### Prerequisites

1. **Node.js** 18 or higher
2. **pnpm** 9 or higher  
3. **API Key** from [OpenAI](https://platform.openai.com/api-keys) or [Anthropic](https://console.anthropic.com/)

### Step 1: Setup Environment

```bash
# Navigate to this directory
cd /Users/shan/wukong/examples/basic

# Create .env file
cat > .env << 'EOF'
OPENAI_API_KEY=your_key_here
DATABASE_PATH=./data/wukong.db
EOF

# Edit .env and replace 'your_key_here' with your actual API key
```

### Step 2: Install & Build

```bash
# Go to monorepo root
cd /Users/shan/wukong

# Install dependencies
pnpm install

# Build all packages (may take a few minutes)
pnpm build
```

### Step 3: Run the Example

```bash
cd examples/basic
pnpm install
pnpm dev
```

### Expected Output

You should see something like:

```
🚀 Starting Wukong Agent Example

📦 Initializing local storage at: ./data/wukong.db
✅ Storage adapter initialized

🧠 Setting up LLM adapters...
  - OpenAI GPT-4 ✅

🎭 Creating Wukong Agent...
✅ Agent created with calculator tool

🎯 Executing task...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Session created: sess_xxxxx

🤖 LLM call started for step 0
   Streaming output: 
   <Action>CallTool</Action>
<SelectedTool>calculator</SelectedTool>
<Parameters>
{
  "operation": "multiply",
  "a": 15,
  "b": 8
}
</Parameters>
<Reasoning>First, I need to multiply 15 by 8...</Reasoning>

✅ LLM call completed for step 0 (1234ms)
   Model: claude-3-5-sonnet-20241022
   Tokens: 150 (prompt: 100, completion: 50)

⚡ Step 1 started: think
✅ Step 1 completed
⚡ Step 2 started: useTool
🔧 Tool executed: calculator
   Success: true
✅ Step 2 completed
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Task completed successfully!
```

**Success!** If you see this, Wukong is working correctly! 🎉

---

## Understanding the Code

### What the Example Does

The agent executes this task: **"Calculate 15 × 8, then add 42"**

Steps:
1. ✅ Initializes local SQLite database
2. ✅ Connects to OpenAI API
3. ✅ Registers a calculator tool
4. ✅ Creates a Wukong agent
5. ✅ Breaks down the task:
   - Multiply 15 × 8 = 120
   - Add 120 + 42 = 162
6. ✅ Returns final result: 162

---

## Key Concepts Explained

### Storage Adapter
```typescript
const adapter = new LocalAdapter({ databasePath: './data/wukong.db' });
await adapter.initialize();
```
Handles data persistence using SQLite.

### LLM Configuration
```typescript
const agent = new WukongAgent({
  adapter,
  llm: {
    adapters: [
      new OpenAIAdapter({ apiKey: '...', model: 'gpt-4-turbo-preview' })
    ],
    maxRetries: 3,
  },
  // ... other options
});
```
Provides LLM capabilities with automatic fallback.

### Custom Tools
```typescript
const tool = {
  name: 'calculator',
  description: 'Perform calculations',
  inputSchema: { /* JSON Schema */ },
  async execute(params) { /* Implementation */ }
};

const agent = new WukongAgent({
  // ...
  tools: [tool],
});
```
Tools extend the agent's capabilities.

### Event System
```typescript
agent.on('step:started', (event) => {
  console.log(`Step ${event.stepNumber} started`);
});
```
Provides complete visibility into agent execution.

---

## Troubleshooting

### Error: "Could not locate the bindings file"

The better-sqlite3 native module needs to be rebuilt:

```bash
cd /Users/shan/wukong
pnpm rebuild better-sqlite3
```

### Error: "OPENAI_API_KEY is not set"

Check that you:
1. Created the `.env` file in `examples/basic`
2. Added your API key (starts with `sk-`)
3. Saved the file

### Error: "No such file or directory"

Make sure you're in the correct directory:

```bash
cd /Users/shan/wukong/examples/basic
pwd  # Should show: /Users/shan/wukong/examples/basic
```

### Error: "Cannot find module"

Packages need to be built:

```bash
cd /Users/shan/wukong
pnpm build
```

### Database Issues

The database is automatically created at `./data/wukong.db` on first run. If you want to reset it:

```bash
rm -rf ./data
# Run the example again to recreate
```

---

## Success Indicators

✅ **Pass** - See "Task completed successfully" with result  
⚠️ **Partial** - Some steps work but errors occur  
❌ **Fail** - Agent doesn't start or connect

---

## Next Steps

Once this example works, you can:

1. **Modify the task** - Edit the `goal` in `index.ts`
2. **Create custom tools** - Add your own tool definitions
3. **Try different LLMs** - Add Anthropic or Google adapters
4. **Add knowledge base** - Index documents for semantic search
5. **Build your app** - Integrate Wukong into your project

### More Examples

- [Interactive Example](../interactive) - User confirmations (coming soon)
- [Knowledge Base Example](../knowledge-base) - Document search (coming soon)
- [Custom Adapter Example](../custom-adapter) - Own storage (coming soon)

### Documentation

- [Core Concepts](../../docs/design/01-core-concepts.md)
- [API Reference](../../docs/design/03-interfaces.md)
- [Implementation Plan](../../docs/implementation/plan.md)

