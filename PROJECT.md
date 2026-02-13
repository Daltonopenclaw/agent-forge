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
- [ ] Nothing active

### ⏳ Next Up
1. **GitHub repo** — version control + CI/CD
2. **Platform API** — tenant provisioning, agent lifecycle, auth, metering
3. **Dashboard UI** — signup, agent management, usage

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

*Last updated: 2026-02-12 by Dalton*
