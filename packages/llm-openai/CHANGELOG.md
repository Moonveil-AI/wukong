# Changelog - @wukong/llm-openai

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-11-13

### Added

- Initial implementation of OpenAI LLM adapter
- Full support for OpenAI Chat Completions API
- Streaming support with real-time callbacks
- Token counting using tiktoken library
- Automatic retry logic with exponential backoff
- Rate limit handling via OpenAI SDK
- Model capabilities detection (context window, function calling, vision)
- Support for all GPT models (GPT-4o, GPT-4, GPT-3.5)
- Comprehensive TypeScript type definitions
- Complete test suite with unit and integration tests
- Full API documentation and README
- Factory function for convenient initialization
- Custom base URL support for proxies
- Organization ID support
- Configurable parameters (temperature, max tokens, penalties, etc.)

### Features

- `OpenAIAdapter` class implementing `LLMAdapter` interface
- `call()` - Simple prompt-based LLM calls
- `callWithMessages()` - Chat format with system/user/assistant roles
- `callWithStreaming()` - Real-time streaming with chunk callbacks
- `countTokens()` - Accurate token counting for all GPT models
- `getCapabilities()` - Model capability detection
- Comprehensive error handling for API errors
- Fallback token estimation when tiktoken fails

### Dependencies

- `openai@^4.72.0` - Official OpenAI SDK
- `tiktoken@^1.0.18` - Token counting library
- `@wukong/agent@workspace:*` - Core types and interfaces

