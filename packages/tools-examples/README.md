# @wukong/tools-examples

Example tools for Wukong Agent demonstrations and examples.

## Installation

```bash
pnpm add @wukong/tools-examples
```

## Usage

```typescript
import { WukongAgent } from '@wukong/agent';
import { calculatorTool } from '@wukong/tools-examples';

const agent = new WukongAgent({
  adapter,
  llm,
  tools: [calculatorTool]
});
```

## Available Tools

### Calculator

Performs basic mathematical operations:
- add
- subtract
- multiply
- divide

```typescript
import { calculatorTool } from '@wukong/tools-examples';
```

## License

MIT

