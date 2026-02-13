import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { clerkMiddleware } from './middleware/clerk.js';
import { tenantsRouter } from './routes/tenants.js';
import { agentsRouter } from './routes/agents.js';
import { healthRouter } from './routes/health.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['https://myintell.ai', 'http://localhost:3000'],
  credentials: true,
}));

// Public routes
app.route('/health', healthRouter);

// Protected routes
app.use('/api/*', clerkMiddleware);
app.route('/api/tenants', tenantsRouter);
app.route('/api/agents', agentsRouter);

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

const port = parseInt(process.env.PORT || '3001');
console.log(`🚀 Platform API running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });

export default app;
