import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/agent',
  'packages/llm-openai',
  'packages/llm-google',
  'packages/adapter-vercel',
  'packages/adapter-local',
  'packages/documents',
  'packages/embeddings',
  'packages/ui',
]);
