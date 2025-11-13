# WukongEventEmitter

Type-safe event emitter for the Wukong Agent system, built on top of EventEmitter3.

## Features

- **Type-Safe Events**: All events are fully typed with TypeScript for compile-time safety
- **Error Handling**: Errors in one listener don't affect other listeners
- **Async Support**: Full support for async listeners with `emitAsync` method
- **Memory Management**: Proper cleanup with `destroy()` method and listener tracking
- **Custom Error Handlers**: Optional custom error handling for listener failures

## Usage

### Basic Event Listening

```typescript
import { createEventEmitter } from '@wukong/agent';

const emitter = createEventEmitter();

// Listen for events
emitter.on('step:started', (event) => {
  console.log('Step started:', event.step);
});

emitter.on('step:completed', (event) => {
  console.log('Step completed:', event.step);
});

// Emit events
emitter.emit({
  event: 'step:started',
  step: {
    id: 1,
    sessionId: 'session-123',
    stepNumber: 1,
    action: 'CallTool',
    status: 'running',
    // ... other step properties
  }
});
```

### One-Time Listeners

```typescript
emitter.once('task:completed', (event) => {
  console.log('Task completed (this will only fire once)');
});
```

### Async Event Emission

```typescript
// Wait for all async listeners to complete
await emitter.emitAsync({
  event: 'llm:complete',
  sessionId: 'session-123',
  stepId: 1,
  response: { /* ... */ }
});
```

### Removing Listeners

```typescript
const listener = (event) => {
  console.log('Event received');
};

emitter.on('step:started', listener);

// Remove specific listener
emitter.off('step:started', listener);

// Remove all listeners for an event
emitter.removeAllListeners('step:started');

// Remove all listeners for all events
emitter.removeAllListeners();
```

### Custom Error Handling

```typescript
const emitter = createEventEmitter({
  errorHandler: (error, event, listener) => {
    console.error(`Error in listener for ${event}:`, error);
    // Send to error tracking service, etc.
  }
});

emitter.on('step:started', (event) => {
  throw new Error('Oops!'); // Error will be caught and passed to errorHandler
});
```

### Cleanup

```typescript
// Clean up all listeners when done
emitter.destroy();
```

## Available Events

All event types are defined in `src/types/events.ts`. Major categories include:

- **Session Events**: `session:created`, `session:updated`, `session:deleted`, `session:resumed`
- **Step Events**: `step:started`, `step:completed`, `step:failed`, `steps:discarded`
- **Tool Events**: `tool:executing`, `tool:completed`, `tool:failed`, `tool:requiresConfirmation`
- **Async Tool Events**: `tool:async:submitted`, `tool:async:progress`, `tool:async:completed`
- **Parallel Tool Events**: `tools:parallel:submitted`, `tool:parallel:completed`, `tools:parallel:ready`
- **LLM Events**: `llm:started`, `llm:streaming`, `llm:complete`, `llm:failed`
- **Task Events**: `task:stopping`, `task:stopped`, `task:completed`, `task:failed`, `task:timeout`
- **Todo Events**: `todos:generated`, `todo:started`, `todo:completed`, `todo:failed`
- **Knowledge Events**: `knowledge:searched`, `knowledge:extracted`, `knowledge:indexed`
- **Sub-Agent Events**: `subagent:started`, `subagent:progress`, `subagent:completed`, `subagent:failed`
- **Error Events**: `error`, `error:recovered`
- **Debug Events**: `debug`

## Implementation Details

### Type Safety

The event emitter uses TypeScript generics to ensure:
- Event names are validated at compile time
- Event payloads match the expected structure for each event type
- Listener functions receive correctly typed event data

### Error Isolation

Errors in listeners are caught and handled separately, ensuring:
- One failing listener doesn't prevent other listeners from executing
- Synchronous and asynchronous errors are both handled
- Custom error handlers can be provided for logging/monitoring

### Listener Tracking

The emitter uses a `WeakMap` to track wrapped listeners, which:
- Allows proper removal of listeners with `off()`
- Prevents memory leaks by using weak references
- Maintains the relationship between original and wrapped functions

## Testing

The EventEmitter includes comprehensive tests covering:
- Basic event emission and listening
- Multiple listeners per event
- Once listeners
- Listener removal
- Synchronous error handling
- Asynchronous error handling
- Custom error handlers
- Async event emission
- Utility methods
- Memory management

Run tests with:
```bash
pnpm test packages/agent/src/__tests__/EventEmitter.test.ts
```

## API Reference

### Constructor Options

```typescript
interface EventEmitterOptions {
  maxListeners?: number; // Note: Not enforced by EventEmitter3
  errorHandler?: (error: Error, event: string, listener: Function) => void;
}
```

### Methods

- `on<T>(event: T, listener: EventListener<T>): void` - Register an event listener
- `once<T>(event: T, listener: EventListener<T>): void` - Register a one-time listener
- `off<T>(event: T, listener: EventListener<T>): void` - Remove an event listener
- `emit<T>(eventData: T): void` - Emit an event synchronously
- `emitAsync<T>(eventData: T): Promise<void>` - Emit an event and wait for all listeners
- `removeAllListeners(event?: string): void` - Remove all listeners
- `listenerCount(event: string): number` - Get listener count for an event
- `eventNames(): string[]` - Get all event names with listeners
- `listeners<T>(event: T): EventListener[]` - Get all listeners for an event
- `destroy(): void` - Clean up all resources

## Next Steps

The EventEmitter will be integrated into:
- `WukongAgent` main class (Task 2.14)
- `SessionManager` (Task 2.9)
- `StepExecutor` (Task 2.10)
- `ToolExecutor` (Task 3.2)
- All other agent components that need to emit events

