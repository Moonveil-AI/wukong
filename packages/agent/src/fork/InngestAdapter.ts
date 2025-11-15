/**
 * Inngest-based Execution Adapter
 *
 * Executes sub-agents using Inngest event-driven workflows.
 * Suitable for:
 * - Serverless environments (Vercel, AWS Lambda, etc.)
 * - Distributed systems
 * - Production deployments with high reliability requirements
 *
 * Requires:
 * - Inngest account and API key
 * - Inngest functions deployed
 *
 * @see https://www.inngest.com/
 */

import type { EventEmitter } from 'eventemitter3';
import type {
  ExecutionAdapter,
  SubAgentExecutionOptions,
  SubAgentExecutionResult,
} from './ExecutionAdapter.js';

/**
 * Inngest client interface (to avoid direct dependency)
 */
export interface InngestClient {
  send(event: { name: string; data: any }): Promise<{ ids: string[] }>;
}

/**
 * Configuration for InngestAdapter
 */
export interface InngestAdapterConfig {
  /** Inngest client instance */
  inngest: InngestClient;

  /** App URL for callbacks (optional) */
  appUrl?: string;

  /** Polling interval in milliseconds */
  pollInterval?: number;
}

/**
 * Inngest-based execution adapter
 *
 * Delegates sub-agent execution to Inngest functions
 */
export class InngestAdapter implements ExecutionAdapter {
  private inngest: InngestClient;

  constructor(config: InngestAdapterConfig, _eventEmitter?: EventEmitter) {
    this.inngest = config.inngest;

    // These will be used in future implementations when we add
    // advanced polling and webhook features
    if (config.pollInterval) {
      console.debug(`[InngestAdapter] Poll interval set to ${config.pollInterval}ms`);
    }
    if (config.appUrl) {
      console.debug(`[InngestAdapter] App URL set to ${config.appUrl}`);
    }
  }

  /**
   * Execute sub-agent by sending Inngest event
   */
  async executeSubAgent(options: SubAgentExecutionOptions): Promise<void> {
    const { task, userId, organizationId } = options;

    // Send event to Inngest
    await this.inngest.send({
      name: 'agent/fork.execute',
      data: {
        taskId: task.id,
        parentSessionId: task.parentSessionId,
        goal: task.goal,
        contextSummary: task.contextSummary,
        depth: task.depth,
        maxSteps: task.maxSteps,
        timeoutSeconds: task.timeoutSeconds,
        userId,
        organizationId,
        // Inngest will handle the actual execution
      },
    });

    // Task status will be updated by the Inngest function
  }

  /**
   * Wait for sub-agent completion by polling database
   */
  async waitForCompletion(taskId: string, timeoutMs: number): Promise<SubAgentExecutionResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      // In a real implementation, this would poll your storage adapter
      // For now, we throw an error indicating this needs to be implemented
      // Use await to satisfy linter
      await Promise.resolve();
      throw new Error('waitForCompletion requires storage adapter reference - should be injected');

      // Pseudo-code for what this should do:
      // const task = await storageAdapter.getForkAgentTask(taskId);
      // if (task.status === 'completed') return result;
      // if (task.status === 'failed') throw error;
      // await sleep(this.pollInterval);
    }

    throw new Error(`Timeout waiting for sub-agent ${taskId} to complete`);
  }

  /**
   * Cancel a running sub-agent
   */
  async cancelSubAgent(taskId: string): Promise<void> {
    // Send cancellation event to Inngest
    await this.inngest.send({
      name: 'agent/fork.cancel',
      data: {
        taskId,
        cancelledAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Check if sub-agent is still running
   */
  async isRunning(_taskId: string): Promise<boolean> {
    // In real implementation, would check task status in database
    // Use await to satisfy linter
    await Promise.resolve();
    throw new Error('isRunning requires storage adapter reference - should be injected');
  }

  /**
   * Get adapter name
   */
  getName(): string {
    return 'InngestAdapter';
  }
}

/**
 * Factory function to create InngestAdapter
 */
export function createInngestAdapter(
  config: InngestAdapterConfig,
  eventEmitter?: EventEmitter,
): InngestAdapter {
  return new InngestAdapter(config, eventEmitter);
}

/**
 * Example Inngest function implementation (for reference)
 *
 * This should be deployed as an Inngest function in your app:
 *
 * ```typescript
 * // app/api/inngest/functions/fork-agent.ts
 * import { inngest } from '../client';
 *
 * export const forkAgentFunction = inngest.createFunction(
 *   {
 *     id: 'fork-agent',
 *     retries: 3,
 *     timeout: '10m',
 *   },
 *   { event: 'agent/fork.execute' },
 *   async ({ event, step }) => {
 *     const { taskId, goal, maxSteps, timeoutSeconds } = event.data;
 *
 *     // Step 1: Update task status
 *     await step.run('update-status', async () => {
 *       await storageAdapter.updateForkAgentTask(taskId, {
 *         status: 'running',
 *         startedAt: new Date(),
 *       });
 *     });
 *
 *     // Step 2: Execute sub-agent
 *     const result = await step.run('execute-agent', async () => {
 *       const agent = new AutoAgent({
 *         // ... configuration
 *         maxSteps,
 *         timeoutSeconds,
 *       });
 *
 *       return await agent.execute({ goal });
 *     });
 *
 *     // Step 3: Compress and save result
 *     await step.run('save-result', async () => {
 *       await storageAdapter.updateForkAgentTask(taskId, {
 *         status: 'completed',
 *         resultSummary: JSON.stringify(result),
 *         completedAt: new Date(),
 *       });
 *     });
 *
 *     return { success: true, taskId };
 *   }
 * );
 * ```
 */
