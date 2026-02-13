import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { agents, tenants } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export const agentsRouter = new Hono();

const createAgentSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  model: z.string().default('claude-sonnet-4-20250514'),
  systemPrompt: z.string().optional(),
  config: z.record(z.any()).optional(),
});

// List agents for a tenant
agentsRouter.get('/', async (c) => {
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
  
  const tenantAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.tenantId, tenantId));
  
  return c.json({ agents: tenantAgents });
});

// Create agent
agentsRouter.post('/', zValidator('json', createAgentSchema), async (c) => {
  const auth = c.get('auth');
  const data = c.req.valid('json');
  
  // Verify user owns tenant
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, data.tenantId), eq(tenants.ownerId, auth.userId)))
    .limit(1);
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found or access denied' }, 404);
  }
  
  const [agent] = await db
    .insert(agents)
    .values({
      tenantId: data.tenantId,
      name: data.name,
      model: data.model,
      systemPrompt: data.systemPrompt || '',
      config: data.config || {},
      status: 'idle',
    })
    .returning();
  
  // TODO: Create K8s deployment for agent (scaled to 0 initially)
  
  return c.json({ agent }, 201);
});

// Get agent
agentsRouter.get('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1);
  
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  // Verify ownership via tenant
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, agent.tenantId), eq(tenants.ownerId, auth.userId)))
    .limit(1);
  
  if (!tenant) {
    return c.json({ error: 'Access denied' }, 403);
  }
  
  return c.json({ agent });
});

// Wake agent (scale up from 0)
agentsRouter.post('/:id/wake', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  
  // TODO: Verify ownership
  // TODO: Scale K8s deployment to 1
  
  await db
    .update(agents)
    .set({ status: 'running', lastActiveAt: new Date() })
    .where(eq(agents.id, id));
  
  return c.json({ status: 'waking' });
});

// Delete agent
agentsRouter.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  
  // TODO: Verify ownership
  // TODO: Delete K8s deployment
  
  await db
    .update(agents)
    .set({ status: 'deleted', deletedAt: new Date() })
    .where(eq(agents.id, id));
  
  return c.json({ success: true });
});
