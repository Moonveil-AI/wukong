import type { Meta, StoryObj } from '@storybook/react';
import { CapabilitiesPanel } from './CapabilitiesPanel';

const meta: Meta<typeof CapabilitiesPanel> = {
  title: 'Components/CapabilitiesPanel',
  component: CapabilitiesPanel,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CapabilitiesPanel>;

const exampleCapabilities = [
  {
    category: 'Code Generation',
    can: ['Generate React components', 'Write unit tests', 'Refactor code'],
    cannot: ['Deploy to production directly', 'Access private keys'],
  },
  {
    category: 'Data Analysis',
    can: ['Parse CSV files', 'Generate charts'],
    cannot: ['Access real-time stock market data'],
  },
];

export const Default: Story = {
  args: {
    capabilities: exampleCapabilities,
    collapsible: true,
    showLimitations: true,
  },
};

export const Expanded: Story = {
  args: {
    ...Default.args,
    collapsible: false,
  },
};

export const GridStyle: Story = {
  args: {
    ...Default.args,
    style: 'grid',
    collapsible: false,
  },
};

export const NoLimitations: Story = {
  args: {
    ...Default.args,
    showLimitations: false,
  },
};
