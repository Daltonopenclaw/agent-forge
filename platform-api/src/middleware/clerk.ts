import { createMiddleware } from 'hono/factory';
import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export type ClerkAuth = {
  userId: string;
  sessionId: string;
  orgId?: string;
};

declare module 'hono' {
  interface ContextVariableMap {
    auth: ClerkAuth;
  }
}

export const clerkMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { sub: userId, sid: sessionId, org_id: orgId } = await clerk.verifyToken(token);
    
    if (!userId) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    c.set('auth', { userId, sessionId: sessionId || '', orgId });
    await next();
  } catch (error) {
    console.error('Auth error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
});
