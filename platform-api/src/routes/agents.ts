import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { agents, tenants } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { provisioner, type AgentConfig, type ProvisioningStatus } from '../services/provisioner.js';

export const agentsRouter = new Hono();

// In-memory provisioning status (in production, use Redis or DB)
const provisioningStatus = new Map<string, ProvisioningStatus>();

const createAgentSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(2).max(30),
  avatar: z.string().default('🤖'),
  personalityType: z.enum(['personal-assistant', 'research-partner', 'creative-collaborator', 'technical-expert', 'custom']),
  soulContent: z.string(),
  agentsContent: z.string(),
  modelTier: z.enum(['smart', 'powerful', 'fast']).default('smart'),
  byokProvider: z.enum(['anthropic', 'openai']).optional(),
  byokApiKey: z.string().optional(),
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

// Create and provision agent
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
  
  // Create agent record
  const [agent] = await db
    .insert(agents)
    .values({
      tenantId: data.tenantId,
      name: data.name,
      model: data.modelTier === 'powerful' ? 'claude-opus-4-20250514' : 
             data.modelTier === 'fast' ? 'claude-3-5-haiku-20241022' : 
             'claude-sonnet-4-20250514',
      systemPrompt: data.soulContent,
      config: {
        avatar: data.avatar,
        personalityType: data.personalityType,
        modelTier: data.modelTier,
        byokProvider: data.byokProvider,
      },
      status: 'provisioning',
    })
    .returning();

  // Start provisioning in background
  const agentConfig: AgentConfig = {
    agentId: agent.id,
    tenantId: data.tenantId,
    name: data.name,
    avatar: data.avatar,
    personalityType: data.personalityType,
    soulContent: data.soulContent,
    agentsContent: data.agentsContent,
    modelTier: data.modelTier,
    byokProvider: data.byokProvider,
    byokApiKey: data.byokApiKey,
  };

  // Run provisioning async
  provisionAgent(agent.id, agentConfig);
  
  return c.json({ 
    agent,
    message: 'Provisioning started. Poll /api/agents/{id}/status for progress.',
  }, 201);
});

// Background provisioning function
async function provisionAgent(agentId: string, config: AgentConfig) {
  try {
    await provisioner.provision(config, (status) => {
      provisioningStatus.set(agentId, status);
    });
    
    // Update agent status to running
    await db
      .update(agents)
      .set({ 
        status: 'running',
        config: {
          ...((await db.select().from(agents).where(eq(agents.id, agentId)))[0]?.config || {}),
          namespace: `agent-${config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${agentId.substring(0, 8)}`,
        },
      })
      .where(eq(agents.id, agentId));
      
  } catch (error) {
    console.error('Provisioning failed:', error);
    await db
      .update(agents)
      .set({ 
        status: 'error',
        config: {
          ...((await db.select().from(agents).where(eq(agents.id, agentId)))[0]?.config || {}),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      .where(eq(agents.id, agentId));
  }
}

// Get provisioning status
agentsRouter.get('/:id/status', async (c) => {
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

  // Get provisioning status if still in progress
  const status = provisioningStatus.get(id);
  
  return c.json({
    agentId: id,
    agentStatus: agent.status,
    provisioning: status || null,
  });
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

// Delete agent
agentsRouter.delete('/:id', async (c) => {
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

  // Deprovision K8s resources
  const namespace = (agent.config as any)?.namespace;
  if (namespace) {
    try {
      await provisioner.deprovision(namespace);
    } catch (error) {
      console.error('Deprovision error:', error);
    }
  }
  
  // Soft delete
  await db
    .update(agents)
    .set({ status: 'deleted', deletedAt: new Date() })
    .where(eq(agents.id, id));
  
  return c.json({ success: true });
});
