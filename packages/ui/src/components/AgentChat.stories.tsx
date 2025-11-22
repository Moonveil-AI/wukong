import type { Meta, StoryObj } from '@storybook/react';
import { AgentChat } from './AgentChat';

const meta: Meta<typeof AgentChat> = {
  title: 'Components/AgentChat',
  component: AgentChat,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AgentChat>;

const defaultConfig = {
  name: 'Assistant',
  role: 'Helpful AI Assistant',
  capabilities: [
    {
      category: 'Reasoning',
      can: ['Multi-step planning', 'Context retention'],
      cannot: ['Real-time web browsing'],
    },
  ],
};

export const Default: Story = {
  args: {
    config: defaultConfig,
    theme: 'light',
  },
};

export const DarkMode: Story = {
  args: {
    config: defaultConfig,
    theme: 'dark',
  },
};

export const WithHistory: Story = {
  args: {
    config: defaultConfig,
    initialMessages: [
      {
        id: '1',
        role: 'user',
        content: 'How do I use the Wukong Agent?',
        timestamp: Date.now() - 100000,
      },
      {
        id: '2',
        role: 'assistant',
        content:
          'You can use the Wukong Agent by importing the AgentChat component and providing a configuration.',
        timestamp: Date.now() - 90000,
        thinking: 'User asked about usage -> Retrieving docs -> Formulating answer',
      },
    ],
  },
};

export const MobileLayout: Story = {
  args: {
    config: defaultConfig,
    layout: {
      mobile: 'stack',
      tablet: 'stack',
      desktop: 'stack',
    },
    initialMessages: WithHistory.args?.initialMessages,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};
