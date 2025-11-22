import type { Meta, StoryObj } from '@storybook/react';
import { ThinkingBox } from './ThinkingBox';

const meta: Meta<typeof ThinkingBox> = {
  title: 'Components/ThinkingBox',
  component: ThinkingBox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ThinkingBox>;

const sampleThinking = `# Analysis

I will approach this problem by analyzing the available data.

## Steps
1. Retrieve data
2. Process data
3. Generate report

I need to check if the *cache* is valid.
`;

export const Default: Story = {
  args: {
    thinking: sampleThinking,
    streaming: false,
  },
};

export const Streaming: Story = {
  args: {
    thinking: sampleThinking,
    streaming: true,
  },
};

export const AutoScroll: Story = {
  args: {
    thinking: `${sampleThinking + '\n'.repeat(20)}New content at the bottom`,
    streaming: true,
    autoScroll: true,
    maxHeight: 200,
  },
};

export const Empty: Story = {
  args: {
    thinking: '',
    streaming: true,
  },
};
