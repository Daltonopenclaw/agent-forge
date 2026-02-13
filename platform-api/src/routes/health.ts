import { Hono } from 'hono';

export const healthRouter = new Hono();

healthRouter.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

healthRouter.get('/ready', async (c) => {
  // TODO: Add DB connection check
  return c.json({ ready: true });
});
