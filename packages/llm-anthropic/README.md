# @wukong/llm-anthropic

Anthropic Claude LLM adapter for the Wukong Agent Library.

## Features

- ✅ Support for Claude Sonnet 4.5 and Haiku 4.5
- ✅ Streaming responses
- ✅ 200K context window support
- ✅ Function calling capabilities
- ✅ Vision support (Sonnet only)
- ✅ Automatic retries with exponential backoff
- ✅ Rate limit handling
- ✅ Token counting (estimation)

## Installation

```bash
pnpm add @wukong/llm-anthropic @wukong/agent
```

## Usage

### Basic Usage

```typescript
import { ClaudeAdapter } from '@wukong/llm-anthropic';

const adapter = new ClaudeAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4.5-20241022' // or 'claude-haiku-4.5-20241022'
});

const response = await adapter.call('Hello, world!');
console.log(response.text);
```

### Streaming

```typescript
const response = await adapter.callWithStreaming('Tell me a story', {
  streaming: {
    onChunk: (chunk) => {
      process.stdout.write(chunk);
    },
    onComplete: (fullText) => {
      console.log('\n\nComplete!');
    },
  },
});
```

### Chat Format with System Messages

```typescript
const response = await adapter.callWithMessages([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the capital of France?' },
]);
```

### Configuration Options

```typescript
const adapter = new ClaudeAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4.5-20241022',
  temperature: 0.7,
  maxTokens: 8192,
  maxRetries: 3,
  timeout: 60000, // 60 seconds
});
```

## Available Models

### Claude Sonnet 4.5
- **Model ID**: `claude-sonnet-4.5-20241022`
- **Context Window**: 200K tokens
- **Best for**: Complex coding tasks, long-form content, vision tasks
- **Performance**: 82% on SWE-bench (best coding performance)

### Claude Haiku 4.5
- **Model ID**: `claude-haiku-4.5-20241022`
- **Context Window**: 200K tokens
- **Best for**: Fast responses, cost-effective tasks
- **Speed**: 2x faster than Sonnet
- **Cost**: ~1/3 of Sonnet cost

## API Reference

### `ClaudeAdapter`

Main adapter class implementing the `LLMAdapter` interface.

#### Constructor

```typescript
new ClaudeAdapter(config: ClaudeAdapterConfig)
```

#### Methods

- `call(prompt: string, options?: LLMCallOptions): Promise<LLMCallResponse>`
- `callWithMessages(messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMCallResponse>`
- `callWithStreaming(prompt: string, options: LLMCallOptions & { streaming: LLMStreamingOptions }): Promise<LLMCallResponse>`
- `countTokens(text: string): Promise<number>`
- `getCapabilities(): { maxTokens, supportsStreaming, supportsFunctionCalling, supportsVision }`
- `getClient(): Anthropic` - Get the underlying Anthropic SDK client
- `getConfig()` - Get current configuration

### `createClaudeAdapter`

Factory function to create a Claude adapter instance.

```typescript
const adapter = createClaudeAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4.5-20241022'
});
```

## Token Counting

Claude uses approximately 1 token per 3.5 characters. The adapter provides a rough estimation for token counting. For production use cases requiring precise token counting, consider using Anthropic's official token counting API.

## Error Handling

The adapter automatically retries on transient errors with exponential backoff. All API errors are wrapped with descriptive messages:

```typescript
try {
  const response = await adapter.call('Hello');
} catch (error) {
  console.error('Error:', error.message);
  // Example: "Claude API error (401): Invalid API key"
}
```

## Rate Limits

The adapter respects Anthropic's rate limits and includes retry logic. For high-volume applications, consider implementing additional rate limiting at the application level.

## Environment Variables

```bash
ANTHROPIC_API_KEY=your_api_key_here
```

## License

MIT

