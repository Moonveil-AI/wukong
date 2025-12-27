# /packages/llm-google/src

Google Gemini LLM provider adapter.

<!-- SYNC: When files in this directory change, update this document. -->

## Architecture

This package provides an implementation of the Wukong LLM adapter interface for Google's Gemini models, with support for streaming and tool calling.

## File Structure

| File | Role | Purpose |
|------|------|---------|
| `index.ts` | Export | Exports public API |
| `GeminiAdapter.ts` | Core | Google Gemini API integration with streaming support |

## Key Files

### GeminiAdapter.ts
- **Purpose**: Implements LLM adapter interface for Gemini models
- **Exports**: `GeminiAdapter` class
- **Features**: Streaming responses, tool calling
- **Dependencies**: `@google/generative-ai`
- **Models Supported**: gemini-pro, gemini-pro-vision, etc.

### index.ts
- **Purpose**: Public API exports
- **Exports**: `GeminiAdapter`, types

