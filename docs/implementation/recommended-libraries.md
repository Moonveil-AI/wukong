# Recommended Libraries for Wukong Development

> Essential and optional libraries to accelerate Wukong Agent Library development

**Date**: 2025-11-12  
**Philosophy**: Wukong is a **library** focused on core Agent functionality, not a UI framework

---

## Core Philosophy

- ✅ **Core Agent Functionality** - LLM integration, reasoning, tool execution
- ✅ **Adapter Architecture** - Platform-agnostic, users choose their infrastructure
- ✅ **Minimal Dependencies** - Only essential libraries in core package
- ⚠️ **UI is Optional** - Users bring their own UI or use headless mode

---

## Required Dependencies (Core Package)

These libraries are **essential** for Wukong's core functionality and will be direct dependencies of `@wukong/agent`.

| Library | Purpose | Why Required |
|---------|---------|--------------|
| **zod** | Schema validation | Validate tool parameters and LLM responses. Provides TypeScript type inference and detailed error messages. Essential for type-safe tool execution. |
| **eventemitter3** | Event system | Agent visibility and control. Emit events for step execution, tool calls, progress updates. Users need this for monitoring and intervention. |
| **nanoid** | ID generation | Generate unique IDs for sessions, steps, todos. Shorter and more URL-friendly than UUID. |
| **p-queue** | Concurrency control | Parallel tool execution with limits. Essential for executing multiple tools simultaneously while respecting rate limits. |

**Total:** 4 required dependencies (all lightweight)

---

## Peer Dependencies

These are **required** but not bundled with Wukong. Users install them based on their choice of provider.

| Library | Purpose | Why Peer Dependency |
|---------|---------|---------------------|
| **openai** or **@anthropic-ai/sdk** or **@google/generative-ai** | LLM provider | Users choose their LLM provider. Making it a peer dependency keeps the core library small and flexible. |

**Note:** We'll provide official adapter packages:
- `@wukong/llm-openai`
- `@wukong/llm-anthropic`
- `@wukong/llm-google`
- `@wukong/llm-vercel` (wraps Vercel AI SDK for unified interface)

---

## Storage/Cache/Vector Adapters

These are covered in [Appendix C: Adapter Architecture](../design/appendix-adapters.md). Users choose based on deployment platform:
- `@wukong/adapter-vercel` (Vercel Postgres + KV + Blob)
- `@wukong/adapter-aws` (RDS + ElastiCache + S3)
- `@wukong/adapter-supabase` (Supabase Database + Storage)
- `@wukong/adapter-local` (SQLite + file system for development)

---

## Recommended Optional Dependencies

### Document Processing (`@wukong/documents`)

For knowledge base document indexing. Optional package users can install if needed.

| Library | Purpose | Why Recommended |
|---------|---------|-----------------|
| **pdf-parse** | PDF parsing | Extract text from PDF documents. Most common document format in knowledge bases. |
| **mammoth** | DOCX parsing | Extract text from Word documents. Common in business environments. |
| **gray-matter** | Markdown frontmatter | Parse markdown files with metadata. Essential for documentation-based knowledge bases. |
| **cheerio** | HTML parsing | Extract text from HTML documents. Lightweight alternative to puppeteer for static HTML. |
| **langchain** (text splitters only) | Document chunking | Smart text splitting with overlap. Use only the text splitter component, not the entire framework. |

**Package:** `@wukong/documents` (optional, ~5 dependencies)

---

### Embedding Generation (`@wukong/embeddings`)

For vector search in knowledge base. Optional package for semantic retrieval.

| Library | Purpose | Why Recommended |
|---------|---------|-----------------|
| **openai** (embeddings API) | Vector embeddings | Best quality embeddings. Text-embedding-3-small is fast and affordable. |
| **cohere-ai** | Alternative embeddings | Good quality, competitive pricing. Alternative to OpenAI. |
| **@xenova/transformers** | Local embeddings | Run embeddings locally without API calls. For privacy-sensitive or offline use cases. |

**Package:** `@wukong/embeddings` (optional, users choose one provider)

---

### Utility Libraries

Helpful but not required. Users can use alternatives if they prefer.

| Library | Purpose | Why Useful | Required? |
|---------|---------|------------|-----------|
| **p-retry** | Retry logic | Automatic retries for flaky API calls. Improves reliability. | Optional |
| **date-fns** | Date formatting | Human-readable timestamps ("3 minutes ago"). Better than built-in Date. | Optional |
| **tiktoken** | Token counting | Accurate OpenAI token counting. Helps with context management. | Optional |

---

## Development Tools

| Library | Purpose | When to Use |
|---------|---------|-------------|
| **TypeScript** | Type safety | Always. Wukong is written in TypeScript. |
| **tsup** | Build tool | Building the library. Fast and simple bundler for TypeScript libraries. |
| **vitest** | Testing | Unit and integration tests. Faster than Jest, better TypeScript support. |
| **@biomejs/biome** | Linting/formatting | Code quality. Faster all-in-one alternative to ESLint + Prettier. |

---

## NOT Recommended

| Library | Why NOT Recommended |
|---------|---------------------|
| **LangChain** (full framework) | Too heavyweight. Only use text splitters component. We're building our own agent framework. |
| **LlamaIndex** | Python-first. Not suitable for TypeScript/Next.js ecosystem. |
| **Vercel AI SDK** (direct use) | Good for applications, but we're building a library. We'll provide it as one adapter option (`@wukong/llm-vercel`), not a core dependency. |
| **Heavy UI frameworks** (Material-UI, Ant Design) | Wukong is a library, not a UI framework. Users bring their own UI. |
| **Prisma** | Too opinionated for a library. We use adapter pattern for flexibility. Users can use Prisma in their adapters if they want. |

---

## UI Components (Minimal & Optional)

If we provide UI components at all, they should be:

**Package:** `@wukong/ui` (completely optional)

**Components:**
- `<AgentStatus>` - Show current step and progress
- `<StepTimeline>` - Display step history
- `<TodoList>` - Show active todos

**Implementation:**
- Built with Radix UI (headless, accessible)
- Styled with Tailwind CSS
- Fully customizable
- Zero opinions on design

**Users can:**
- Use `@wukong/ui` components
- Build their own UI from scratch
- Use shadcn/ui or any component library they prefer
- Use headless mode with no UI at all

---

## Package Architecture

```
@wukong/
├── agent                 # Core library (zod, eventemitter3, nanoid, p-queue)
│   └── Peer: openai | @anthropic-ai/sdk | @google/generative-ai
│
├── llm-openai           # OpenAI adapter
├── llm-anthropic        # Anthropic adapter
├── llm-google           # Google Gemini adapter
├── llm-vercel           # Vercel AI SDK adapter
│
├── adapter-vercel       # Vercel deployment adapter
├── adapter-aws          # AWS deployment adapter
├── adapter-supabase     # Supabase deployment adapter
├── adapter-local        # Local development adapter
│
├── documents            # Optional: PDF/DOCX/Markdown parsing
├── embeddings           # Optional: Vector embedding generation
└── ui                   # Optional: Minimal UI components
```

---

## Installation Examples

### Minimal Setup (Core + OpenAI + Vercel)

```bash
npm install @wukong/agent @wukong/llm-openai @wukong/adapter-vercel
```

**Dependencies installed:** 6 (core 4 + openai peer + adapter)

### Full-Featured Setup

```bash
npm install @wukong/agent \
  @wukong/llm-openai \
  @wukong/adapter-vercel \
  @wukong/documents \
  @wukong/embeddings
```

**Dependencies installed:** ~15 (includes document parsing and embeddings)

### Custom Setup (Anthropic + AWS)

```bash
npm install @wukong/agent \
  @wukong/llm-anthropic \
  @wukong/adapter-aws \
  @wukong/documents
```

---

## Dependency Size Comparison

| Package | Direct Dependencies | Total Size | Install Time |
|---------|-------------------|------------|--------------|
| `@wukong/agent` | 4 required | ~500 KB | < 5 sec |
| `+ llm-openai` | +1 (openai) | +2 MB | +5 sec |
| `+ adapter-vercel` | +3 (postgres, kv, blob) | +1 MB | +3 sec |
| `+ documents` | +5 | +3 MB | +5 sec |
| `+ embeddings` | +0 (uses existing openai) | +0 | +0 |
| **Total (full)** | **~13** | **~6.5 MB** | **< 20 sec** |

**Comparison:**
- LangChain.js: ~50 dependencies, ~20 MB
- Flowise: ~100+ dependencies, ~50 MB
- Wukong (minimal): ~6 dependencies, ~3 MB ✅

---

## Decision Matrix

### Choose Based on Needs

| If you need... | Install |
|----------------|---------|
| Just the Agent (headless) | `@wukong/agent` + LLM adapter + Storage adapter |
| + Document indexing | `+ @wukong/documents` |
| + Semantic search | `+ @wukong/embeddings` |
| + Ready-made UI | `+ @wukong/ui` |

### Choose LLM Adapter

| Provider | Best For | Install |
|----------|----------|---------|
| OpenAI | Best quality, most reliable | `@wukong/llm-openai` |
| Anthropic | Long context, coding tasks | `@wukong/llm-anthropic` |
| Google Gemini | Multimodal, 2M context | `@wukong/llm-google` |
| Vercel AI SDK | Multi-provider, Next.js apps | `@wukong/llm-vercel` |

### Choose Storage Adapter

| Platform | Best For | Install |
|----------|----------|---------|
| Vercel | Next.js apps, zero config | `@wukong/adapter-vercel` |
| AWS | Enterprise, full control | `@wukong/adapter-aws` |
| Supabase | Fast prototyping, full-stack | `@wukong/adapter-supabase` |
| Local | Development, offline | `@wukong/adapter-local` |

---

## Summary

### ✅ Keep It Minimal

**Core package:** Only 4 required dependencies
- zod (validation)
- eventemitter3 (events)
- nanoid (IDs)
- p-queue (concurrency)

**Everything else is optional and modular:**
- LLM provider (peer dependency)
- Storage adapter (separate package)
- Document processing (separate package)
- Embeddings (separate package)
- UI components (separate package)

### ✅ Users Install What They Need

No bloat. No unused dependencies. Users compose their own stack.

### ✅ Platform Agnostic

Works on Vercel, AWS, Supabase, or self-hosted. Users choose.

---

## Related Documentation

- [Core Interface Design](../design/03-interfaces.md) - Agent API usage
- [Adapter Architecture](../design/appendix-adapters.md) - Storage/Cache/Files/Vector adapters
- [Implementation Patterns](../design/14-implementation-patterns.md) - Best practices

[← Back to README](../../README.md)
