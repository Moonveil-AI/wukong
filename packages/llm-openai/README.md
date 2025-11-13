# @wukong/llm-openai

OpenAI LLM adapter for the Wukong agent framework.

## Features

- ✅ **OpenAI API Integration** - Full support for GPT-4o, GPT-4, and GPT-3.5 models
- ✅ **Streaming Support** - Real-time response streaming with callbacks
- ✅ **Token Counting** - Accurate token counting using tiktoken
- ✅ **Automatic Retries** - Built-in retry logic with exponential backoff
- ✅ **Rate Limit Handling** - Graceful handling of API rate limits
- ✅ **Error Handling** - Comprehensive error handling and reporting
- ✅ **TypeScript** - Full TypeScript support with type definitions

## Installation

```bash
pnpm add @wukong/llm-openai
```

## Usage

### Basic Usage

```typescript
import { OpenAIAdapter } from '@wukong/llm-openai';

const adapter = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini',
});

// Simple call
const response = await adapter.call('Hello, world!');
console.log(response.text);
console.log('Tokens used:', response.tokensUsed.total);
```

### Chat Format

```typescript
const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the capital of France?' },
];

const response = await adapter.callWithMessages(messages, {
  temperature: 0.7,
  maxTokens: 500,
});

console.log(response.text);
```

### Streaming

```typescript
const response = await adapter.callWithStreaming(
  'Write a short story',
  {
    maxTokens: 1000,
    streaming: {
      onChunk: (chunk) => {
        process.stdout.write(chunk);
      },
      onComplete: (fullText) => {
        console.log('\n\nComplete!');
      },
      onError: (error) => {
        console.error('Streaming error:', error);
      },
    },
  },
);
```

### Token Counting

```typescript
const text = 'This is a sample text.';
const tokenCount = await adapter.countTokens(text);
console.log('Token count:', tokenCount);
```

### Model Capabilities

```typescript
const capabilities = adapter.getCapabilities();
console.log('Max tokens:', capabilities.maxTokens);
console.log('Supports streaming:', capabilities.supportsStreaming);
console.log('Supports function calling:', capabilities.supportsFunctionCalling);
console.log('Supports vision:', capabilities.supportsVision);
```

## Configuration

### OpenAIAdapterConfig

```typescript
interface OpenAIAdapterConfig {
  /** OpenAI API key (required) */
  apiKey: string;

  /** Default model to use (default: 'gpt-4o-mini') */
  model?: string;

  /** Organization ID (optional) */
  organizationId?: string;

  /** Base URL for custom endpoints (optional) */
  baseURL?: string;

  /** Default temperature (default: 0.7) */
  temperature?: number;

  /** Default max tokens (default: 4096) */
  maxTokens?: number;

  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;

  /** Timeout in milliseconds (default: 60000) */
  timeout?: number;
}
```

## Supported Models

The adapter supports all OpenAI models, including:

- **GPT-4o** - Latest and most capable model
  - `gpt-4o` - 128K context window
  - `gpt-4o-mini` - Fast and cost-effective
- **GPT-4** - Powerful reasoning model
  - `gpt-4` - 8K context window
  - `gpt-4-turbo` - 128K context window
  - `gpt-4-vision` - With vision capabilities
- **GPT-3.5** - Fast and cost-effective
  - `gpt-3.5-turbo` - 16K context window

## Error Handling

The adapter provides clear error messages for common issues:

```typescript
try {
  const response = await adapter.call('Hello');
} catch (error) {
  if (error.message.includes('API error')) {
    // Handle API errors
    console.error('OpenAI API error:', error);
  }
}
```

## Advanced Usage

### Custom Base URL

For using custom endpoints or proxies:

```typescript
const adapter = new OpenAIAdapter({
  apiKey: 'your-key',
  baseURL: 'https://your-proxy.com/v1',
});
```

### Organization ID

For organization-specific API usage:

```typescript
const adapter = new OpenAIAdapter({
  apiKey: 'your-key',
  organizationId: 'org-xxxxx',
});
```

### Custom Timeout and Retries

```typescript
const adapter = new OpenAIAdapter({
  apiKey: 'your-key',
  maxRetries: 5,
  timeout: 120000, // 2 minutes
});
```

## Factory Function

For convenience, you can use the factory function:

```typescript
import { createOpenAIAdapter } from '@wukong/llm-openai';

const adapter = createOpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini',
});
```

## License

MIT

## Related Packages

- `@wukong/agent` - Core Wukong agent system
- `@wukong/llm-google` - Google Gemini LLM adapter

