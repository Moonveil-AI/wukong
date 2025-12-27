# Wukong Agent Library

> A plug-and-play Next.js Agent Library that enables developers to add trustworthy AI Agents to their applications in 5 minutes

**Date**: 2025-11-11  
**Tech Stack**: Next.js + TypeScript

<!-- SYNC CONTRACT: When project structure, architecture, or conventions change, update this file and affected directory documentation before the work is considered complete. -->

---

## Project Structure

This project follows the **Fractal Documentation Standard** - each directory contains a README describing its files, and each file contains header comments describing its dependencies and role. See [docs/self-referential-documentation.md](./docs/self-referential-documentation.md) for details.

| Directory | Purpose |
|-----------|---------|
| `packages/agent` | Core agent library - execution engine, state management, events |
| `packages/adapter-local` | SQLite-based local storage adapter |
| `packages/adapter-vercel` | PostgreSQL-based Vercel/production adapter |
| `packages/llm-*` | LLM provider implementations (Anthropic, OpenAI, Google) |
| `packages/embeddings` | Vector embedding implementations |
| `packages/documents` | Document processing and chunking |
| `packages/server` | HTTP server for agent API |
| `packages/ui` | React UI components for agent visualization |
| `examples/*` | Example applications (basic, server, ui) |
| `docs/design` | Detailed design documentation |
| `docs/implementation` | Implementation guides and plans |
| `docs/user-guide` | User-facing documentation |
| `scripts/` | Utility scripts for project maintenance |

---

## Documentation Navigation

### Core Concepts
- [01-Core Design Principles](./docs/design/01-core-concepts.md) - Visibility, Control, Reversibility, Token Efficiency
- [02-Overall Architecture](./docs/design/02-architecture.md) - Layered Architecture, Core Workflows

### Interfaces & Systems
- [03-Core Interface Design](./docs/design/03-interfaces.md) - Initialization, Execution, Events, Session Management
- [04-Knowledge Base System](./docs/design/04-knowledge-base.md) - Knowledge Integration, Auto-Indexing, Vector Retrieval
- [05-Tools System](./docs/design/05-tools-system.md) - Tool Definition, Tool Executor Pattern, Async Execution

### Advanced Features
- [06-Advanced Features](./docs/design/06-advanced-features.md) - Agent Fork, Parallel Tool Execution
- [07-Todo List Mechanism](./docs/design/07-todo-list.md) - Task Decomposition, Progress Tracking, Dynamic Adjustment
- [08-Token Optimization](./docs/design/08-token-optimization.md) - Tool Executor Mode, Skills Lazy Loading, Smart Discarding

### Trustworthiness & Implementation
- [09-Trustworthiness Design](./docs/design/09-trustworthiness.md) - Complete Implementation of Transparent, Controllable, Reversible
- [10-Implementation Details](./docs/design/10-implementation.md) - Next.js Integration, Data Persistence, Async Architecture
- [11-Usage Examples](./docs/design/11-examples.md) - Basic Usage, React Integration, Complete Applications

### Deep Implementation
- [12-Prompt Engineering](./docs/design/12-prompt-engineering.md) - Complete Prompt Design, Examples, and Best Practices
- [13-Database Design](./docs/design/13-database-design.md) - Complete Schema, Indexes, and Relationships
- [14-Implementation Patterns](./docs/design/14-implementation-patterns.md) - Error Handling, Retry, Async Patterns, Performance

### Appendices
- [Appendix A-Trustworthiness Checklist](./docs/design/appendix-trustworthiness.md) - Complete Implementation Checklist of 30 Principles
- [Appendix B-UI Component Package](./docs/design/appendix-ui-components.md) - Ready-to-Use React Components
- [Appendix C-Adapter Architecture](./docs/design/appendix-adapters.md) - Platform-Agnostic Storage Adapters

### Implementation Guides
- [Recommended Libraries](./docs/implementation/recommended-libraries.md) - Essential and Optional Dependencies Guide

### User Guides
- [Database Adapters Guide](./docs/user-guide/db-adapters.md) - Understanding SQLite, PostgreSQL, and Adapters

### Technical Decisions
- [Why Not Use mem0?](./docs/why-not-mem0.md) - Analysis of mem0 vs Custom Knowledge Base

---

## Quick Start

> **✨ Phase 3 Complete!** The library is now ready for testing.  
> 📊 [**Current Status**](./STATUS.md) | 📖 [**Quick Start Guide**](./QUICKSTART.md)

### Try the Example

```bash
# Clone and install
git clone https://github.com/yourusername/wukong.git
cd wukong
pnpm install && pnpm build

# Run the basic example
cd examples/basic
cp env.template .env
# Edit .env and add your OPENAI_API_KEY or ANTHROPIC_API_KEY
mkdir -p data
pnpm dev
```

### UI Component Development (Storybook)

To view and develop UI components in isolation:

```bash
# Start Storybook
cd packages/ui
pnpm storybook

# Or from the root directory
pnpm --filter @wukong/ui run storybook
```

Visit `http://localhost:6006` to see the component library.

### Installation (Future)

Once published to npm:

```bash
npm install @wukong/agent @wukong/adapter-local @wukong/llm-openai
```

#### Troubleshooting: better-sqlite3 Native Bindings

If you encounter errors like `Could not locate the bindings file` when running tests or using the local adapter, this means the `better-sqlite3` native module needs to be compiled for your Node.js version.

**Solution:**

```bash
# Navigate to the better-sqlite3 module directory
cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3

# Build the native bindings
npm run build-release

# Return to project root
cd -
```

**Alternative solution (for pnpm monorepo):**

```bash
# Rebuild all native modules
pnpm rebuild better-sqlite3
```

**Note:** This is required when:
- First installing dependencies on a new machine
- Switching Node.js versions
- Upgrading Node.js to a new major version

### Basic Usage

```typescript
import { WukongAgent } from '@wukong/agent'

const agent = new WukongAgent({
  llmKey: process.env.OPENAI_API_KEY,
  knowledgeBase: './docs',
  tools: './tools'
})

// The Agent automatically:
// - Understands the knowledge base
// - Performs multi-step reasoning
// - Invokes tools
// - Completes complex tasks
await agent.execute({
  goal: "Analyze sales.csv and generate a report"
})
```

---

## Product Positioning

### What It Is

A **plug-and-play** Agent Library (not a framework) that enables developers to integrate powerful AI Agent capabilities into Next.js applications with minimal code.

### Core Value

**"Add a trustworthy AI agent to your application in 5 minutes, without learning complex agent frameworks"**

Key Difference:
- ❌ LangChain etc.: Provides building blocks, developers build themselves
- ✅ Wukong: Provides complete agent, developers only provide knowledge and tools

### Technical Features

1. **Native Next.js Integration** - Seamless integration into Next.js applications
2. **User Autonomy** - LLM key, knowledge base, and tools all provided by users
3. **Trustworthy** - Complete implementation of all "smart to trustworthy" principles
4. **Efficient Execution** - Supports hundreds of steps with smart token savings
5. **Async Tools** - Long-running tasks don't block user experience

---

## Core Advantages

### 🎯 Seven Core Advantages

1. **Plug-and-Play** - 5-minute integration, no need to learn complex frameworks
2. **User Autonomy** - LLM, knowledge base, and tools all provided and controlled by users
3. **Trustworthy** - Complete implementation of all "smart to trustworthy" principles
4. **Token Efficient** - Save 98% tokens through Tool Executor mode, Skills, step discarding
5. **Large Task Capability** - Todo mechanism supports hundreds of steps
6. **Async Execution** - Long-running tools don't block users
7. **Streaming Output** - LLM thinking process shown in real-time, users see what AI is thinking

### 🔑 Key Design

- **Three-Layer Trustworthiness:** Visible, Controllable, Reversible
- **Three Savings:** Tool Executor Pattern, Skills Lazy Loading, Smart Discarding
- **Three Execution Modes:** Interactive, Auto, Streaming
- **Real-Time Transparency:** LLM streaming output, complete visibility of thinking process
- **Full Control:** Stop anytime, graceful recovery, complete state preservation

---

## Trustworthiness Implementation

Wukong fully implements 30 trustworthiness principles across the entire agent lifecycle, ensuring transparency, control, and reversibility at every stage.

### Complete Checklist

| # | Trustworthy Principle | Core Library | UI Component Package | Completeness |
|---|----------------------|--------------|---------------------|--------------|
| **Startup Phase** |
| 1 | Clearly list what can/cannot do | ✅ `getCapabilities()` | ✅ `<CapabilitiesPanel>` | 100% |
| 2 | Skill tree/tag display | ✅ Skills Registry | ✅ `<SkillsTree>` | 100% |
| 3 | Example commands | ✅ Configuration option | ✅ `<ExamplePrompts>` | 100% |
| 4 | New feature notification | ✅ Version API | ✅ `<UpdateBanner>` | 100% |
| 5 | Mark information sources | ✅ Returns with source | ✅ Auto-mark | 100% |
| **Before Execution** |
| 6 | Generate draft | ✅ `onPlanReady` | ✅ `<PlanPreview>` | 100% |
| 7 | Sidebar/modal | ✅ Event system | ✅ `<Sidebar>` `<Modal>` | 100% |
| 8 | Accept/edit options | ✅ callback | ✅ `<ActionButtons>` | 100% |
| 9 | Display execution plan | ✅ `plan:generated` | ✅ `<ExecutionPlan>` | 100% |
| 10 | Expandable checklist | ✅ Todo List | ✅ `<TodoList>` | 100% |
| 11 | Real-time outline display | ✅ streaming | ✅ `<ThinkingBox>` | 100% |
| **During Execution** |
| 12 | Real-time status display | ✅ `step:started` | ✅ `<StatusIndicator>` | 100% |
| 13 | Progress bar/counter | ✅ progress event | ✅ `<ProgressBar>` | 100% |
| 14 | Decision log | ✅ reasoning event | ✅ `<DecisionLog>` | 100% |
| 15 | Reasoning process | ✅ streaming | ✅ Auto-display | 100% |
| 16 | Notify cost | ✅ `tokens:used` | ✅ `<CostIndicator>` | 100% |
| 17 | Answer with "why" | ✅ reasoning field | ✅ `<WhyButton>` | 100% |
| **After Errors** |
| 18 | Undo function | ✅ `undo()` | ✅ `<UndoButton>` | 100% |
| 19 | Version history | ✅ checkpoint | ✅ `<VersionHistory>` | 100% |
| 20 | Sandbox simulation | ⚠️ Tool layer | ✅ `<SandboxPreview>` | 80% |
| 21 | Comparison view | ✅ diff data | ✅ `<DiffView>` | 100% |
| 22 | Stop button | ✅ `stop()` | ✅ `<StopButton>` | 100% |
| 23 | Human confirmation | ✅ Confirmation event | ✅ `<ConfirmDialog>` | 100% |
| 24 | Escalate to human | ✅ Error detection | ✅ `<EscalateButton>` | 100% |
| **New Loop** |
| 25 | Long-term memory selection | ✅ Configuration option | ✅ `<MemorySettings>` | 100% |
| 26 | One-click restart | ✅ `redoStep()` | ✅ `<RetryButton>` | 100% |
| 27 | Thumbs up/down feedback | ✅ Feedback API | ✅ `<FeedbackButtons>` | 100% |
| 28 | Feedback form | ✅ Feedback API | ✅ `<FeedbackForm>` | 100% |
| 29 | Task completion rate | ✅ Statistics API | ✅ `<MetricsDashboard>` | 100% |

**Complete Support Rate: 30/30 (100%)** ✅

For detailed implementation of each principle, see [Appendix A-Trustworthiness Checklist](./docs/design/appendix-trustworthiness.md).

---

## Next Steps

- **[📖 Quick Start Guide](./QUICKSTART.md)** - Get started in 5 minutes
- **[🎯 Basic Example](./examples/basic)** - Try the working example
- [Core Design Principles](./docs/design/01-core-concepts.md) - Understand design philosophy
- [Implementation Plan](./docs/implementation/plan.md) - See what's completed and what's next
- [Core Interface Design](./docs/design/03-interfaces.md) - API documentation

---

**Make AI Agents truly trustworthy, truly useful, truly capable of completing complex tasks.**

