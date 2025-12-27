/**
 * Utility functions to parse agent output containing <final_output> tags
 */

export interface ParsedAgentOutput {
  action: 'CallTool' | 'Finish' | 'AskUser' | string;
  reasoning?: string;
  selectedTool?: string;
  parameters?: Record<string, any>;
  messageToUser?: string;
}

export interface ParsedMessage {
  rawText: string;
  outputs: ParsedAgentOutput[];
  displayText: string;
}

/**
 * Convert snake_case keys to camelCase
 * The agent outputs JSON with snake_case (e.g., message_to_user, selected_tool)
 * but our TypeScript interface uses camelCase
 */
function normalizeOutput(parsed: Record<string, any>): ParsedAgentOutput {
  return {
    action: parsed['action'],
    reasoning: parsed['reasoning'],
    selectedTool: parsed['selected_tool'] ?? parsed['selectedTool'],
    parameters: parsed['parameters'],
    messageToUser: parsed['message_to_user'] ?? parsed['messageToUser'],
  };
}

/**
 * Parse message content containing <final_output> tags
 * @param content - The message content to parse
 * @returns Parsed message with extracted outputs
 */
export function parseAgentOutput(content: string): ParsedMessage {
  const finalOutputRegex = /<final_output>\s*([\s\S]*?)\s*<\/final_output>/g;
  const outputs: ParsedAgentOutput[] = [];

  // Extract all final_output blocks
  for (
    let match = finalOutputRegex.exec(content);
    match !== null;
    match = finalOutputRegex.exec(content)
  ) {
    try {
      const jsonStr = match[1]?.trim();
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        // Normalize snake_case keys to camelCase
        outputs.push(normalizeOutput(parsed));
      }
    } catch (error) {
      console.error('Failed to parse final_output JSON:', error);
    }
  }

  // Remove final_output tags from display text
  const displayText = content.replace(finalOutputRegex, '').trim();

  return {
    rawText: content,
    outputs,
    displayText,
  };
}

/**
 * Format a parsed output into a readable message
 * @param output - The parsed output to format
 * @returns Formatted string
 */
export function formatAgentOutput(output: ParsedAgentOutput): string {
  const parts: string[] = [];

  // Add the user message if present
  if (output.messageToUser) {
    parts.push(output.messageToUser);
  }

  // Add tool execution info
  if (output.action === 'CallTool' && output.selectedTool) {
    parts.push(`\n🔧 Using tool: ${output.selectedTool}`);

    if (output.parameters) {
      const paramStr = Object.entries(output.parameters)
        .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
        .join('\n');
      parts.push(`Parameters:\n${paramStr}`);
    }
  }

  // Add reasoning in a subtle way
  if (output.reasoning && !output.messageToUser) {
    parts.push(`💭 ${output.reasoning}`);
  }

  return parts.join('\n');
}

/**
 * Format all outputs from a parsed message
 * @param parsed - The parsed message
 * @returns Formatted string with all outputs
 */
export function formatAllAgentOutputs(parsed: ParsedMessage): string {
  const formatted = parsed.outputs.map(formatAgentOutput).filter(Boolean).join('\n\n');

  // If there's display text (text outside of final_output tags), include it
  if (parsed.displayText) {
    return formatted ? `${parsed.displayText}\n\n${formatted}` : parsed.displayText;
  }

  return formatted;
}
