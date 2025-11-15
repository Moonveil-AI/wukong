# Prompt Engineering

This chapter details the prompt engineering strategies that power Wukong Agent's intelligent decision-making.

## Table of Contents
- [Prompt Structure](#prompt-structure)
- [Core Principles](#core-principles)
- [InteractiveAgent vs AutoAgent Prompts](#interactiveagent-vs-autoagent-prompts)
- [Step Discarding Rules](#step-discarding-rules)
- [Tool Selection Guidelines](#tool-selection-guidelines)
- [Response Format](#response-format)
- [Examples and Few-Shot Learning](#examples-and-few-shot-learning)

---

## Prompt Structure

The complete prompt sent to the LLM follows a structured format:

```typescript
function buildPrompt(context: PromptContext): string {
  return `
# Overview
## Your Company
You work at ${context.companyName}. Your role is to help users accomplish their goals using available tools.

## Role
You are an AI Agent that can:
- Understand user goals
- Search knowledge base for relevant information
- Select and invoke appropriate tools
- Execute tasks step by step
- Learn from conversation history

## Available Actions
${ActionType.toString()}
- CallTool: Invoke a single tool
- CallToolsParallel: Execute multiple tools simultaneously
- ForkAutoAgent: Create a sub-agent for complex sub-tasks
- AskUser: Ask user for clarification (InteractiveAgent only)
- Plan: Show execution plan
- Finish: Complete the task

---

# Step Management (Token Optimization)

To save tokens, you can optimize steps in two ways: **discard** or **compress**.

## 1. Discard (Complete Removal)
Remove steps that have no lasting value:
- Purely procedural confirmations ("OK", "I understand", "Let me help")
- Drafts that were rejected and replaced
- Errors that were immediately corrected
- Steps with no new information

## 2. Compress (Preserve Key Info)
Replace verbose steps with concise summaries:
- Long tool outputs (keep only key results)
- Detailed analyses (keep only conclusions)
- Verbose user explanations (keep only requirements)
- Multi-paragraph responses (keep only action items)

IMPORTANT: Provide the compressed content directly in your response, not instructions to compress.

## Always Keep in Full
Never discard or compress these:
- User's original goal and requirement modifications
- Final effective solutions
- Error patterns that may reoccur
- Last 5 steps (maintain immediate context)
- Steps with unique insights or decisions

## How to Mark
Include both fields in your response:
- "discardable_steps": [2, 5, 8] - Step IDs to completely remove
- "compressed_steps": [
    { "step_id": 12, "compressed": "Brief summary you created" },
    { "step_id": 15, "compressed": "Another concise summary" }
  ]

---

# Main Procedure

${context.autoRun ? getAutoAgentProcedure() : getInteractiveAgentProcedure()}

---

# Output Format

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
  "discardable_steps": [2, 5, 8],  // Optional: steps to completely remove
  "compressed_steps": [  // Optional: steps to replace with compressed version
    {
      "step_id": 12,
      "compressed": "Your compressed summary of step 12"
    }
  ],
  "message_to_user": "Human-readable message"  // For AskUser or Plan
}
</final_output>

---

# Examples

${getPromptExamples(context.agentType)}

---

# Concise Communication Style

- Be extremely concise
- Provide options rather than open-ended questions
- Don't repeat tool results to the user
- Only ask questions when absolutely necessary

---

# Tool Selection Guidelines

${getToolSelectionGuidelines(context.tools)}

---

# Current Context

## Task Goal
<goal_description>
${context.goal}
</goal_description>

## Available Tools
<all_tool_list>
${formatToolsList(context.tools)}
</all_tool_list>

## Relevant Knowledge
<knowledge>
${context.knowledge}
</knowledge>

## Matched Skills
<skills>
${context.skills}
</skills>

## Task History
<history>
${formatHistory(context.history)}
</history>

## Latest Step
<latest_step>
${context.latestStep}
</latest_step>

Now, decide the next action.
`
}
```

---

## Core Principles

### 1. Structured Format

Use clear sections with XML tags and markdown for easy parsing:

```
# Major Section
## Subsection
- Bullet points

<xml_tags>
Content
</xml_tags>
```

### 2. Examples-Driven

Include detailed examples for every action type:

```typescript
const examples = [
  {
    scenario: "User wants to generate an image",
    correct: {
      action: "CallTool",
      reasoning: "Generating image based on user description",
      selected_tool: "GENERATE_IMAGE_GPT",
      parameters: {
        prompt: "A serene mountain landscape at sunset",
        size: "1024x1024"
      }
    }
  },
  {
    scenario: "Need to generate 3 different scene images",
    correct: {
      action: "CallToolsParallel",
      reasoning: "Generating 3 independent scenes simultaneously for efficiency",
      parallel_tools: [
        { tool_name: "GENERATE_IMAGE_GPT", parameters: { prompt: "Scene 1" }, tool_id: "img_1" },
        { tool_name: "GENERATE_IMAGE_GPT", parameters: { prompt: "Scene 2" }, tool_id: "img_2" },
        { tool_name: "GENERATE_IMAGE_GPT", parameters: { prompt: "Scene 3" }, tool_id: "img_3" }
      ],
      wait_strategy: "all"
    }
  }
]
```

### 3. Clear Constraints

Explicitly state what the agent can and cannot do:

```
✅ You CAN:
- Search knowledge base
- Execute tools sequentially or in parallel
- Fork sub-agents for complex tasks
- Discard unnecessary steps

❌ You CANNOT:
- Access the internet directly (use search tools)
- Execute arbitrary code
- Modify user files without confirmation
- Make assumptions about missing information
```

---

## InteractiveAgent vs AutoAgent Prompts

### InteractiveAgent Specific Rules

```
# IMPORTANT: InteractiveAgent Pattern

After EVERY tool call, you MUST:
1. Call the tool: action = "CallTool"
2. Then ask user: action = "AskUser"

This gives users a chance to:
- Review the result
- Provide feedback
- Change direction
- Continue or stop

Example sequence:
Step 1: CallTool (generate_image)
Step 2: AskUser ("I've generated the image. Does it look good? Should I proceed with video generation?")
Step 3: [User confirms]
Step 4: CallTool (generate_video)
Step 5: AskUser ("Video is ready. Would you like to add music or export as-is?")
```

### AutoAgent Specific Rules

```
# IMPORTANT: AutoAgent Pattern

1. First Step: ALWAYS search knowledge base
   action = "CallTool"
   selected_tool = "SEARCH_KNOWLEDGE"
   parameters = { "query_text": "relevant keywords from goal" }

2. Subsequent Steps: Execute tools autonomously
   - No AskUser actions
   - Continue until task completion or timeout

3. Use parallel execution when possible:
   - Multiple similar tasks → CallToolsParallel
   - Complex independent sub-tasks → ForkAutoAgent

Example sequence:
Step 1: SearchKnowledge ("video generation best practices")
Step 2: CallToolsParallel (generate 3 images simultaneously)
Step 3: CallTool (combine images into video)
Step 4: Finish
```

---

## Step Management Rules

Detailed rules for optimizing steps through discarding or compression:

### Always Keep in Full (Never Discard or Compress)

```typescript
const mustKeepInFull = {
  // 1. Original user requirements
  examples: [
    "User: I want a vertical video about cats",
    "User: Change the background to blue instead"
  ],
  
  // 2. Final effective solutions
  examples: [
    "Successfully generated video at: https://...",
    "Final approved image URL: https://..."
  ],
  
  // 3. Error patterns that may reoccur
  examples: [
    "Error: Kling tool doesn't support audio, use P0 instead",
    "Note: 9:16 aspect ratio requires specific image size"
  ],
  
  // 4. Recent steps (last 5)
  reason: "Context for immediate next steps",
  
  // 5. Steps with unique insights or decisions
  examples: [
    "User prefers minimalist design style",
    "Decision: Use tool A instead of B because of performance"
  ]
}
```

### Discard Completely

```typescript
const shouldDiscard = {
  // 1. No new information
  examples: [
    'Agent: "I understand"',
    'Agent: "Let me help with that"'
  ],
  
  // 2. Purely procedural confirmations
  examples: [
    'User: "OK"',
    'User: "Yes, continue"',
    'User: "Sounds good"'
  ],
  
  // 3. Superseded drafts
  examples: [
    "Draft 1: [generated image that was rejected]",
    "Draft 2: [generated image that was rejected]"
    // Keep Draft 3 (final version) or compress it
  ],
  
  // 4. Immediately corrected errors
  examples: [
    'Step 10: Called wrong tool with wrong params',
    // Step 11: Corrected and succeeded
    // → Discard Step 10
  ]
}
```

### Compress (Keep Key Info Only)

```typescript
const shouldCompress = {
  // 1. Verbose tool outputs
  original: `
    Step 25: Analyzed sales data
    Result: {
      Q1: { jan: $120k, feb: $135k, mar: $145k },
      Q2: { apr: $155k, may: $168k, jun: $172k },
      trends: "Consistent 8% monthly growth",
      topProducts: ["Widget A (42%)", "Widget B (31%)", "Widget C (27%)"],
      customers: { enterprise: 35%, smb: 45%, individual: 20% },
      // ... 50 more lines of data
    }
  `,
  compressed: "Q1-Q2 sales: $995k total, 8% monthly growth. Top: Widget A (42%), main segment: SMB (45%).",
  
  // 2. Long explanations
  original: `
    Step 18: User explained their requirements in detail.
    They want to create a marketing video for their new product launch.
    The video should be vertical format for mobile viewing.
    They prefer a modern, energetic style with fast cuts.
    Background music should be upbeat and contemporary.
    Duration should be between 30-60 seconds.
    The color scheme should match their brand colors: blue and white.
    // ... 3 more paragraphs
  `,
  compressed: "User requirements: 30-60s vertical marketing video, modern/energetic style, fast cuts, upbeat music, blue/white brand colors.",
  
  // 3. Detailed analyses
  original: `
    Step 32: Analyzed competitor strategies
    Competitor A focuses on...
    Competitor B's approach is...
    Competitor C differentiates by...
    // ... detailed analysis
  `,
  compressed: "Competitor analysis: A uses premium positioning, B focuses on price, C emphasizes innovation."
}
```

### Response Format

```json
{
  "action": "CallTool",
  "selected_tool": "GENERATE_VIDEO",
  "parameters": {...},
  "discardable_steps": [5, 8, 12],
  "compressed_steps": [
    {
      "step_id": 15,
      "compressed": "Q1-Q2 sales: $995k total, 8% monthly growth. Top: Widget A (42%)."
    },
    {
      "step_id": 18,
      "compressed": "Requirements: 30-60s vertical video, modern style, upbeat music, blue/white colors."
    }
  ],
  "reasoning": "Generating video. Discarded: steps 5,8,12 (confirmations). Compressed: steps 15,18 (verbose outputs)."
}
```

---

## Tool Selection Guidelines

### Video Generation Tools Priority

```
# Video Generation Tool Selection

The system has multiple video generation tools with different capabilities:
- GENERATE_VIDEO_P0: Highest quality (VEO v3), 4/6/8 seconds, supports audio
- GENERATE_VIDEO_P1: High quality (VEO v2), 5-8 seconds
- GENERATE_VIDEO_P2: Professional quality (Kling Pro), 5/10 seconds
- GENERATE_VIDEO_P3: Standard quality (Kling), 5/10 seconds
- GENERATE_VIDEO_S0: High quality (Sora 2), 4/8/12 seconds, supports audio

Selection Rules:
1. User-specified tool → Use that tool
2. Audio needed → P0 or S0 only
3. Duration needed:
   - 4-8s → P0 or S0
   - 5-10s → P1, P2, or P3
4. Default priority: P0 → P1 → P2 → P3
5. Multi-scene consistency: Use same tool for all scenes

Example:
Goal: "Create 3-scene video with background music"
→ Choose P0 (supports audio)
→ Use P0 for all 3 scenes (consistency)
```

### Tool Parameter Guidelines

```
# Image Generation

IMPORTANT: Do not include aspect ratio in the prompt.
❌ Bad: "A cat, vertical 9:16 format"
✅ Good: "A cat sitting on a windowsill"
      + aspect_ratio parameter: "9:16"

# Video Generation

IMPORTANT: 
- Specify voice-over/dialogue in the prompt if audio is needed
- Use start_image parameter for image-to-video conversion
- Aspect ratio should match source image

Example:
{
  "tool": "GENERATE_VIDEO_P0",
  "parameters": {
    "prompt": "Camera slowly zooms in. Voice-over: 'Welcome to the future.'",
    "duration": 6,
    "aspect_ratio": "16:9",
    "start_image": "https://previous-image.jpg"
  }
}
```

---

## Response Format

### Standard Response

```json
<final_output>
{
  "action": "CallTool",
  "reasoning": "Generating product image based on user description",
  "selected_tool": "GENERATE_IMAGE_GPT",
  "parameters": {
    "prompt": "Modern smartphone with sleek design on marble surface",
    "size": "1024x1024",
    "quality": "high"
  },
  "discardable_steps": [3, 7],
  "compressed_steps": [
    {
      "step_id": 5,
      "compressed": "User requirements: vertical format, minimalist style, white background."
    }
  ]
}
</final_output>
```

### Parallel Execution Response

```json
<final_output>
{
  "action": "CallToolsParallel",
  "reasoning": "Generating 3 scene images simultaneously to improve efficiency",
  "parallel_tools": [
    {
      "tool_name": "GENERATE_IMAGE_GPT",
      "parameters": {
        "prompt": "Office scene with modern desk and computer",
        "size": "1024x1536"
      },
      "tool_id": "scene_1"
    },
    {
      "tool_name": "GENERATE_IMAGE_GPT",
      "parameters": {
        "prompt": "Coffee shop with warm lighting and people working",
        "size": "1024x1536"
      },
      "tool_id": "scene_2"
    },
    {
      "tool_name": "GENERATE_IMAGE_GPT",
      "parameters": {
        "prompt": "City street at sunset with walking people",
        "size": "1024x1536"
      },
      "tool_id": "scene_3"
    }
  ],
  "wait_strategy": "all",
  "discardable_steps": [8, 9],
  "compressed_steps": [
    {
      "step_id": 12,
      "compressed": "User feedback: Scene 1 approved, Scene 2 needs warmer colors, Scene 3 perfect."
    }
  ]
}
</final_output>
```

### Fork Agent Response

```json
<final_output>
{
  "action": "CallTool",
  "reasoning": "Creating sub-agent to research competitor analysis while main task continues",
  "selected_tool": "FORK_AUTO_AGENT",
  "parameters": {
    "goal": "Research top 3 competitors' social media strategies and provide summary",
    "context_summary": "We're creating a marketing campaign for AI writing assistant targeting content creators",
    "timeout": 300
  }
}
</final_output>
```

### Ask User Response (InteractiveAgent Only)

```json
<final_output>
{
  "action": "AskUser",
  "reasoning": "Need to confirm the generated image meets user's expectations before proceeding",
  "message_to_user": "I've generated the product image. Does it match your vision? Should I proceed to create the video, or would you like me to adjust the image first?",
  "options": [
    "Proceed with video generation",
    "Adjust the image (please specify changes)",
    "Try a different style"
  ]
}
</final_output>
```

---

## Examples and Few-Shot Learning

### Complete Example 1: Simple Task

```
Scenario: User wants to generate a product image

# History
Step 1:
User: "Generate a professional product photo of a smartwatch"

# Agent Response
<final_output>
{
  "action": "CallTool",
  "reasoning": "Generating product image based on user specification",
  "selected_tool": "GENERATE_IMAGE_GPT",
  "parameters": {
    "prompt": "Professional product photography of a modern smartwatch with black band on white background, studio lighting, high detail",
    "size": "1024x1024",
    "quality": "high"
  }
}
</final_output>

# Result
Successfully generated image: https://example.com/smartwatch.jpg
```

### Complete Example 2: Multi-Step with Parallel Execution

```
Scenario: Create a 3-scene video

# History
Step 1:
User: "Create a video showing a day in the life of a developer. 3 scenes: morning coffee, coding, and evening relaxation"

Step 2:
Agent: <final_output>
{
  "action": "CallTool",
  "reasoning": "Searching for video creation best practices",
  "selected_tool": "SEARCH_KNOWLEDGE",
  "parameters": {
    "query_text": "multi-scene video creation developer lifestyle"
  }
}
</final_output>

Step 3:
Knowledge Result: "For multi-scene videos, generate all scene images first in parallel, then create individual video clips..."

Step 4:
Agent: <final_output>
{
  "action": "CallToolsParallel",
  "reasoning": "Generating 3 scene images in parallel for efficiency",
  "parallel_tools": [
    {
      "tool_name": "GENERATE_IMAGE_GPT",
      "parameters": {
        "prompt": "Cozy morning scene, developer drinking coffee by window, warm sunlight, peaceful atmosphere",
        "size": "1024x1536"
      },
      "tool_id": "morning_scene"
    },
    {
      "tool_name": "GENERATE_IMAGE_GPT",
      "parameters": {
        "prompt": "Developer focused on coding, multiple monitors, modern office setup, concentrated expression",
        "size": "1024x1536"
      },
      "tool_id": "coding_scene"
    },
    {
      "tool_name": "GENERATE_IMAGE_GPT",
      "parameters": {
        "prompt": "Evening relaxation, developer reading book in comfortable chair, soft lighting, calm mood",
        "size": "1024x1536"
      },
      "tool_id": "evening_scene"
    }
  ],
  "wait_strategy": "all",
  "discardable_steps": []
}
</final_output>

Step 5:
All images generated successfully
- morning_scene: https://example.com/morning.jpg
- coding_scene: https://example.com/coding.jpg
- evening_scene: https://example.com/evening.jpg

Step 6:
Agent: <final_output>
{
  "action": "CallToolsParallel",
  "reasoning": "Converting all 3 images to videos simultaneously",
  "parallel_tools": [
    {
      "tool_name": "GENERATE_VIDEO_P0",
      "parameters": {
        "prompt": "Gentle zoom in, peaceful morning ambiance",
        "duration": 6,
        "aspect_ratio": "9:16",
        "start_image": "https://example.com/morning.jpg"
      },
      "tool_id": "video_morning"
    },
    {
      "tool_name": "GENERATE_VIDEO_P0",
      "parameters": {
        "prompt": "Slight pan across monitors, focused work atmosphere",
        "duration": 6,
        "aspect_ratio": "9:16",
        "start_image": "https://example.com/coding.jpg"
      },
      "tool_id": "video_coding"
    },
    {
      "tool_name": "GENERATE_VIDEO_P0",
      "parameters": {
        "prompt": "Slow zoom out, relaxing evening mood",
        "duration": 6,
        "aspect_ratio": "9:16",
        "start_image": "https://example.com/evening.jpg"
      },
      "tool_id": "video_evening"
    }
  ],
  "wait_strategy": "all",
  "discardable_steps": [2],
  "compressed_steps": [
    {
      "step_id": 3,
      "compressed": "KB: multi-scene videos work best with consistent style, generate images in parallel first."
    },
    {
      "step_id": 5,
      "compressed": "Generated 3 scene images: morning (coffee), coding (office), evening (reading). All 9:16 vertical."
    }
  ]
}
</final_output>

Step 7:
All videos generated. Agent calls concatenate tool to merge them.
Task complete.
```

---

## Best Practices

### 1. Context Management

```typescript
// Include only relevant context
const relevantContext = {
  recentSteps: last5Steps,  // Not all history
  matchedKnowledge: top3Results,  // Not entire knowledge base
  activeSkills: matchedSkills,  // Not all 50 skills
  availableTools: toolsForThisAgentType  // Not all tools
}
```

### 2. Token Optimization

```
Total Prompt Budget: ~12,000 tokens (for GPT-5.1-instant with 200K context)

Breakdown:
- System Instructions: ~2,000 tokens
- Tool Definitions (Tool Executor): ~1,000 tokens (names + params only)
- Knowledge Snippets: ~1,500 tokens (top 3-5 results)
- History (non-discarded): ~2,500 tokens (last 10-15 steps)
- Current Step: ~500 tokens
- Examples: ~500 tokens

= Total: ~8,000 tokens
```

### 3. Error Handling in Prompts

```
# Error Handling

If a tool fails:
1. Read the error message carefully
2. Determine if it's retryable
3. If retryable: Try with corrected parameters
4. If not retryable: Choose alternative tool or approach
5. Never retry the exact same call that just failed

Example:
Error: "GENERATE_VIDEO_P0 failed: start_image must be 9:16 aspect ratio"
→ Correct action: Generate new 9:16 image first
→ Wrong action: Retry with same 16:9 image
```

---

## Validation and Testing

### Response Parsing

```typescript
function parseAgentResponse(llmOutput: string): AgentResponse {
  // 1. Extract <final_output>...</final_output>
  const match = llmOutput.match(/<final_output>(.*?)<\/final_output>/s)
  if (!match) {
    throw new Error("Response missing <final_output> tags")
  }
  
  // 2. Parse JSON
  const json = JSON.parse(match[1])
  
  // 3. Validate required fields
  if (!json.action || !json.reasoning) {
    throw new Error("Response missing required fields")
  }
  
  // 4. Validate action-specific fields
  if (json.action === 'CallTool' && !json.selected_tool) {
    throw new Error("CallTool action requires selected_tool")
  }
  
  if (json.action === 'CallToolsParallel' && !json.parallel_tools) {
    throw new Error("CallToolsParallel action requires parallel_tools array")
  }
  
  return json as AgentResponse
}
```

### Testing Prompts

```typescript
// Test with various scenarios
const testCases = [
  {
    scenario: "Simple image generation",
    expectedAction: "CallTool",
    expectedTool: "GENERATE_IMAGE_GPT"
  },
  {
    scenario: "Multi-scene parallel generation",
    expectedAction: "CallToolsParallel",
    expectedToolsCount: 3
  },
  {
    scenario: "Complex research task",
    expectedAction: "CallTool",
    expectedTool: "FORK_AUTO_AGENT"
  }
]

for (const test of testCases) {
  const response = await callLLM(buildPrompt(test.scenario))
  assert(response.action === test.expectedAction)
  // ... more assertions
}
```

---

[← Previous Chapter: Usage Examples](./11-examples.md) | [Next Chapter: Database Design →](./13-database-design.md)

