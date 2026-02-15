import { db } from '../db/index.js';
import { usageRecords, agents } from '../db/schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export interface TokenUsage {
  agentId: string;
  tenantId: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  timestamp?: Date;
}

export interface UsageSummary {
  agentId: string;
  agentName: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  messageCount: number;
}

// Approximate costs per 1M tokens (OpenRouter pricing)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  // OpenRouter versions
  'openrouter/claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'openrouter/claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'openrouter/claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
};

export class UsageTracker {
  /**
   * Record token usage from an agent
   */
  async recordUsage(usage: TokenUsage): Promise<void> {
    await db.insert(usageRecords).values({
      tenantId: usage.tenantId,
      agentId: usage.agentId,
      type: 'tokens',
      quantity: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        model: usage.model,
      },
      timestamp: usage.timestamp || new Date(),
    });
  }

  /**
   * Get usage summary for a tenant within a time range
   */
  async getTenantUsage(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageSummary[]> {
    const records = await db
      .select({
        agentId: usageRecords.agentId,
        agentName: agents.name,
        quantity: usageRecords.quantity,
      })
      .from(usageRecords)
      .leftJoin(agents, eq(usageRecords.agentId, agents.id))
      .where(
        and(
          eq(usageRecords.tenantId, tenantId),
          eq(usageRecords.type, 'tokens'),
          gte(usageRecords.timestamp, startDate),
          lte(usageRecords.timestamp, endDate)
        )
      );

    // Aggregate by agent
    const agentUsage = new Map<string, UsageSummary>();

    for (const record of records) {
      if (!record.agentId) continue;

      const existing = agentUsage.get(record.agentId) || {
        agentId: record.agentId,
        agentName: record.agentName || 'Unknown',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        messageCount: 0,
      };

      const quantity = record.quantity as {
        inputTokens: number;
        outputTokens: number;
        model: string;
      };

      existing.totalInputTokens += quantity.inputTokens || 0;
      existing.totalOutputTokens += quantity.outputTokens || 0;
      existing.messageCount += 1;

      // Calculate cost
      const costs = MODEL_COSTS[quantity.model] || MODEL_COSTS['claude-sonnet-4-20250514'];
      existing.totalCost +=
        (quantity.inputTokens / 1_000_000) * costs.input +
        (quantity.outputTokens / 1_000_000) * costs.output;

      agentUsage.set(record.agentId, existing);
    }

    return Array.from(agentUsage.values());
  }

  /**
   * Get total cost for a tenant in the current billing period
   */
  async getCurrentPeriodCost(tenantId: string): Promise<number> {
    // Get start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const usage = await this.getTenantUsage(tenantId, startOfMonth, now);
    return usage.reduce((sum, u) => sum + u.totalCost, 0);
  }

  /**
   * Get daily usage for charts
   */
  async getDailyUsage(
    tenantId: string,
    days: number = 30
  ): Promise<{ date: string; inputTokens: number; outputTokens: number; cost: number }[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = await db
      .select({
        quantity: usageRecords.quantity,
        timestamp: usageRecords.timestamp,
      })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.tenantId, tenantId),
          eq(usageRecords.type, 'tokens'),
          gte(usageRecords.timestamp, startDate),
          lte(usageRecords.timestamp, endDate)
        )
      );

    // Aggregate by day
    const dailyUsage = new Map<string, { inputTokens: number; outputTokens: number; cost: number }>();

    for (const record of records) {
      const date = record.timestamp.toISOString().split('T')[0];
      const existing = dailyUsage.get(date) || { inputTokens: 0, outputTokens: 0, cost: 0 };

      const quantity = record.quantity as {
        inputTokens: number;
        outputTokens: number;
        model: string;
      };

      existing.inputTokens += quantity.inputTokens || 0;
      existing.outputTokens += quantity.outputTokens || 0;

      const costs = MODEL_COSTS[quantity.model] || MODEL_COSTS['claude-sonnet-4-20250514'];
      existing.cost +=
        (quantity.inputTokens / 1_000_000) * costs.input +
        (quantity.outputTokens / 1_000_000) * costs.output;

      dailyUsage.set(date, existing);
    }

    // Fill in missing days with zeros
    const result: { date: string; inputTokens: number; outputTokens: number; cost: number }[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const date = current.toISOString().split('T')[0];
      result.push({
        date,
        ...(dailyUsage.get(date) || { inputTokens: 0, outputTokens: 0, cost: 0 }),
      });
      current.setDate(current.getDate() + 1);
    }

    return result;
  }
}

export const usageTracker = new UsageTracker();
