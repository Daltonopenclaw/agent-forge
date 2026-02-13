# AgentForge / myintell.ai — Project Plan

**Domain:** myintell.ai  
**Tagline:** "Your superfriends"  
**What:** Multi-tenant AI agent platform — users get their own AI agents that scale to zero when idle.

---

## Vision

A platform where anyone can spin up persistent AI agents ("superfriends") that:
- Run 24/7 but cost nearly nothing when idle (scale-to-zero)
- Have memory, personality, integrations
- Are accessible via API, chat, or custom interfaces

Think: "Heroku for AI agents"

---

## Current State (2026-02-12)

### ✅ Done
- [x] Terraform infrastructure (K3s, multi-tenant, KEDA, Neon) — `/terraform/`
- [x] Domain acquired: myintell.ai
- [x] Cloudflare DNS configured (pointing to Helsinki server for now)
- [x] Landing page live: "Your superfriends coming soon"

### 🔨 In Progress
- [ ] Platform API — needs K8s integration, deploy to cluster

### ⏳ Next Up
1. ~~GitHub repo~~ ✅ https://github.com/Daltonopenclaw/agent-forge
2. ~~Platform API scaffold~~ ✅ `/platform-api/`
3. ~~Platform DB~~ ✅ Neon (aws-us-east-1)
   - Tables: tenants, agents, api_keys, usage_records
   - Migrations applied
   - Health check working
4. **Dashboard UI** ← NEXT
5. **Deploy to K3s cluster**

### 🔮 Future
- [ ] Agent templates / marketplace
- [ ] Custom integrations (Slack, Discord, email, etc.)
- [ ] Billing integration (Stripe)
- [ ] Public launch

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     myintell.ai                             │
├─────────────────────────────────────────────────────────────┤
│  Dashboard (Next.js)          │  API (Go/Node)              │
│  - Signup/login               │  - POST /tenants            │
│  - Agent management           │  - POST /agents             │
│  - Usage & billing            │  - Webhooks                 │
├─────────────────────────────────────────────────────────────┤
│                    K3s Cluster (Hetzner)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Tenant A    │  │ Tenant B    │  │ Tenant C    │  ...    │
│  │ (namespace) │  │ (namespace) │  │ (namespace) │         │
│  │  Agent pods │  │  Agent pods │  │  Agent pods │         │
│  │  (KEDA →0)  │  │  (KEDA →0)  │  │  (KEDA →0)  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  Neon (serverless Postgres per tenant, auto-pause)          │
│  Traefik (ingress, routing)                                 │
│  Prometheus + KEDA (scale-to-zero)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Infra Details

- **Hosting:** Hetzner Cloud (Helsinki or Ashburn)
- **Domain:** myintell.ai (Cloudflare DNS, Flexible SSL)
- **Cluster:** K3s with Traefik, cert-manager, KEDA
- **Database:** Neon (serverless Postgres, per-tenant)
- **Secrets:** Sealed Secrets (GitOps-safe)

---

## Cost Estimates

| Component | Monthly |
|-----------|---------|
| Platform base (K3s cluster) | ~$30-50 |
| Per tenant (idle) | ~$0-5 |
| Per tenant (active) | ~$5-25 |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-12 | Domain: myintell.ai | Short, memorable, .ai TLD fits |
| 2026-02-12 | Cloudflare for DNS | Free tier, DDoS protection, easy API |
| 2026-02-12 | Landing page on Helsinki server | Simple, no extra cost for "coming soon" |
| 2026-02-12 | Platform API: Node/TS + Hono | Fast iteration for MVP, lightweight framework |
| 2026-02-12 | Auth: Clerk | $0 to start, handles OAuth/magic links, fast integration |
| 2026-02-12 | ORM: Drizzle | TypeScript-first, lightweight, good DX |
| 2026-02-12 | Platform DB: Neon (aws-us-east-1) | Serverless, auto-pause, free tier, near Hetzner Ashburn |
| 2026-02-12 | Postgres 17 | Latest stable |

---

## Open Questions

- [ ] Platform API language: Go vs Node vs Python?
- [ ] Auth: Roll our own vs Clerk vs Auth0?
- [ ] What's the MVP feature set for first users?
- [ ] Pricing model?

---

## Links

- Terraform: `/root/.openclaw/workspace/agent_forge/terraform/`
- Landing page: `/var/www/myintell.ai/`
- Cloudflare creds: 1Password → "Cloudflare - myintell.ai"

---

---

## Architecture Rationale

_The thinking behind our design decisions._

### 1. Two-Tier Infrastructure (Shared + Per-Tenant)

Expensive resources are shared, cheap resources are isolated:

```
SHARED (one-time cost, amortized)       PER-TENANT (scales with customers)
├── Load Balancer / Ingress             ├── Container/Pod
├── Database Cluster                    ├── Database (within cluster)
├── Container Orchestrator              ├── Storage bucket
├── Secrets Management                  ├── CDN distribution
└── Networking (VPC)                    └── Routing rules
```

**K8s Translation:**

| Your ECS Design | K3s Equivalent |
|-----------------|----------------|
| ECS Cluster (Fargate) | K3s cluster on Hetzner/AWS |
| ALB (shared) | Traefik Ingress (built into K3s) |
| Target Groups | K8s Services |
| Task Definitions | Deployments + Pod specs |
| ECR | Harbor (self-hosted) or still ECR |
| Aurora Serverless | CockroachDB Serverless, Neon, or Postgres + PgBouncer |

---

### 2. Header-Based Multi-Tenant Routing

One ingress serves all tenants using injected headers that can't be spoofed:

```
CloudFront adds: X-Tenant-Host: deepwork-tracker
                        │
                        ▼
              ALB checks header + path
                        │
                        ▼
              Routes to correct backend
```

**Traefik IngressRoute (per tenant):**

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: tenant-deepwork-tracker
  namespace: tenants
spec:
  entryPoints:
    - websecure
  routes:
    - match: "PathPrefix(`/api`) && Headers(`X-Tenant-Host`, `deepwork-tracker`)"
      kind: Rule
      services:
        - name: deepwork-tracker-backend
          port: 3000
```

**CDN:** Cloudflare in front of K3s ingress, injecting the tenant header.

---

### 3. Database Strategy: Shared Cluster, Isolated DBs

- **Platform DB:** SQLite on persistent volume (cheap, simple)
- **Tenant DBs:** Database-per-tenant within shared cluster

**Options:**

| Option | Cost (idle) | Cost (active) | Complexity |
|--------|-------------|---------------|------------|
| Neon (serverless Postgres) | $0 (auto-suspend) | ~$10/mo | Low |
| CockroachDB Serverless | $0 (free tier) | ~$30/mo | Low |
| Self-hosted Postgres + PgBouncer | ~$5/mo | ~$15/mo | Medium |
| Supabase self-hosted | ~$10/mo | ~$20/mo | Medium |

**Decision:** Neon for tenant DBs — same auto-pause behavior as Aurora Serverless but cheaper.

---

### 4. Scale-to-Zero for Tenant Workloads

**KEDA (Kubernetes Event-Driven Autoscaling):**

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: tenant-deepwork-tracker
spec:
  scaleTargetRef:
    name: deepwork-tracker-backend
  minReplicaCount: 0  # Scale to zero!
  maxReplicaCount: 3
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        metricName: http_requests_total
        threshold: '1'
        query: sum(rate(http_requests_total{service="deepwork-tracker"}[2m]))
```

When no traffic → pods scale to 0 → only pay for storage.

**Cold start mitigation:** Keep a "warm pool" of generic containers that can be assigned to any tenant on first request (~2-3 second cold start vs 30+ seconds).

---

### 5. Agent Architecture Pattern

Specialized agents with narrow toolsets work better than one agent with everything:

```
Main Orchestrator (OpenClaw + Claude)
│
├── coding-agent (Claude Code CLI)
├── web-qa-agent (Playwright + Claude)
├── mobile-qa-agent (Emulator + Maestro + Claude)
├── deploy-agent (Terraform/Pulumi + Claude)
├── infra-agent (K8s manifests + Claude)
└── research-agent (web_search + Claude)
```

---

### 6. Cost Comparison: DIY K3s vs Vercel/Supabase

**Per-Tenant Costs:**

| | Vercel + Supabase | DIY K3s (Hetzner) | DIY K3s (AWS) |
|---|---|---|---|
| Idle tenant | $25/mo (Supabase Pro) | ~$1-5/mo | ~$5-10/mo |
| Active tenant | $45-70/mo | ~$5-25/mo | ~$30-50/mo |
| Platform overhead | $0 | ~$50/mo (shared) | ~$100/mo (shared) |

**Break-Even Analysis:**

```
Vercel/Supabase: $25/tenant × N tenants
DIY K3s (Hetzner): $50 + ($3/tenant × N tenants)

Break-even: 50 + 3N = 25N → N ≈ 2-3 tenants
```

DIY wins almost immediately if you can handle the ops overhead.

---

### 7. Full K3s Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SHARED PLATFORM (Hetzner)                        │
│                       ~$50-80/month base cost                       │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ K3s Master   │  │ K3s Workers  │  │ Postgres (Platform DB)  │   │
│  │ (CX21 $5/mo) │  │ (2x CX31     │  │ SQLite or small PG      │   │
│  │              │  │  $20/mo)     │  │ instance                │   │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘   │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ Traefik      │  │ Harbor       │  │ Vault / Sealed Secrets  │   │
│  │ Ingress      │  │ Registry     │  │ (credentials)           │   │
│  │ (built-in)   │  │              │  │                         │   │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           Cloudflare (CDN + DNS + Header Injection)          │  │
│  │  - *.myintell.ai → K3s Ingress                               │  │
│  │  - Adds X-Tenant-Host header per subdomain                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                PER-TENANT (in shared cluster)                       │
│                ~$1-5/month idle, ~$5-25 active                      │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ Deployment   │  │ Service      │  │ Neon DB (auto-pause)    │   │
│  │ (KEDA scaled │  │ (ClusterIP)  │  │ or DB in shared PG      │   │
│  │  to 0)       │  │              │  │                         │   │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘   │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ R2 Bucket    │  │ IngressRoute │  │ Sealed Secret           │   │
│  │ (Cloudflare, │  │ (tenant      │  │ (tenant credentials)    │   │
│  │  S3-compat)  │  │  routing)    │  │                         │   │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │               Agent Workspace (PVC)                          │  │
│  │  - /workspace (code, memory, config)                         │  │
│  │  - Mounted into agent pods                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

*Last updated: 2026-02-12 by Dalton*
