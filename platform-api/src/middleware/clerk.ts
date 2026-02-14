import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';

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
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    
    if (!payload?.sub) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    c.set('auth', { 
      userId: payload.sub, 
      sessionId: payload.sid || '', 
      orgId: payload.org_id 
    });
    await next();
  } catch (error) {
    console.error('Auth error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
});
