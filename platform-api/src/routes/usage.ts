import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { agents, tenants } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { usageTracker } from '../services/usage.js';

export const usageRouter = new Hono();

// Schema for usage webhook from agents
const usageWebhookSchema = z.object({
  agentId: z.string().uuid(),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  model: z.string(),
  timestamp: z.string().datetime().optional(),
});

// Webhook endpoint for agents to report usage
// Called by OpenClaw via webhook config
usageRouter.post('/webhook', zValidator('json', usageWebhookSchema), async (c) => {
  const data = c.req.valid('json');
  
  // Verify agent exists and get tenant
  const [agent] = await db
    .select({ tenantId: agents.tenantId })
    .from(agents)
    .where(eq(agents.id, data.agentId))
    .limit(1);
  
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  // Record usage
  await usageTracker.recordUsage({
    agentId: data.agentId,
    tenantId: agent.tenantId,
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    model: data.model,
    timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
  });
  
  return c.json({ success: true });
});

// Get usage summary for authenticated user's tenant
usageRouter.get('/summary', async (c) => {
  const auth = c.get('auth');
  const tenantId = c.req.query('tenantId');
  
  if (!tenantId) {
    return c.json({ error: 'tenantId required' }, 400);
  }
  
  // Verify user owns tenant
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.ownerId, auth.userId)))
    .limit(1);
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found or access denied' }, 404);
  }
  
  // Get date range from query params
  const startDate = c.req.query('startDate')
    ? new Date(c.req.query('startDate')!)
    : new Date(new Date().setDate(new Date().getDate() - 30));
  const endDate = c.req.query('endDate')
    ? new Date(c.req.query('endDate')!)
    : new Date();
  
  const usage = await usageTracker.getTenantUsage(tenantId, startDate, endDate);
  const totalCost = await usageTracker.getCurrentPeriodCost(tenantId);
  
  return c.json({
    usage,
    totalCost,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  });
});

// Get daily usage for charts
usageRouter.get('/daily', async (c) => {
  const auth = c.get('auth');
  const tenantId = c.req.query('tenantId');
  const days = parseInt(c.req.query('days') || '30');
  
  if (!tenantId) {
    return c.json({ error: 'tenantId required' }, 400);
  }
  
  // Verify user owns tenant
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.ownerId, auth.userId)))
    .limit(1);
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found or access denied' }, 404);
  }
  
  const dailyUsage = await usageTracker.getDailyUsage(tenantId, days);
  
  return c.json({ daily: dailyUsage });
});

// Get current period cost (for dashboard)
usageRouter.get('/cost', async (c) => {
  const auth = c.get('auth');
  const tenantId = c.req.query('tenantId');
  
  if (!tenantId) {
    return c.json({ error: 'tenantId required' }, 400);
  }
  
  // Verify user owns tenant
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.ownerId, auth.userId)))
    .limit(1);
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found or access denied' }, 404);
  }
  
  const cost = await usageTracker.getCurrentPeriodCost(tenantId);
  
  return c.json({ cost });
});
