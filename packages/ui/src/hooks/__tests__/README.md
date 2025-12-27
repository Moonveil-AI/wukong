# Bug Fixes Summary

## Overview

This directory contains documentation and tests for critical bug fixes in the `useWukongClient` hook.

## Fixed Bugs

### 1. Duplicate Event Handlers (2025-12-27)
- **Symptom**: Streaming text duplicated (`<final<final...`)
- **Root Cause**: Event listeners not cleaned up on unmount
- **Fix**: Added `client.off(handleEvent)` in cleanup function
- **Test**: `useWukongClient.test.ts` - Bug Fix #1
- **Manual Test**: See `MANUAL_TESTING.md` - Bug #1

### 2. Multi-turn History Restoration (2025-12-27)
- **Symptom**: Only first conversation turn shown after refresh
- **Root Cause**: Only extracted first goal from history
- **Fix**: Track goal changes and create user messages for each new goal
- **Test**: `useWukongClient.test.ts` - Bug Fix #2
- **Manual Test**: See `MANUAL_TESTING.md` - Bug #2

### 3. Step Details in History (2025-12-27)
- **Symptom**: Only final answer shown after refresh, no intermediate steps
- **Root Cause**: Only displayed Finish steps, ignored intermediate steps
- **Fix**: Show reasoning, action, tool, and results for all steps
- **Test**: `useWukongClient.test.ts` - Bug Fix #3
- **Manual Test**: See `MANUAL_TESTING.md` - Bug #3

### 4. Step Separation in Real-time (2025-12-27)
- **Symptom**: All steps appeared in one continuous stream
- **Root Cause**: No handling of `step:completed` events
- **Fix**: Listen to `step:completed` and create new message for each step
- **Test**: Manual testing only (see MANUAL_TESTING.md)
- **Manual Test**: See `MANUAL_TESTING.md` - Bug #4

## Testing Strategy

### Automated Tests
- Located in: `useWukongClient.test.ts`
- Run with: `pnpm test`
- **Note**: Currently experiencing Vitest memory issues, manual testing recommended

### Manual Testing
- Full manual test guide: `MANUAL_TESTING.md`
- Required for release validation
- Covers all 4 bug fixes with step-by-step instructions

## Files

- `README.md` - This file, overview of bug fixes
- `useWukongClient.test.ts` - Automated unit tests (3 tests for 3 bugs)
- `MANUAL_TESTING.md` - Comprehensive manual testing guide

## Before Releasing

1. Read `MANUAL_TESTING.md`
2. Execute all 4 manual test scenarios
3. Verify no regression
4. Check browser console for errors
5. Test both SSE and WebSocket transports

## Developer Notes

When modifying `useWukongClient.ts`:

1. **Always** clean up event listeners in `useEffect` return
2. **Track** goal changes when restoring history
3. **Display** all intermediate steps, not just final answer
4. **Separate** steps with `step:completed` event handling
5. **Test** manually before committing

## Quick Reference

```typescript
// ✅ Correct cleanup
useEffect(() => {
  const handleEvent = (event: AgentEvent) => { /* ... */ };
  client.on(handleEvent);
  
  return () => {
    client.off(handleEvent);  // Critical!
    client.disconnect();
  };
}, []);

// ✅ Correct history restoration
for (const step of history) {
  const currentGoal = extractGoalFromPrompt(step.llmPrompt);
  if (currentGoal && currentGoal !== lastGoal) {
    // Add user message for new goal
    lastGoal = currentGoal;  // Track changes!
  }
  
  // Process ALL steps, not just Finish
  if (step.action === 'Finish') {
    // Show user-friendly message
  } else {
    // Show reasoning, action, tool, result
  }
}

// ✅ Correct step separation
case 'step:completed':
  const newMessage = { /* ... */ };
  setMessages(prev => [...prev, newMessage]);
  currentMessageIdRef.current = newMessage.id;
  break;
```

##重要提醒

这些 bug 修复非常关键，直接影响用户体验：
- Bug #1: 影响所有实时对话
- Bug #2: 影响会话恢复功能
- Bug #3: 影响透明度和可解释性
- Bug #4: 影响实时 UI 展示

**请在修改 `useWukongClient.ts` 前仔细阅读此文档！**
