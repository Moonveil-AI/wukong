import type { Meta, StoryObj } from '@storybook/react';
import { StatusIndicator } from './StatusIndicator';

const meta: Meta<typeof StatusIndicator> = {
  title: 'Components/StatusIndicator',
  component: StatusIndicator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof StatusIndicator>;

export const Idle: Story = {
  args: {
    status: 'idle',
    message: 'Ready to help',
  },
};

export const Thinking: Story = {
  args: {
    status: 'thinking',
    message: 'Analyzing request...',
  },
};

export const Executing: Story = {
  args: {
    status: 'executing',
    message: 'Running tools...',
  },
};

export const Waiting: Story = {
  args: {
    status: 'waiting',
    message: 'Waiting for user input',
  },
};

export const Completed: Story = {
  args: {
    status: 'completed',
    message: 'Task finished successfully',
  },
};

export const Failed: Story = {
  args: {
    status: 'failed',
    message: 'Something went wrong',
  },
};

export const NoMessage: Story = {
  args: {
    status: 'executing',
  },
};
