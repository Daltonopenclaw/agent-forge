import { pgTable, uuid, text, timestamp, jsonb, varchar } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 50 }).unique().notNull(),
  ownerId: text('owner_id').notNull(), // Clerk user ID
  databaseUrl: text('database_url').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const agents = pgTable('agents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull().default('claude-sonnet-4-20250514'),
  systemPrompt: text('system_prompt').notNull().default(''),
  config: jsonb('config').notNull().default({}),
  status: varchar('status', { length: 20 }).notNull().default('idle'),
  lastActiveAt: timestamp('last_active_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  keyHash: text('key_hash').notNull(), // Store hashed, return plaintext once on creation
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
});

export const usageRecords = pgTable('usage_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  agentId: uuid('agent_id').references(() => agents.id),
  type: varchar('type', { length: 50 }).notNull(), // 'compute', 'tokens', 'storage'
  quantity: jsonb('quantity').notNull(), // { inputTokens: N, outputTokens: N } or { seconds: N }
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});
