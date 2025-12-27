# /packages/llm-anthropic/src

Anthropic Claude LLM provider adapter.

<!-- SYNC: When files in this directory change, update this document. -->

## Architecture

This package provides an implementation of the Wukong LLM adapter interface for Anthropic's Claude models, with support for streaming, tool calling, and vision capabilities.

## File Structure

| File | Role | Purpose |
|------|------|---------|
| `index.ts` | Export | Exports public API |
| `ClaudeAdapter.ts` | Core | Claude API integration with streaming support |

## Key Files

### ClaudeAdapter.ts
- **Purpose**: Implements LLM adapter interface for Claude models
- **Exports**: `ClaudeAdapter` class
- **Features**: Streaming responses, tool calling, vision support
- **Dependencies**: `@anthropic-ai/sdk`
- **Models Supported**: claude-3-5-sonnet, claude-3-opus, etc.

### index.ts
- **Purpose**: Public API exports
- **Exports**: `ClaudeAdapter`, types

