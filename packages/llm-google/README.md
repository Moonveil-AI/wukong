# @wukong/llm-google

Google Gemini LLM adapter for the Wukong Agent framework.

## Features

- ✅ Support for **Gemini 2.5 Pro** (latest, 2M context window, 40% faster inference)
- ✅ Support for Gemini 2.0 Flash (1M context window)
- ✅ Support for Gemini 2.0 Pro (2M context window)
- ✅ Streaming responses
- ✅ Token counting
- ✅ Automatic retries with exponential backoff
- ✅ Rate limit handling
- ✅ Enhanced multimodal support (text, images, audio, video, code)
- ✅ Function calling support
- ✅ Superior coding capabilities

## Installation

```bash
pnpm add @wukong/llm-google
```

## Usage

### Basic Usage

```typescript
import { createGeminiAdapter } from '@wukong/llm-google';

const adapter = createGeminiAdapter({
  apiKey: process.env.GOOGLE_AI_API_KEY!,
  model: 'gemini-2.5-pro' // Latest and most capable model
});

const response = await adapter.call('Hello, world!');
console.log(response.text);
```

### With Streaming

```typescript
const response = await adapter.callWithStreaming('Explain quantum computing', {
  streaming: {
    onChunk: (chunk) => {
      process.stdout.write(chunk);
    },
    onComplete: (fullText) => {
      console.log('\n\nComplete!');
    },
    onError: (error) => {
      console.error('Stream error:', error);
    }
  }
});
```

### With Messages (Chat Format)

```typescript
const response = await adapter.callWithMessages([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the capital of France?' },
  { role: 'assistant', content: 'The capital of France is Paris.' },
  { role: 'user', content: 'What about Italy?' }
]);
```

### Token Counting

```typescript
const tokenCount = await adapter.countTokens('Hello, world!');
console.log(`Token count: ${tokenCount}`);
```

### Model Capabilities

```typescript
const capabilities = adapter.getCapabilities();
console.log(capabilities);
// {
//   maxTokens: 1000000,
//   supportsStreaming: true,
//   supportsFunctionCalling: true,
//   supportsVision: true
// }
```

## Configuration

```typescript
interface GeminiAdapterConfig {
  /** Google AI API key (required) */
  apiKey: string;

  /** Default model to use (default: 'gemini-2.5-pro') */
  model?: string;

  /** Default temperature (default: 0.7) */
  temperature?: number;

  /** Default max tokens (default: 8192) */
  maxTokens?: number;

  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;

  /** Timeout in milliseconds (default: 60000) */
  timeout?: number;

  /** Base URL for custom endpoints */
  baseURL?: string;
}
```

## Supported Models

### Recommended (Latest)
- `gemini-2.5-pro` ⭐ - **Gemini 2.5 Pro** (2M context, latest, 40% faster inference, 25% higher accuracy)

### Gemini 2.0 Series
- `gemini-2.0-flash-exp` - Gemini 2.0 Flash (1M context, fast, experimental)
- `gemini-2.0-pro-exp` - Gemini 2.0 Pro (2M context, experimental)

### Gemini 2.5 Pro Highlights
- **40% faster inference** compared to previous versions
- **25% higher accuracy** in reasoning tasks
- **Enhanced coding capabilities** - Surpasses Opus 4 in programming benchmarks
- **Superior multimodal understanding** - Native support for text, images, audio, video, and code
- **Optimized for Chinese** - Improved understanding and generation for Chinese language tasks
- **200万 tokens 上下文** - 可处理约 1500 页文档或 3 小时以上的视频内容

## API Reference

### Methods

#### `call(prompt: string, options?: LLMCallOptions): Promise<LLMCallResponse>`

Call the LLM with a simple prompt.

#### `callWithMessages(messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMCallResponse>`

Call the LLM with a chat message history.

#### `callWithStreaming(prompt: string, options: LLMCallOptions & { streaming: LLMStreamingOptions }): Promise<LLMCallResponse>`

Call the LLM with streaming enabled.

#### `countTokens(text: string): Promise<number>`

Count tokens in a text using Gemini's token counting API.

#### `getCapabilities()`

Get model capabilities (context window size, features, etc.).

## License

MIT

