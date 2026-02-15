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

// Wake/retry agent (re-provision if failed or restart if running)
agentsRouter.post('/:id/wake', async (c) => {
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
  
  // Verify ownership
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, agent.tenantId), eq(tenants.ownerId, auth.userId)))
    .limit(1);
  
  if (!tenant) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const config = (agent.config || {}) as Record<string, any>;
  
  // If error status, try to re-provision
  if (agent.status === 'error' || agent.status === 'idle') {
    // Update status to provisioning
    await db
      .update(agents)
      .set({ status: 'provisioning' })
      .where(eq(agents.id, id));

    // Re-provision
    const agentConfig: AgentConfig = {
      agentId: agent.id,
      tenantId: agent.tenantId,
      name: agent.name,
      avatar: config.avatar || '🤖',
      personalityType: config.personalityType || 'personal-assistant',
      soulContent: agent.systemPrompt || '',
      agentsContent: '',
      modelTier: config.modelTier || 'smart',
    };

    // Run async
    provisionAgent(agent.id, agentConfig);
    
    return c.json({ 
      message: 'Re-provisioning started',
      status: 'provisioning',
    });
  }
  
  // If running, just restart the pod
  if (agent.status === 'running' && config.namespace) {
    try {
      await provisioner.restartAgent(config.namespace);
      return c.json({ message: 'Agent restarted', status: 'running' });
    } catch (error) {
      return c.json({ error: 'Failed to restart agent' }, 500);
    }
  }

  return c.json({ message: 'Agent is already running or provisioning', status: agent.status });
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

  // Format response
  const config = (agent.config || {}) as Record<string, any>;
  const agentSlug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + agent.id.substring(0, 8);
  
  return c.json({
    id: agent.id,
    name: agent.name,
    avatar: config.avatar || '🤖',
    status: agent.status,
    subdomain: `agent-${agentSlug}`,
    model: agent.model,
    channels: config.channels || { webchat: { enabled: true } },
    createdAt: agent.createdAt,
  });
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

// ============ Channel Management ============

const telegramConnectSchema = z.object({
  botToken: z.string().min(40).max(100),
});

// Connect Telegram
agentsRouter.post('/:id/channels/telegram', zValidator('json', telegramConnectSchema), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const { botToken } = c.req.valid('json');
  
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1);
  
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  // Verify ownership
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, agent.tenantId), eq(tenants.ownerId, auth.userId)))
    .limit(1);
  
  if (!tenant) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Validate bot token by calling Telegram API
  try {
    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const telegramData = await telegramRes.json() as { ok: boolean; result?: { username: string } };
    
    if (!telegramData.ok) {
      return c.json({ error: 'Invalid bot token' }, 400);
    }

    const botUsername = telegramData.result?.username;

    // Update agent config in K8s
    const namespace = (agent.config as any)?.namespace;
    if (namespace) {
      await provisioner.updateAgentChannel(namespace, 'telegram', {
        enabled: true,
        botToken,
      });
    }

    // Update agent record
    const currentConfig = (agent.config || {}) as Record<string, any>;
    await db
      .update(agents)
      .set({
        config: {
          ...currentConfig,
          channels: {
            ...(currentConfig.channels || {}),
            telegram: { enabled: true, botUsername },
          },
        },
      })
      .where(eq(agents.id, id));

    return c.json({ 
      success: true, 
      botUsername,
      message: `Connected to @${botUsername}. Your agent will now respond to Telegram messages.`,
    });
  } catch (error) {
    console.error('Telegram connect error:', error);
    return c.json({ error: 'Failed to connect Telegram' }, 500);
  }
});

// Disconnect Telegram
agentsRouter.delete('/:id/channels/telegram', async (c) => {
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
  
  // Verify ownership
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, agent.tenantId), eq(tenants.ownerId, auth.userId)))
    .limit(1);
  
  if (!tenant) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Update K8s config to disable Telegram
  const namespace = (agent.config as any)?.namespace;
  if (namespace) {
    await provisioner.updateAgentChannel(namespace, 'telegram', {
      enabled: false,
    });
  }

  // Update agent record
  const currentConfig = (agent.config || {}) as Record<string, any>;
  await db
    .update(agents)
    .set({
      config: {
        ...currentConfig,
        channels: {
          ...(currentConfig.channels || {}),
          telegram: { enabled: false },
        },
      },
    })
    .where(eq(agents.id, id));

  return c.json({ success: true });
});
