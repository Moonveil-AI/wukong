/**
 * Tests for ResponseParser
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ResponseParser } from '../ResponseParser.js';

describe('ResponseParser', () => {
  let parser: ResponseParser;

  beforeEach(() => {
    parser = new ResponseParser();
  });

  describe('extractJSON', () => {
    it('should extract JSON from <final_output> tags', () => {
      const response = `
Some text before
<final_output>
{
  "action": "CallTool",
  "reasoning": "Test reasoning",
  "selected_tool": "test_tool",
  "parameters": {}
}
</final_output>
Some text after
      `;

      const parsed = parser.parse(response);
      expect(parsed.action).toBe('CallTool');
      expect(parsed.reasoning).toBe('Test reasoning');
    });

    it('should extract JSON from code blocks', () => {
      const response = `
Here's the response:
\`\`\`json
{
  "action": "Finish",
  "reasoning": "Task completed",
  "final_result": "Done"
}
\`\`\`
      `;

      const parsed = parser.parse(response);
      expect(parsed.action).toBe('Finish');
    });

    it('should extract raw JSON without wrappers', () => {
      const response = `{
  "action": "CallTool",
  "reasoning": "Test",
  "selected_tool": "test_tool",
  "parameters": {}
}`;

      const parsed = parser.parse(response);
      expect(parsed.action).toBe('CallTool');
    });

    it('should handle JSON with extra whitespace', () => {
      const response = `
        <final_output>
        
          {
            "action": "CallTool",
            "reasoning": "Test",
            "selected_tool": "test_tool",
            "parameters": {}
          }
          
        </final_output>
      `;

      const parsed = parser.parse(response);
      expect(parsed.action).toBe('CallTool');
    });
  });

  describe('normalizeFieldNames', () => {
    it('should convert snake_case to camelCase', () => {
      const response = `
<final_output>
{
  "action": "CallTool",
  "reasoning": "Test",
  "selected_tool": "test_tool",
  "parameters": {},
  "discardable_steps": [1, 2, 3],
  "message_to_user": "Hello"
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect((parsed as any).selectedTool).toBe('test_tool');
      expect((parsed as any).discardableSteps).toEqual([1, 2, 3]);
      expect((parsed as any).messageToUser).toBe('Hello');
    });

    it('should handle nested snake_case fields', () => {
      const response = `
<final_output>
{
  "action": "CallToolsParallel",
  "reasoning": "Test parallel",
  "parallel_tools": [
    {
      "tool_id": "t1",
      "tool_name": "tool1",
      "parameters": {}
    }
  ],
  "wait_strategy": "all"
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect(parsed.action).toBe('CallToolsParallel');
      expect((parsed as any).parallelTools).toBeDefined();
      expect((parsed as any).parallelTools[0].toolId).toBe('t1');
      expect((parsed as any).parallelTools[0].toolName).toBe('tool1');
    });
  });

  describe('CallTool action', () => {
    it('should parse valid CallTool action', () => {
      const response = `
<final_output>
{
  "action": "CallTool",
  "reasoning": "Need to fetch data",
  "selected_tool": "fetch_data",
  "parameters": {
    "url": "https://api.example.com"
  }
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect(parsed.action).toBe('CallTool');
      expect((parsed as any).selectedTool).toBe('fetch_data');
      expect((parsed as any).parameters.url).toBe('https://api.example.com');
    });

    it('should throw error if tool name is missing', () => {
      const response = `
<final_output>
{
  "action": "CallTool",
  "reasoning": "Test",
  "parameters": {}
}
</final_output>
      `;

      expect(() => parser.parse(response)).toThrow();
    });

    it('should allow empty parameters', () => {
      const response = `
<final_output>
{
  "action": "CallTool",
  "reasoning": "Test",
  "selected_tool": "test_tool"
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect((parsed as any).parameters).toEqual({});
    });
  });

  describe('CallToolsParallel action', () => {
    it('should parse valid CallToolsParallel action', () => {
      const response = `
<final_output>
{
  "action": "CallToolsParallel",
  "reasoning": "Execute multiple tools simultaneously",
  "parallel_tools": [
    {
      "tool_id": "t1",
      "tool_name": "tool1",
      "parameters": { "param1": "value1" }
    },
    {
      "tool_id": "t2",
      "tool_name": "tool2",
      "parameters": { "param2": "value2" }
    }
  ],
  "wait_strategy": "all"
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect(parsed.action).toBe('CallToolsParallel');
      expect((parsed as any).parallelTools).toHaveLength(2);
      expect((parsed as any).waitStrategy).toBe('all');
    });

    it('should throw error if parallel_tools is empty', () => {
      const response = `
<final_output>
{
  "action": "CallToolsParallel",
  "reasoning": "Test",
  "parallel_tools": [],
  "wait_strategy": "all"
}
</final_output>
      `;

      expect(() => parser.parse(response)).toThrow();
    });

    it('should throw error if wait_strategy is invalid', () => {
      const response = `
<final_output>
{
  "action": "CallToolsParallel",
  "reasoning": "Test",
  "parallel_tools": [
    { "tool_id": "t1", "tool_name": "tool1", "parameters": {} }
  ],
  "wait_strategy": "invalid"
}
</final_output>
      `;

      expect(() => parser.parse(response)).toThrow();
    });
  });

  describe('ForkAutoAgent action', () => {
    it('should parse valid ForkAutoAgent action', () => {
      const response = `
<final_output>
{
  "action": "ForkAutoAgent",
  "reasoning": "Complex sub-task requires separate agent",
  "sub_goal": "Generate video script",
  "context_summary": "Product is AI assistant for developers",
  "max_steps": 20,
  "timeout": 300
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect(parsed.action).toBe('ForkAutoAgent');
      expect((parsed as any).subGoal).toBe('Generate video script');
      expect((parsed as any).contextSummary).toBe('Product is AI assistant for developers');
      expect((parsed as any).maxSteps).toBe(20);
    });

    it('should throw error if sub_goal is missing', () => {
      const response = `
<final_output>
{
  "action": "ForkAutoAgent",
  "reasoning": "Test",
  "context_summary": "Test context"
}
</final_output>
      `;

      expect(() => parser.parse(response)).toThrow();
    });
  });

  describe('AskUser action', () => {
    it('should parse valid AskUser action', () => {
      const response = `
<final_output>
{
  "action": "AskUser",
  "reasoning": "Need user clarification",
  "question": "Which format do you prefer?",
  "options": ["PDF", "DOCX", "TXT"]
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect(parsed.action).toBe('AskUser');
      expect((parsed as any).question).toBe('Which format do you prefer?');
      expect((parsed as any).options).toEqual(['PDF', 'DOCX', 'TXT']);
    });

    it('should allow AskUser without options', () => {
      const response = `
<final_output>
{
  "action": "AskUser",
  "reasoning": "Need more info",
  "question": "Can you provide more details?"
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect((parsed as any).options).toBeUndefined();
    });
  });

  describe('Plan action', () => {
    it('should parse valid Plan action', () => {
      const response = `
<final_output>
{
  "action": "Plan",
  "reasoning": "Showing execution plan",
  "plan": {
    "steps": [
      {
        "action": "CallTool",
        "description": "Fetch data from API",
        "estimated_time": 5
      },
      {
        "action": "CallTool",
        "description": "Process data",
        "estimated_time": 10
      }
    ],
    "total_estimated_time": 15,
    "estimated_tokens": 1000
  }
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect(parsed.action).toBe('Plan');
      expect((parsed as any).plan.steps).toHaveLength(2);
      expect((parsed as any).plan.totalEstimatedTime).toBe(15);
    });
  });

  describe('Finish action', () => {
    it('should parse valid Finish action', () => {
      const response = `
<final_output>
{
  "action": "Finish",
  "reasoning": "Task completed successfully",
  "final_result": {
    "status": "success",
    "data": "Result data"
  },
  "summary": "Completed all tasks"
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect(parsed.action).toBe('Finish');
      expect((parsed as any).finalResult.status).toBe('success');
      expect((parsed as any).summary).toBe('Completed all tasks');
    });

    it('should allow any type for final_result', () => {
      const response = `
<final_output>
{
  "action": "Finish",
  "reasoning": "Done",
  "final_result": "Simple string result"
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect((parsed as any).finalResult).toBe('Simple string result');
    });
  });

  describe('discardableSteps', () => {
    it('should parse optional discardableSteps field', () => {
      const response = `
<final_output>
{
  "action": "CallTool",
  "reasoning": "Test",
  "selected_tool": "test_tool",
  "parameters": {},
  "discardable_steps": [1, 3, 5]
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect((parsed as any).discardableSteps).toEqual([1, 3, 5]);
    });

    it('should work without discardableSteps', () => {
      const response = `
<final_output>
{
  "action": "CallTool",
  "reasoning": "Test",
  "selected_tool": "test_tool",
  "parameters": {}
}
</final_output>
      `;

      const parsed = parser.parse(response);
      expect((parsed as any).discardableSteps).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should throw descriptive error for malformed JSON', () => {
      const response = `
<final_output>
{
  "action": "CallTool",
  "reasoning": "Test"
  // Missing comma and fields
}
</final_output>
      `;

      expect(() => parser.parse(response)).toThrow(/Failed to parse JSON/);
    });

    it('should throw descriptive error for missing required fields', () => {
      const response = `
<final_output>
{
  "action": "CallTool",
  "selected_tool": "test_tool"
}
</final_output>
      `;

      expect(() => parser.parse(response)).toThrow(/Invalid LLM response format/);
    });

    it('should throw error for invalid action type', () => {
      const response = `
<final_output>
{
  "action": "InvalidAction",
  "reasoning": "Test"
}
</final_output>
      `;

      expect(() => parser.parse(response)).toThrow();
    });
  });

  describe('utility methods', () => {
    it('hasValidJSON should return true for valid JSON', () => {
      const response = `
<final_output>
{
  "action": "Finish",
  "reasoning": "Done",
  "final_result": "result"
}
</final_output>
      `;

      expect(parser.hasValidJSON(response)).toBe(true);
    });

    it('hasValidJSON should return false for invalid JSON', () => {
      const response = 'Not JSON at all';
      expect(parser.hasValidJSON(response)).toBe(false);
    });

    it('extractReasoning should extract reasoning without full parsing', () => {
      const response = `
<final_output>
{
  "action": "CallTool",
  "reasoning": "This is my reasoning",
  "selected_tool": "test"
}
</final_output>
      `;

      expect(parser.extractReasoning(response)).toBe('This is my reasoning');
    });

    it('extractActionType should extract action type', () => {
      const response = `
<final_output>
{
  "action": "ForkAutoAgent",
  "reasoning": "Test"
}
</final_output>
      `;

      expect(parser.extractActionType(response)).toBe('ForkAutoAgent');
    });
  });

  describe('validate method', () => {
    it('should validate an already-parsed action object', () => {
      const action = {
        action: 'CallTool',
        reasoning: 'Test',
        selectedTool: 'test_tool',
        parameters: {},
      };

      const validated = parser.validate(action);
      expect(validated.action).toBe('CallTool');
    });

    it('should throw error for invalid action object', () => {
      const action = {
        action: 'CallTool',
        // Missing reasoning and selectedTool
      };

      expect(() => parser.validate(action)).toThrow();
    });
  });
});
