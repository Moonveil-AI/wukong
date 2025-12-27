# /packages/llm-openai/src

OpenAI GPT LLM provider adapter.

<!-- SYNC: When files in this directory change, update this document. -->

## Architecture

This package provides an implementation of the Wukong LLM adapter interface for OpenAI's GPT models, with support for streaming, tool calling, and vision capabilities.

## File Structure

| File | Role | Purpose |
|------|------|---------|
| `index.ts` | Export | Exports public API |
| `OpenAIAdapter.ts` | Core | OpenAI API integration with streaming support |

## Key Files

### OpenAIAdapter.ts
- **Purpose**: Implements LLM adapter interface for GPT models
- **Exports**: `OpenAIAdapter` class
- **Features**: Streaming responses, tool calling, vision support
- **Dependencies**: `openai`
- **Models Supported**: gpt-4, gpt-3.5-turbo, etc.

### index.ts
- **Purpose**: Public API exports
- **Exports**: `OpenAIAdapter`, types

