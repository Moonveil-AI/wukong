/**
 * Prompt Builder for constructing structured prompts for LLM
 *
 * This module builds complete prompts from context, including:
 * - System instructions
 * - Tools list (MCP mode or traditional)
 * - Knowledge snippets
 * - History (excluding discarded steps)
 * - Examples
 */

import type { ActionType, KnowledgeResult, Step, Tool } from '../types/index.js';

/**
 * Prompt context for building the complete prompt
 */
export interface PromptContext {
  /** Task goal */
  goal: string;

  /** Agent type */
  agentType: 'InteractiveAgent' | 'AutoAgent';

  /** Company/organization name */
  companyName?: string;

  /** Available tools */
  tools: Tool[];

  /** Conversation history */
  history: Step[];

  /** Relevant knowledge snippets */
  knowledge?: KnowledgeResult[];

  /** Latest step result */
  latestStep?: string;

  /** Skills documentation (if matched) */
  skills?: string;

  /** Enable Tool Executor mode */
  enableToolExecutor?: boolean;

  /** Auto-run mode */
  autoRun: boolean;

  /** Additional context */
  additionalContext?: Record<string, any>;
}

/**
 * Prompt builder options
 */
export interface PromptBuilderOptions {
  /** Enable Tool Executor mode (local validation, reduced tokens) */
  enableToolExecutor?: boolean;

  /** Company name for context */
  companyName?: string;

  /** Maximum tokens for history */
  maxHistoryTokens?: number;

  /** Maximum knowledge results to include */
  maxKnowledgeResults?: number;
}

/**
 * Builds structured prompts for LLM
 */
export class PromptBuilder {
  private options: Required<PromptBuilderOptions>;

  constructor(options: PromptBuilderOptions = {}) {
    this.options = {
      enableToolExecutor: options.enableToolExecutor ?? true,
      companyName: options.companyName ?? 'Your Organization',
      maxHistoryTokens: options.maxHistoryTokens ?? 5000,
      maxKnowledgeResults: options.maxKnowledgeResults ?? 5,
    };
  }

  /**
   * Build complete prompt from context
   */
  build(context: PromptContext): string {
    const enableToolExecutor = context.enableToolExecutor ?? this.options.enableToolExecutor;

    const sections = [
      this.buildOverviewSection(context),
      this.buildRoleSection(),
      this.buildAvailableActionsSection(context.agentType),
      this.buildDiscardingStepsSection(),
      this.buildMainProcedureSection(context.agentType),
      this.buildOutputFormatSection(),
      this.buildCommunicationStyleSection(),
      this.buildToolSelectionGuidelinesSection(context.tools),
      this.buildCurrentContextSection(context, enableToolExecutor),
    ];

    return sections.filter(Boolean).join('\n\n---\n\n');
  }

  /**
   * Build overview section
   */
  private buildOverviewSection(context: PromptContext): string {
    const companyName = context.companyName || this.options.companyName;

    return `# Overview

## Your Company
You work at ${companyName}. Your role is to help users accomplish their goals using available tools.`;
  }

  /**
   * Build role section
   */
  private buildRoleSection(): string {
    return `## Role
You are an AI Agent that can:
- Understand user goals
- Search knowledge base for relevant information
- Select and invoke appropriate tools
- Execute tasks step by step
- Learn from conversation history`;
  }

  /**
   * Build available actions section
   */
  private buildAvailableActionsSection(agentType: 'InteractiveAgent' | 'AutoAgent'): string {
    const actions: ActionType[] =
      agentType === 'InteractiveAgent'
        ? ['CallTool', 'CallToolsParallel', 'ForkAutoAgent', 'AskUser', 'Plan', 'Finish']
        : ['CallTool', 'CallToolsParallel', 'ForkAutoAgent', 'Plan', 'Finish'];

    // Action descriptions match ActionType enum (PascalCase by design)
    const actionDescriptions: Record<ActionType, string> = {
      // biome-ignore lint/style/useNamingConvention: Object keys match TypeScript ActionType enum
      CallTool: 'Invoke a single tool',
      // biome-ignore lint/style/useNamingConvention: Object keys match TypeScript ActionType enum
      CallToolsParallel: 'Execute multiple tools simultaneously',
      // biome-ignore lint/style/useNamingConvention: Object keys match TypeScript ActionType enum
      ForkAutoAgent: 'Create a sub-agent for complex sub-tasks',
      // biome-ignore lint/style/useNamingConvention: Object keys match TypeScript ActionType enum
      AskUser: 'Ask user for clarification (InteractiveAgent only)',
      // biome-ignore lint/style/useNamingConvention: Object keys match TypeScript ActionType enum
      Plan: 'Show execution plan',
      // biome-ignore lint/style/useNamingConvention: Object keys match TypeScript ActionType enum
      Finish: 'Complete the task',
    };

    const actionsList = actions
      .map((action) => `- ${action}: ${actionDescriptions[action]}`)
      .join('\n');

    return `## Available Actions

${actionsList}`;
  }

  /**
   * Build step management section (discard & compress)
   */
  private buildDiscardingStepsSection(): string {
    return `# Step Management (Token Optimization)

You can optimize steps in two ways to save tokens:

## 1. Discard (Complete Removal)
✅ Discard these:
- Confirmation steps with no new information ("OK", "I understand")
- Drafts that were rejected and replaced
- Errors that were immediately corrected
- Purely procedural steps with no useful data

## 2. Compress (Preserve Key Info)
✅ Compress these:
- Verbose tool outputs (keep only key results)
- Long user explanations (keep only requirements)
- Detailed analyses (keep only conclusions)
- Multi-paragraph responses (keep only action items)

## Always Keep in Full
❌ Never discard or compress:
- User's original goal and requirements
- Final effective solutions
- Error patterns that may reoccur
- Last 5 steps (maintain immediate context)
- Steps with unique insights or decisions

## How to Optimize
In your response, include:
- "discardable_steps": [2, 5, 8] - IDs of steps to remove completely
- "compressed_steps": [
    { "step_id": 8, "compressed": "Brief summary of step 8" },
    { "step_id": 12, "compressed": "Key points from step 12" }
  ]`;
  }

  /**
   * Build main procedure section
   */
  private buildMainProcedureSection(agentType: 'InteractiveAgent' | 'AutoAgent'): string {
    if (agentType === 'AutoAgent') {
      return `# Main Procedure

## IMPORTANT: AutoAgent Pattern

1. **First Step: ALWAYS search knowledge base**
   - action = "CallTool"
   - selected_tool = "SEARCH_KNOWLEDGE"
   - parameters = { "query_text": "relevant keywords from goal" }

2. **Subsequent Steps: Execute tools autonomously**
   - No AskUser actions
   - Continue until task completion or timeout
   - Use parallel execution when possible

3. **Use parallel execution when beneficial:**
   - Multiple similar tasks → CallToolsParallel
   - Complex independent sub-tasks → ForkAutoAgent

4. **Complete the task:**
   - When goal is achieved, use Finish action
   - Include summary and final result`;
    }
    return `# Main Procedure

## IMPORTANT: InteractiveAgent Pattern

After EVERY tool call, you MUST:
1. Call the tool: action = "CallTool"
2. Then ask user: action = "AskUser"

This gives users a chance to:
- Review the result
- Provide feedback
- Change direction
- Continue or stop

Example sequence:
- Step 1: CallTool (generate_image)
- Step 2: AskUser ("I've generated the image. Does it look good? Should I proceed?")
- Step 3: [User confirms]
- Step 4: CallTool (next_action)`;
  }

  /**
   * Build output format section
   */
  private buildOutputFormatSection(): string {
    return `# Output Format

Your response MUST be valid JSON wrapped in XML tags:

<final_output>
{
  "action": "CallTool" | "CallToolsParallel" | "ForkAutoAgent" | "AskUser" | "Plan" | "Finish",
  "reasoning": "One sentence explanation of why you're taking this action",
  "selected_tool": "tool_name",  // For CallTool
  "parallel_tools": [  // For CallToolsParallel
    {
      "tool_name": "TOOL_NAME",
      "parameters": {...},
      "tool_id": "unique_id"
    }
  ],
  "wait_strategy": "all" | "any" | "majority",  // For CallToolsParallel
  "parameters": {
    "param1": "value1"
  },
  "discardable_steps": [2, 5, 8],  // Optional: steps to discard completely
  "compressed_steps": [  // Optional: steps to compress
    {
      "step_id": 8,
      "compressed": "Brief summary of step 8"
    }
  ],
  "message_to_user": "Human-readable message",  // For AskUser, Plan, or Finish
  "options": ["option1", "option2"]  // For AskUser: provide clear options
}
</final_output>`;
  }

  /**
   * Build communication style section
   */
  private buildCommunicationStyleSection(): string {
    return `# Concise Communication Style

- Be extremely concise
- Provide options rather than open-ended questions
- Don't repeat tool results to the user
- Only ask questions when absolutely necessary`;
  }

  /**
   * Build tool selection guidelines section
   */
  private buildToolSelectionGuidelinesSection(tools: Tool[]): string {
    // Group tools by category for better organization
    const categories = new Map<string, Tool[]>();
    for (const tool of tools) {
      const category = tool.metadata.category || 'other';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)?.push(tool);
    }

    let guidelines = '# Tool Selection Guidelines\n\n';

    // Add category-specific guidelines when there are multiple categories
    if (categories.size > 1) {
      for (const [category, categoryTools] of categories) {
        guidelines += `## ${category.charAt(0).toUpperCase() + category.slice(1)} Tools\n\n`;

        // List tools in this category
        for (const tool of categoryTools) {
          guidelines += `- **${tool.metadata.name}**: ${tool.metadata.description}\n`;
        }
        guidelines += '\n';
      }
    }

//1. **User-specified tool**: If user specifies a tool, use that tool

    // Add general guidelines
    guidelines += `## General Guidelines

1. **User-specified tool**: If user specifies a tool, try to use that tool, but it's not required, if you think you don't have to use tools, then just use regular LLM calls.
2. **Read documentation carefully**: Check tool parameters and requirements
3. **Error handling**: If a tool fails, read the error and adjust parameters
4. **Parallel execution**: Use CallToolsParallel for independent tasks
5. **Sub-agents**: Use ForkAutoAgent for complex sub-tasks that can run independently`;

    return guidelines;
  }

  /**
   * Build current context section
   */
  private buildCurrentContextSection(context: PromptContext, enableToolExecutor: boolean): string {
    const sections: string[] = [];

    // Task goal
    sections.push(`## Task Goal
<goal_description>
${context.goal}
</goal_description>`);

    // Available tools
    sections.push(this.formatToolsSection(context.tools, enableToolExecutor));

    // Relevant knowledge
    if (context.knowledge && context.knowledge.length > 0) {
      sections.push(this.formatKnowledgeSection(context.knowledge));
    }

    // Matched skills
    if (context.skills) {
      sections.push(this.formatSkillsSection(context.skills));
    }

    // Task history
    sections.push(this.formatHistorySection(context.history));

    // Latest step
    if (context.latestStep) {
      sections.push(`## Latest Step
<latest_step>
${context.latestStep}
</latest_step>`);
    }

    sections.push('Now, decide the next action.');

    return `# Current Context\n\n${sections.join('\n\n')}`;
  }

  /**
   * Format tools section
   */
  private formatToolsSection(tools: Tool[], enableToolExecutor: boolean): string {
    if (enableToolExecutor) {
      // Tool Executor mode: only tool names and brief descriptions
      const toolsList = tools
        .map((tool) => `- ${tool.metadata.name}: ${tool.metadata.description}`)
        .join('\n');

      return `## Available Tools (Tool Executor Mode)
<all_tool_list>
${toolsList}
</all_tool_list>`;
    }
    // Traditional mode: full schemas
    const toolsJSON = tools.map((tool) => ({
      name: tool.metadata.name,
      description: tool.metadata.description,
      parameters: tool.schema,
    }));

    return `## Available Tools
<all_tool_list>
${JSON.stringify(toolsJSON, null, 2)}
</all_tool_list>`;
  }

  /**
   * Format knowledge section
   */
  private formatKnowledgeSection(knowledge: KnowledgeResult[]): string {
    const maxResults = Math.min(knowledge.length, this.options.maxKnowledgeResults);
    const topResults = knowledge.slice(0, maxResults);

    const knowledgeText = topResults
      .map((result, index) => {
        const source = result.metadata.source || 'Unknown source';
        return `### Result ${index + 1} (Score: ${result.score.toFixed(2)})
Source: ${source}

${result.content}`;
      })
      .join('\n\n');

    return `## Relevant Knowledge
<knowledge>
${knowledgeText}
</knowledge>`;
  }

  /**
   * Format skills section
   */
  private formatSkillsSection(skills: string): string {
    return `## Matched Skills
<skills>
${skills}
</skills>`;
  }

  /**
   * Format history section
   */
  private formatHistorySection(history: Step[]): string {
    if (history.length === 0) {
      return `## Task History
<history>
No previous steps.
</history>`;
    }

    // Filter out discarded steps
    const activeSteps = history.filter((step) => !step.discarded);

    // Format each step
    const formattedSteps = activeSteps.map((step) => {
      // If step has compressed content, use that instead
      if (step.compressedContent) {
        return `### Step ${step.stepNumber} [COMPRESSED]

${step.compressedContent}`;
      }

      // Otherwise, show full step details
      let stepText = `### Step ${step.stepNumber}

**Action**: ${step.action}`;

      if (step.reasoning) {
        stepText += `\n**Reasoning**: ${step.reasoning}`;
      }

      if (step.selectedTool) {
        stepText += `\n**Tool**: ${step.selectedTool}`;
      }

      if (step.parameters) {
        stepText += `\n**Parameters**: ${JSON.stringify(step.parameters, null, 2)}`;
      }

      if (step.stepResult) {
        // Truncate long results
        const maxResultLength = 500;
        const result =
          step.stepResult.length > maxResultLength
            ? `${step.stepResult.substring(0, maxResultLength)}...`
            : step.stepResult;
        stepText += `\n**Result**: ${result}`;
      }

      if (step.errorMessage) {
        stepText += `\n**Error**: ${step.errorMessage}`;
      }

      if (step.status === 'failed') {
        stepText += '\n**Status**: FAILED';
      }

      return stepText;
    });

    const historyText = formattedSteps.join('\n\n');

    return `## Task History
<history>
${historyText}
</history>`;
  }

  /**
   * Estimate token count for a prompt
   * This is a rough estimate: ~4 characters per token
   */
  estimateTokens(prompt: string): number {
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Build a minimal prompt for quick queries
   */
  buildMinimal(goal: string, tools: Tool[]): string {
    const toolsList = tools
      .map((tool) => `- ${tool.metadata.name}: ${tool.metadata.description}`)
      .join('\n');

    return `You are an AI agent. Use available tools to accomplish the goal.

# Goal
${goal}

# Available Tools
${toolsList}

# Output Format
Respond with JSON in <final_output> tags:
{
  "action": "CallTool" | "Finish",
  "reasoning": "Brief explanation",
  "selected_tool": "tool_name",
  "parameters": {...}
}

Now, decide the next action.`;
  }
}

/**
 * Helper function to create a prompt builder
 */
export function createPromptBuilder(options?: PromptBuilderOptions): PromptBuilder {
  return new PromptBuilder(options);
}
