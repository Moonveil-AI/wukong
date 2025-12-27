/**
 * Default example prompts for Wukong agents
 */

import type { ExamplePrompt } from '../components/ExamplePrompts';

/**
 * Default example prompts for basic agent capabilities
 */
export const defaultExamplePrompts: ExamplePrompt[] = [
  {
    id: 'calc-example',
    title: 'Perform calculations',
    prompt: 'Calculate the result of 15 multiplied by 8, then add 42 to it',
    category: 'tools',
  },
  {
    id: 'multi-step',
    title: 'Multi-step reasoning',
    prompt: 'What is the square root of 144, then multiply it by 5, and finally subtract 10?',
    category: 'reasoning',
  },
  {
    id: 'explain',
    title: 'Explain capabilities',
    prompt: 'What can you help me with? What are your capabilities?',
    category: 'general',
  },
];

/**
 * Calculator-specific example prompts
 */
export const calculatorPrompts: ExamplePrompt[] = [
  {
    id: 'calc-basic',
    title: 'Basic arithmetic',
    prompt: 'What is 25 plus 17?',
    category: 'tools',
  },
  {
    id: 'calc-complex',
    title: 'Complex calculation',
    prompt: 'Calculate (100 - 35) divided by 5, then multiply by 3',
    category: 'tools',
  },
  {
    id: 'calc-chain',
    title: 'Chained operations',
    prompt: 'Start with 10, multiply by 4, subtract 15, then divide by 5',
    category: 'tools',
  },
];

