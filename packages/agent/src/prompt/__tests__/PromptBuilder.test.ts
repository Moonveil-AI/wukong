/**
 * Tests for PromptBuilder
 */

import { describe, expect, it } from 'vitest';
import type { KnowledgeResult, Step, Tool } from '../../types/index.js';
import { PromptBuilder, type PromptContext } from '../PromptBuilder.js';

describe('PromptBuilder', () => {
  const mockTools: Tool[] = [
    {
      metadata: {
        name: 'generate_image',
        description: 'Generate images from text prompts',
        version: '1.0.0',
        category: 'media',
        riskLevel: 'low',
        timeout: 30,
        requiresConfirmation: false,
        async: false,
        estimatedTime: 10,
      },
      schema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Image prompt' },
          size: { type: 'string', enum: ['512x512', '1024x1024'] },
        },
        required: ['prompt'],
      },
      handler: async () => ({ success: true }),
    },
    {
      metadata: {
        name: 'analyze_data',
        description: 'Analyze data from various sources',
        version: '1.0.0',
        category: 'data',
        riskLevel: 'low',
        timeout: 60,
        requiresConfirmation: false,
        async: false,
        estimatedTime: 30,
      },
      schema: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          format: { type: 'string' },
        },
        required: ['source'],
      },
      handler: async () => ({ success: true }),
    },
  ];

  const mockHistory: Step[] = [
    {
      id: 1,
      sessionId: 'session-1',
      stepNumber: 1,
      action: 'CallTool',
      reasoning: 'Need to generate an image',
      selectedTool: 'generate_image',
      parameters: { prompt: 'a sunset', size: '1024x1024' },
      stepResult: 'Image generated successfully',
      status: 'completed',
      discarded: false,
      isParallel: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      sessionId: 'session-1',
      stepNumber: 2,
      action: 'AskUser',
      reasoning: 'Need user confirmation',
      stepResult: 'User approved',
      status: 'completed',
      discarded: true, // This step should be excluded
      isParallel: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockKnowledge: KnowledgeResult[] = [
    {
      id: 'kb-1',
      content: 'Image generation works best with detailed prompts.',
      score: 0.95,
      metadata: {
        source: 'knowledge_base.md',
        title: 'Image Generation Tips',
        level: 'public',
        createdAt: new Date(),
      },
    },
  ];

  describe('Constructor', () => {
    it('should create a builder with default options', () => {
      const builder = new PromptBuilder();
      expect(builder).toBeInstanceOf(PromptBuilder);
    });

    it('should create a builder with custom options', () => {
      const builder = new PromptBuilder({
        enableMCP: false,
        companyName: 'Test Corp',
        maxHistoryTokens: 3000,
        maxKnowledgeResults: 3,
      });
      expect(builder).toBeInstanceOf(PromptBuilder);
    });
  });

  describe('build', () => {
    it('should build a complete prompt for AutoAgent', () => {
      const builder = new PromptBuilder({ enableMCP: true });

      const context: PromptContext = {
        goal: 'Generate a beautiful sunset image',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: mockHistory,
        knowledge: mockKnowledge,
      };

      const prompt = builder.build(context);

      // Check for required sections
      expect(prompt).toContain('# Overview');
      expect(prompt).toContain('## Role');
      expect(prompt).toContain('## Available Actions');
      expect(prompt).toContain('# Step Management (Token Optimization)');
      expect(prompt).toContain('# Main Procedure');
      expect(prompt).toContain('IMPORTANT: AutoAgent Pattern');
      expect(prompt).toContain('# Output Format');
      expect(prompt).toContain('<final_output>');
      expect(prompt).toContain('# Current Context');
      expect(prompt).toContain('<goal_description>');
      expect(prompt).toContain('Generate a beautiful sunset image');
    });

    it('should build a complete prompt for InteractiveAgent', () => {
      const builder = new PromptBuilder({ enableMCP: true });

      const context: PromptContext = {
        goal: 'Create a data report',
        agentType: 'InteractiveAgent',
        autoRun: false,
        tools: mockTools,
        history: [],
      };

      const prompt = builder.build(context);

      // Check for InteractiveAgent specific content
      expect(prompt).toContain('IMPORTANT: InteractiveAgent Pattern');
      expect(prompt).toContain('After EVERY tool call');
      expect(prompt).toContain('AskUser');
    });

    it('should include tools in MCP mode', () => {
      const builder = new PromptBuilder({ enableMCP: true });

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: [],
      };

      const prompt = builder.build(context);

      // MCP mode should only include names and descriptions
      expect(prompt).toContain('Available Tools (MCP Mode)');
      expect(prompt).toContain('generate_image: Generate images from text prompts');
      expect(prompt).toContain('analyze_data: Analyze data from various sources');

      // Should NOT include full schemas in MCP mode
      expect(prompt).not.toContain('"properties"');
    });

    it('should include full tool schemas in traditional mode', () => {
      const builder = new PromptBuilder({ enableMCP: false });

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        enableMCP: false,
        tools: mockTools,
        history: [],
      };

      const prompt = builder.build(context);

      // Traditional mode should include full schemas
      expect(prompt).toContain('"name"');
      expect(prompt).toContain('"properties"');
      expect(prompt).toContain('"required"');
    });

    it('should include knowledge base results', () => {
      const builder = new PromptBuilder();

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: [],
        knowledge: mockKnowledge,
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('## Relevant Knowledge');
      expect(prompt).toContain('<knowledge>');
      expect(prompt).toContain('Image generation works best with detailed prompts');
      expect(prompt).toContain('Score: 0.95');
    });

    it('should include skills documentation', () => {
      const builder = new PromptBuilder();

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: [],
        skills: '# Excel Handler Skill\n\nHow to work with Excel files...',
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('## Matched Skills');
      expect(prompt).toContain('<skills>');
      expect(prompt).toContain('Excel Handler Skill');
    });

    it('should format history correctly', () => {
      const builder = new PromptBuilder();

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: mockHistory,
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('## Task History');
      expect(prompt).toContain('<history>');
      expect(prompt).toContain('Step 1');
      expect(prompt).toContain('generate_image');

      // Discarded steps should NOT appear
      expect(prompt).not.toContain('Step 2');
    });

    it('should handle empty history', () => {
      const builder = new PromptBuilder();

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: [],
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('No previous steps');
    });

    it('should include latest step if provided', () => {
      const builder = new PromptBuilder();

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: [],
        latestStep: 'Generated image successfully with URL: https://...',
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('## Latest Step');
      expect(prompt).toContain('<latest_step>');
      expect(prompt).toContain('Generated image successfully');
    });

    it('should include company name', () => {
      const builder = new PromptBuilder({ companyName: 'Acme Corp' });

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: [],
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('You work at Acme Corp');
    });

    it('should include all available actions for AutoAgent', () => {
      const builder = new PromptBuilder();

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: [],
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('CallTool: Invoke a single tool');
      expect(prompt).toContain('CallToolsParallel: Execute multiple tools');
      expect(prompt).toContain('ForkAutoAgent: Create a sub-agent');
      expect(prompt).toContain('Plan: Show execution plan');
      expect(prompt).toContain('Finish: Complete the task');

      // AutoAgent should NOT have AskUser in Available Actions section
      const actionsSection = prompt.match(/## Available Actions\n\n([\s\S]*?)\n\n---/)?.[1] || '';
      expect(actionsSection).not.toContain('AskUser');
    });

    it('should include AskUser action for InteractiveAgent', () => {
      const builder = new PromptBuilder();

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'InteractiveAgent',
        autoRun: false,
        tools: mockTools,
        history: [],
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('AskUser: Ask user for clarification');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate token count for a prompt', () => {
      const builder = new PromptBuilder();

      const text =
        'This is a test prompt with approximately 100 characters to estimate the token count accurately.';
      const tokens = builder.estimateTokens(text);

      // Rough estimate: ~4 characters per token
      expect(tokens).toBeGreaterThan(20);
      expect(tokens).toBeLessThan(30);
    });
  });

  describe('buildMinimal', () => {
    it('should build a minimal prompt', () => {
      const builder = new PromptBuilder();

      const prompt = builder.buildMinimal('Generate an image', mockTools);

      expect(prompt).toContain('You are an AI agent');
      expect(prompt).toContain('# Goal');
      expect(prompt).toContain('Generate an image');
      expect(prompt).toContain('# Available Tools');
      expect(prompt).toContain('generate_image');
      expect(prompt).toContain('# Output Format');

      // Should be much shorter than full prompt
      expect(prompt.length).toBeLessThan(1000);
    });
  });

  describe('Tool selection guidelines', () => {
    it('should group tools by category', () => {
      const builder = new PromptBuilder();

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: [],
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('# Tool Selection Guidelines');
      expect(prompt).toContain('## Media Tools');
      expect(prompt).toContain('## Data Tools');
    });

    it('should include general guidelines', () => {
      const builder = new PromptBuilder();

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: [],
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('## General Guidelines');
      expect(prompt).toContain('User-specified tool');
      expect(prompt).toContain('Error handling');
      expect(prompt).toContain('Parallel execution');
    });
  });

  describe('Token optimization features', () => {
    it('should include step discarding instructions', () => {
      const builder = new PromptBuilder();

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: [],
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('# Step Management (Token Optimization)');
      expect(prompt).toContain('## Always Keep in Full');
      expect(prompt).toContain('## 1. Discard (Complete Removal)');
      expect(prompt).toContain('"discardable_steps": [2, 5, 8]');
    });

    it('should filter out discarded steps from history', () => {
      const builder = new PromptBuilder();

      const history: Step[] = [
        {
          id: 1,
          sessionId: 'test',
          stepNumber: 1,
          action: 'CallTool',
          status: 'completed',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          sessionId: 'test',
          stepNumber: 2,
          action: 'CallTool',
          status: 'completed',
          discarded: true, // Should be filtered out
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 3,
          sessionId: 'test',
          stepNumber: 3,
          action: 'Finish',
          status: 'completed',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history,
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('Step 1');
      expect(prompt).toContain('Step 3');
      expect(prompt).not.toContain('Step 2');
    });
  });

  describe('MCP mode vs Traditional mode', () => {
    it('should produce significantly shorter prompts in MCP mode', () => {
      const mcpBuilder = new PromptBuilder({ enableMCP: true });
      const traditionalBuilder = new PromptBuilder({ enableMCP: false });

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: [],
      };

      const mcpPrompt = mcpBuilder.build({ ...context, enableMCP: true });
      const traditionalPrompt = traditionalBuilder.build({ ...context, enableMCP: false });

      const mcpTokens = mcpBuilder.estimateTokens(mcpPrompt);
      const traditionalTokens = traditionalBuilder.estimateTokens(traditionalPrompt);

      // MCP mode should use significantly fewer tokens
      expect(mcpTokens).toBeLessThan(traditionalTokens);
    });
  });

  describe('Communication style', () => {
    it('should include concise communication guidelines', () => {
      const builder = new PromptBuilder();

      const context: PromptContext = {
        goal: 'Test goal',
        agentType: 'AutoAgent',
        autoRun: true,
        tools: mockTools,
        history: [],
      };

      const prompt = builder.build(context);

      expect(prompt).toContain('# Concise Communication Style');
      expect(prompt).toContain('Be extremely concise');
      expect(prompt).toContain('Provide options rather than open-ended questions');
    });
  });
});
