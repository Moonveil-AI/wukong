import { describe, expect, it } from 'vitest';
import {
  type ParsedAgentOutput,
  formatAgentOutput,
  formatAllAgentOutputs,
  parseAgentOutput,
} from '../parseOutput';

describe('parseAgentOutput', () => {
  it('should parse complete final_output blocks', () => {
    const content = `<final_output>
{
  "action": "CallTool",
  "reasoning": "Need to calculate something",
  "selected_tool": "calculator",
  "parameters": { "a": 10, "b": 20 }
}
</final_output>`;

    const result = parseAgentOutput(content);

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]).toMatchObject({
      action: 'CallTool',
      reasoning: 'Need to calculate something',
      selectedTool: 'calculator',
      parameters: { a: 10, b: 20 },
    });
    expect(result.displayText).toBe('');
  });

  it('should parse multiple final_output blocks', () => {
    const content = `<final_output>
{"action": "CallTool", "selected_tool": "tool1"}
</final_output>
Some text here
<final_output>
{"action": "CallTool", "selected_tool": "tool2"}
</final_output>`;

    const result = parseAgentOutput(content);

    expect(result.outputs).toHaveLength(2);
    expect(result.outputs[0]?.selectedTool).toBe('tool1');
    expect(result.outputs[1]?.selectedTool).toBe('tool2');
    expect(result.displayText).toBe('Some text here');
  });

  it('should extract display text outside of final_output tags', () => {
    const content = `This is some text <final_output>
{"action": "Finish", "message_to_user": "Done!"}
</final_output> and more text`;

    const result = parseAgentOutput(content);

    // Note: The regex replacement leaves double space where the block was
    expect(result.displayText).toBe('This is some text  and more text');
    expect(result.outputs).toHaveLength(1);
  });

  it('should normalize snake_case to camelCase', () => {
    const content = `<final_output>
{
  "action": "CallTool",
  "selected_tool": "calculator",
  "message_to_user": "Hello!"
}
</final_output>`;

    const result = parseAgentOutput(content);

    expect(result.outputs[0]).toMatchObject({
      selectedTool: 'calculator',
      messageToUser: 'Hello!',
    });
  });

  describe('streaming mode', () => {
    it('should remove incomplete final_output tags when streaming=true', () => {
      const content = `Complete text here <final_output>
{"action": "CallTool"`;

      const result = parseAgentOutput(content, true);

      expect(result.displayText).toBe('Complete text here');
      expect(result.outputs).toHaveLength(0);
    });

    it('should parse complete blocks and hide incomplete ones when streaming=true', () => {
      const content = `<final_output>
{"action": "CallTool", "selected_tool": "tool1"}
</final_output>
Some display text
<final_output>
{"action": "CallTool", "incomplete`;

      const result = parseAgentOutput(content, true);

      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0]?.selectedTool).toBe('tool1');
      expect(result.displayText).toBe('Some display text');
      expect(result.displayText).not.toContain('<final_output>');
    });

    it('should not remove incomplete tags when streaming=false', () => {
      const content = `Text <final_output>{"incomplete`;

      const resultNotStreaming = parseAgentOutput(content, false);
      const resultStreaming = parseAgentOutput(content, true);

      // When not streaming, incomplete tags stay in displayText
      expect(resultNotStreaming.displayText).toContain('<final_output>');

      // When streaming, incomplete tags are removed
      expect(resultStreaming.displayText).toBe('Text');
      expect(resultStreaming.displayText).not.toContain('<final_output>');
    });
  });

  it('should handle invalid JSON gracefully', () => {
    const content = `<final_output>
{invalid json here}
</final_output>
Valid text`;

    // Should not throw, just skip invalid blocks
    const result = parseAgentOutput(content);

    expect(result.outputs).toHaveLength(0);
    expect(result.displayText).toBe('Valid text');
  });

  it('should preserve rawText unchanged', () => {
    const content = `Original <final_output>{"action": "Finish"}</final_output> content`;

    const result = parseAgentOutput(content);

    expect(result.rawText).toBe(content);
  });
});

describe('formatAgentOutput', () => {
  it('should format reasoning when no user message', () => {
    const output: ParsedAgentOutput = {
      action: 'CallTool',
      reasoning: 'I need to calculate something',
      selectedTool: 'calculator',
    };

    const result = formatAgentOutput(output);

    expect(result).toContain('💭 I need to calculate something');
  });

  it('should format tool call with action and tool name', () => {
    const output: ParsedAgentOutput = {
      action: 'CallTool',
      selectedTool: 'calculator',
      parameters: { a: 15, b: 8 },
    };

    const result = formatAgentOutput(output);

    expect(result).toContain('🔧 Action: CallTool');
    expect(result).toContain('🛠️ Tool: calculator');
    expect(result).toContain('Parameters:');
    expect(result).toContain('• a: 15');
    expect(result).toContain('• b: 8');
  });

  it('should show user message when present', () => {
    const output: ParsedAgentOutput = {
      action: 'Finish',
      messageToUser: 'Task completed successfully!',
      reasoning: 'This should not be shown',
    };

    const result = formatAgentOutput(output);

    expect(result).toContain('Task completed successfully!');
    // Reasoning should not be shown when messageToUser is present
    expect(result).not.toContain('💭');
  });

  it('should format parameters with bullet points', () => {
    const output: ParsedAgentOutput = {
      action: 'CallTool',
      selectedTool: 'test_tool',
      parameters: {
        operation: 'multiply',
        a: 15,
        b: 8,
      },
    };

    const result = formatAgentOutput(output);

    expect(result).toContain('• operation: "multiply"');
    expect(result).toContain('• a: 15');
    expect(result).toContain('• b: 8');
  });

  it('should handle output without parameters', () => {
    const output: ParsedAgentOutput = {
      action: 'CallTool',
      selectedTool: 'simple_tool',
    };

    const result = formatAgentOutput(output);

    expect(result).toContain('🔧 Action: CallTool');
    expect(result).toContain('🛠️ Tool: simple_tool');
    expect(result).not.toContain('Parameters:');
  });

  it('should order output correctly: reasoning, message, tool info', () => {
    const output: ParsedAgentOutput = {
      action: 'CallTool',
      reasoning: 'Need to do math',
      selectedTool: 'calculator',
      parameters: { a: 1 },
    };

    const result = formatAgentOutput(output);
    const lines = result.split('\n');

    // Reasoning should come first
    expect(lines[0]).toContain('💭 Need to do math');
    // Then tool info
    expect(lines[1]).toContain('🔧 Action: CallTool');
  });
});

describe('formatAllAgentOutputs', () => {
  it('should format multiple outputs with separators', () => {
    const parsed = parseAgentOutput(`<final_output>
{"action": "CallTool", "selected_tool": "tool1", "reasoning": "First step"}
</final_output>
<final_output>
{"action": "CallTool", "selected_tool": "tool2", "reasoning": "Second step"}
</final_output>`);

    const result = formatAllAgentOutputs(parsed);

    expect(result).toContain('💭 First step');
    expect(result).toContain('💭 Second step');
    expect(result).toContain('---'); // Separator between steps
    expect(result).toContain('tool1');
    expect(result).toContain('tool2');
  });

  it('should include display text before formatted outputs', () => {
    const parsed = parseAgentOutput(`Calculating 15 × 8 first
<final_output>
{"action": "CallTool", "selected_tool": "calculator"}
</final_output>`);

    const result = formatAllAgentOutputs(parsed);

    // Display text should come first
    expect(result.indexOf('Calculating 15 × 8 first')).toBeLessThan(
      result.indexOf('🔧 Action: CallTool'),
    );
  });

  it('should return only display text when no outputs', () => {
    const parsed = parseAgentOutput('Just some text without outputs');

    const result = formatAllAgentOutputs(parsed);

    expect(result).toBe('Just some text without outputs');
  });

  it('should return only formatted outputs when no display text', () => {
    const parsed = parseAgentOutput(`<final_output>
{"action": "Finish", "message_to_user": "Done!"}
</final_output>`);

    const result = formatAllAgentOutputs(parsed);

    expect(result).toContain('Done!');
    expect(result).not.toContain('\n\n'); // No extra spacing when no display text
  });

  it('should handle real-world streaming example', () => {
    // Simulate the actual output from the agent
    const content = `<final_output>
{
  "action": "CallTool",
  "reasoning": "I need to use the correct parameter names 'a' and 'b' for the calculator tool to multiply 15 by 8.",
  "selected_tool": "calculator",
  "parameters": { "operation": "multiply", "a": 15, "b": 8 }
}
</final_output><final_output>
{
  "action": "CallTool",
  "reasoning": "Now I need to add 42 to the multiplication result of 120 to complete the calculation.",
  "selected_tool": "calculator",
  "parameters": { "operation": "add", "a": 120, "b": 42 }
}
</final_output><final_output>
{
  "action": "Finish",
  "message_to_user": "The calculation is complete: 15 multiplied by 8 equals 120, then adding 42 gives us a final result of 162."
}
</final_output>`;

    const parsed = parseAgentOutput(content, false);
    const result = formatAllAgentOutputs(parsed);

    // Should have all three steps formatted
    expect(result).toContain('💭 I need to use the correct parameter names');
    expect(result).toContain('💭 Now I need to add 42');
    expect(result).toContain('The calculation is complete');

    // Should have separators between steps
    const separatorCount = (result.match(/---/g) || []).length;
    expect(separatorCount).toBe(2); // Two separators for three steps

    // Should format parameters nicely
    expect(result).toContain('• operation: "multiply"');
    expect(result).toContain('• a: 15');
    expect(result).toContain('• b: 8');
  });

  it('should handle streaming with incomplete blocks', () => {
    const streamingContent = `<final_output>
{"action": "CallTool", "selected_tool": "calculator", "parameters": {"a": 15, "b": 8}}
</final_output><final_output>
{"action": "CallTool", "incomplete`;

    const parsed = parseAgentOutput(streamingContent, true);
    const result = formatAllAgentOutputs(parsed);

    // Should only show the first complete block
    expect(result).toContain('calculator');
    expect(result).not.toContain('incomplete');
    expect(result).not.toContain('<final_output>');
  });
});
