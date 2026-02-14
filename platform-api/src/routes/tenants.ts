import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { tenants } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const tenantsRouter = new Hono();

const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/), // Allow underscores for Clerk userIds
});

// List user's tenants
tenantsRouter.get('/', async (c) => {
  const auth = c.get('auth');
  
  const userTenants = await db
    .select()
    .from(tenants)
    .where(eq(tenants.ownerId, auth.userId));
  
  return c.json({ tenants: userTenants });
});

// Create new tenant
tenantsRouter.post('/', zValidator('json', createTenantSchema), async (c) => {
  const auth = c.get('auth');
  const { name, slug } = c.req.valid('json');
  
  // Check if slug is taken
  const existing = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  
  if (existing.length > 0) {
    return c.json({ error: 'Slug already taken' }, 409);
  }
  
  // Create tenant record
  // Note: For MVP, tenant state lives on K8s PVs (not per-tenant Neon DBs)
  // databaseUrl field reserved for future use if needed
  const [tenant] = await db
    .insert(tenants)
    .values({
      name,
      slug,
      ownerId: auth.userId,
      databaseUrl: '', // Not used in current architecture
      status: 'active',
    })
    .returning();
  
  return c.json({ tenant }, 201);
});

// Get tenant by ID
tenantsRouter.get('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }
  
  if (tenant.ownerId !== auth.userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  
  return c.json({ tenant });
});

// Delete tenant
tenantsRouter.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  
  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }
  
  if (tenant.ownerId !== auth.userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  
  // TODO: Deprovision Neon DB, clean up K8s namespace
  
  await db
    .update(tenants)
    .set({ status: 'deleted', deletedAt: new Date() })
    .where(eq(tenants.id, id));
  
  return c.json({ success: true });
});
