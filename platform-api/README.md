# MyIntell Platform API

Multi-tenant agent management API for myintell.ai.

## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Hono (fast, lightweight)
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Clerk
- **Tenant DBs:** Neon (serverless, auto-pause)

## Setup

1. Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Run database migrations:

```bash
npm run db:migrate
```

4. Start dev server:

```bash
npm run dev
```

## API Endpoints

### Health

- `GET /health` — Basic health check
- `GET /health/ready` — Readiness check (includes DB)

### Tenants (requires auth)

- `GET /api/tenants` — List user's tenants
- `POST /api/tenants` — Create new tenant
- `GET /api/tenants/:id` — Get tenant details
- `DELETE /api/tenants/:id` — Delete tenant (soft delete)

### Agents (requires auth)

- `GET /api/agents?tenantId=xxx` — List agents for tenant
- `POST /api/agents` — Create agent
- `GET /api/agents/:id` — Get agent details
- `POST /api/agents/:id/wake` — Wake agent (scale up)
- `DELETE /api/agents/:id` — Delete agent (soft delete)

## Authentication

All `/api/*` routes require a valid Clerk JWT in the Authorization header:

```
Authorization: Bearer <clerk_jwt>
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Platform API                              │
├─────────────────────────────────────────────────────────────┤
│  Routes          │  Services        │  Database              │
│  ├── /health     │  ├── neon.ts     │  ├── Platform PG       │
│  ├── /tenants    │  │   (provision) │  │   (tenants, agents) │
│  └── /agents     │  └── k8s.ts      │  └── Per-tenant Neon   │
│                  │      (deploy)    │      (agent data)      │
└─────────────────────────────────────────────────────────────┘
```

## TODO

- [ ] K8s deployment service (create/scale deployments)
- [ ] API key auth (in addition to Clerk)
- [ ] Usage metering and billing
- [ ] Webhook endpoints for agent events
- [ ] Rate limiting
