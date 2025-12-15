/**
 * Utility functions to parse agent output containing <final_output> tags
 */

export interface ParsedAgentOutput {
  action: 'CallTool' | 'Finish' | 'AskUser' | string;
  reasoning?: string;
  selected_tool?: string;
  parameters?: Record<string, any>;
  message_to_user?: string;
}

export interface ParsedMessage {
  rawText: string;
  outputs: ParsedAgentOutput[];
  displayText: string;
}

/**
 * Parse message content containing <final_output> tags
 */
export function parseAgentMessage(content: string): ParsedMessage {
  const finalOutputRegex = /<final_output>\s*([\s\S]*?)\s*<\/final_output>/g;
  const outputs: ParsedAgentOutput[] = [];
  let match: RegExpExecArray | null;

  // Extract all final_output blocks
  while ((match = finalOutputRegex.exec(content)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const parsed = JSON.parse(jsonStr);
      outputs.push(parsed);
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
 */
export function formatOutput(output: ParsedAgentOutput): string {
  const parts: string[] = [];

  // Add the user message if present
  if (output.message_to_user) {
    parts.push(output.message_to_user);
  }

  // Add tool execution info
  if (output.action === 'CallTool' && output.selected_tool) {
    parts.push(`\n🔧 Using tool: ${output.selected_tool}`);
    
    if (output.parameters) {
      const paramStr = Object.entries(output.parameters)
        .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
        .join('\n');
      parts.push(`Parameters:\n${paramStr}`);
    }
  }

  // Add reasoning in a subtle way
  if (output.reasoning && !output.message_to_user) {
    parts.push(`💭 ${output.reasoning}`);
  }

  return parts.join('\n');
}

/**
 * Format all outputs from a parsed message
 */
export function formatAllOutputs(parsed: ParsedMessage): string {
  const formatted = parsed.outputs.map(formatOutput).filter(Boolean).join('\n\n');
  
  // If there's display text (text outside of final_output tags), include it
  if (parsed.displayText) {
    return formatted ? `${parsed.displayText}\n\n${formatted}` : parsed.displayText;
  }
  
  return formatted;
}

