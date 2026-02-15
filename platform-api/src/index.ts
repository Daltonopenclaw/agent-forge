import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { clerkMiddleware } from './middleware/clerk.js';
import { tenantsRouter } from './routes/tenants.js';
import { agentsRouter } from './routes/agents.js';
import { usageRouter } from './routes/usage.js';
import { healthRouter } from './routes/health.js';
import { setupWebSocketProxy } from './services/ws-proxy.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['https://myintell.ai', 'http://localhost:3000'],
  credentials: true,
}));

// Public routes
app.route('/health', healthRouter);

// Public webhook for agent usage reporting (no auth required)
// Agents call this to report token usage
import { usageTracker } from './services/usage.js';
import { db } from './db/index.js';
import { agents } from './db/schema.js';
import { eq } from 'drizzle-orm';

app.post('/webhook/usage', async (c) => {
  try {
    const data = await c.req.json();
    
    // Basic validation
    if (!data.agentId || typeof data.inputTokens !== 'number' || typeof data.outputTokens !== 'number') {
      return c.json({ error: 'Invalid payload' }, 400);
    }
    
    // Get agent's tenant
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
      model: data.model || 'unknown',
    });
    
    return c.json({ success: true });
  } catch (err) {
    console.error('Usage webhook error:', err);
    return c.json({ error: 'Internal error' }, 500);
  }
});

// Protected routes
app.use('/api/*', clerkMiddleware);
app.route('/api/tenants', tenantsRouter);
app.route('/api/agents', agentsRouter);
app.route('/api/usage', usageRouter);

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

const port = parseInt(process.env.PORT || '3001');
console.log(`🚀 Platform API running on http://localhost:${port}`);

const server = serve({ fetch: app.fetch, port });

// Attach WebSocket proxy to the same server
setupWebSocketProxy(server);

export default app;
