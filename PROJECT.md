# AgentForge / myintell.ai — Project Plan

**Domain:** myintell.ai  
**Tagline:** "Your superfriends"  
**What:** Multi-tenant AI agent platform — users get their own persistent AI agents powered by OpenClaw.

---

## Vision

A platform where anyone can spin up persistent AI agents ("superfriends") that:
- Run 24/7 with an always-on orchestrator per tenant
- Have memory, personality, integrations
- Can spawn sub-agents and provision infrastructure on demand
- Are accessible via API, chat, or custom interfaces

Think: "Heroku for AI agents"

---

## Current State (2026-02-14)

### ✅ Done
- [x] GitHub repo: https://github.com/Daltonopenclaw/agent-forge
- [x] Domain acquired: myintell.ai
- [x] Cloudflare DNS configured
- [x] Landing page live: https://myintell.ai
- [x] Platform API deployed: https://api.myintell.ai (Helsinki server)
- [x] Dashboard UI deployed: https://myintell.ai (Vercel)
- [x] Platform DB: Neon (aws-us-east-1)
- [x] Auth: Clerk integration
- [x] Terraform infrastructure (K3s, multi-tenant) — `/terraform/`

### ⏳ Next Up
1. ~~Wire dashboard forms to API~~ ✅ Done
2. **Test tenant/agent creation end-to-end** ← Current
3. **Implement orchestrator provisioning controller**
4. **Set up gVisor for sandboxed sub-agents**

### 🔮 Future
- [ ] Agent templates / marketplace
- [ ] Custom integrations (Slack, Discord, email, etc.)
- [ ] Billing integration (Stripe)
- [ ] Public launch

---

## Architecture (Revised 2026-02-14)

### Design Philosophy

**"Always-On Orchestrator"** — Each tenant gets a dedicated OpenClaw Gateway that:
- Is always running (instant response, no cold starts)
- Owns all tenant state (sessions, memory, workspace)
- Can spawn ephemeral sub-agents as K8s Jobs
- Can provision infrastructure (databases, apps) in its namespace

**"Hard Multi-Tenancy"** — Tenants don't trust each other, agents run untrusted code:
- Namespace isolation with NetworkPolicies
- gVisor sandboxing for sub-agent pods
- Minimal RBAC (orchestrator can only create Jobs in its namespace)
- Platform gateway as security perimeter

### Full Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PLATFORM LAYER (shared)                         │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Platform Gateway │  │ Neon (platform)  │  │ Provisioning     │  │
│  │ ─────────────────│  │ ────────────────│  │ Controller       │  │
│  │ • Auth (Clerk)   │  │ • tenants table  │  │ ────────────────│  │
│  │ • TLS termination│  │ • billing/usage  │  │ • Creates NS     │  │
│  │ • Rate limiting  │  │ • audit logs     │  │ • Applies quotas │  │
│  │ • Tenant routing │  │ • agent metadata │  │ • Provisions PVs │  │
│  │ • WebSocket proxy│  │                  │  │ • Manages RBAC   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Traefik Ingress  │  │ Cloudflare       │  │ Container        │  │
│  │ (built into K3s) │  │ (CDN + DNS)      │  │ Registry         │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                     │
│                    K3s Cluster (Hetzner)                           │
│                    ~$50-80/month base cost                          │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌─────────────────┐
│  TENANT NAMESPACE:    │ │  TENANT NAMESPACE:    │ │  TENANT NS:     │
│  tenant-acme          │ │  tenant-globex        │ │  tenant-xxx     │
│                       │ │                       │ │                 │
│ ┌───────────────────┐ │ │ ┌───────────────────┐ │ │      ...        │
│ │ 🧠 ORCHESTRATOR   │ │ │ │ 🧠 ORCHESTRATOR   │ │ │                 │
│ │ (always-on)       │ │ │ │ (always-on)       │ │ │                 │
│ │                   │ │ │ │                   │ │ │                 │
│ │ OpenClaw Gateway  │ │ │ │ OpenClaw Gateway  │ │ │                 │
│ │ ~256MB RAM        │ │ │ │ ~256MB RAM        │ │ │                 │
│ └───────────────────┘ │ │ └───────────────────┘ │ │                 │
│          │            │ │          │            │ │                 │
│          ▼            │ │          ▼            │ │                 │
│ ┌─────────────────┐   │ │ ┌─────────────────┐   │ │                 │
│ │ PersistentVolume│   │ │ │ PersistentVolume│   │ │                 │
│ │ (RWO, local)    │   │ │ │ (RWO, local)    │   │ │                 │
│ │ ├── sessions/   │   │ │ │ ├── sessions/   │   │ │                 │
│ │ ├── memory.db   │   │ │ │ ├── memory.db   │   │ │                 │
│ │ └── workspace/  │   │ │ │ └── workspace/  │   │ │                 │
│ └─────────────────┘   │ │ └─────────────────┘   │ │                 │
│          │            │ │          │            │ │                 │
│    spawns on-demand   │ │    spawns on-demand   │ │                 │
│          ▼            │ │          ▼            │ │                 │
│ ┌─────┐ ┌─────┐ ┌───┐ │ │ ┌─────┐ ┌─────┐      │ │                 │
│ │Job: │ │Job: │ │Dep│ │ │ │Job: │ │Dep: │      │ │                 │
│ │code │ │rsch │ │app│ │ │ │code │ │ web │      │ │                 │
│ │agent│ │agnt │ │   │ │ │ │agnt │ │ app │      │ │                 │
│ │gVisor│ │gVisor│    │ │ │ │gVisor│      │      │ │                 │
│ └─────┘ └─────┘ └───┘ │ │ └─────┘ └─────┘      │ │                 │
│                       │ │                       │ │                 │
│ NetworkPolicy:        │ │ NetworkPolicy:        │ │                 │
│ default-deny          │ │ default-deny          │ │                 │
│                       │ │                       │ │                 │
│ ResourceQuota:        │ │ ResourceQuota:        │ │                 │
│ max 10 pods, 4Gi, 4CPU│ │ max 10 pods, 4Gi, 4CPU│ │                 │
└───────────────────────┘ └───────────────────────┘ └─────────────────┘
```

---

## Component Details

### 1. Platform Gateway

The security perimeter in front of all tenant orchestrators.

**Responsibilities:**
- Authenticate requests (Clerk JWT validation)
- Route to correct tenant namespace based on subdomain/header
- WebSocket proxying for chat connections
- Rate limiting per tenant
- TLS termination

**Implementation:** Traefik with middleware, or custom Go/Node service

### 2. Provisioning Controller

Kubernetes controller that provisions tenant infrastructure.

**On tenant signup:**
```
1. Create namespace: tenant-{slug}
2. Create ResourceQuota (based on plan)
3. Create NetworkPolicy (default-deny + allow orchestrator egress)
4. Create ServiceAccount + RBAC (orchestrator-sa)
5. Create PersistentVolumeClaim (orchestrator-pvc)
6. Create Deployment (orchestrator)
7. Create Service + IngressRoute
8. Store tenant metadata in Neon
```

**RBAC for orchestrator ServiceAccount:**
```yaml
# Orchestrator can ONLY create/delete Jobs and view pods in its namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: orchestrator-role
  namespace: tenant-acme
rules:
- apiGroups: ["batch"]
  resources: ["jobs"]
  verbs: ["create", "delete", "get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
```

### 3. Orchestrator (Per-Tenant)

Always-on OpenClaw Gateway that serves as the tenant's "main brain."

**Container spec:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orchestrator
  namespace: tenant-acme
spec:
  replicas: 1
  selector:
    matchLabels:
      app: orchestrator
  template:
    metadata:
      labels:
        app: orchestrator
    spec:
      serviceAccountName: orchestrator-sa
      containers:
      - name: openclaw
        image: openclaw/openclaw:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        ports:
        - containerPort: 4444
        env:
        - name: TENANT_ID
          value: "acme"
        - name: OPENCLAW_STATE_DIR
          value: "/state"
        - name: OPENCLAW_WORKSPACE
          value: "/state/workspace"
        volumeMounts:
        - name: state
          mountPath: /state
      volumes:
      - name: state
        persistentVolumeClaim:
          claimName: orchestrator-pvc
```

**What the orchestrator stores locally (on PV):**
- `/state/config.json5` — OpenClaw configuration
- `/state/sessions/` — Session transcripts (JSONL)
- `/state/memory.sqlite` — Memory index (sqlite-vec)
- `/state/workspace/` — Agent workspace (code, files, artifacts)

### 4. Sub-Agents (Ephemeral Jobs)

Spawned by the orchestrator for specific tasks.

**Example: Claude Code agent job**
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: code-agent-abc123
  namespace: tenant-acme
spec:
  ttlSecondsAfterFinished: 300  # Cleanup after 5 min
  template:
    spec:
      runtimeClassName: gvisor  # Sandboxed execution
      containers:
      - name: claude-code
        image: myintell/claude-code-agent:latest
        env:
        - name: TASK
          value: "Build a REST API for todo management"
        - name: CALLBACK_URL
          value: "http://orchestrator:4444/callback"
        resources:
          limits:
            memory: "2Gi"
            cpu: "1"
      restartPolicy: Never
  backoffLimit: 1
```

**Output collection patterns:**
1. **Callback to orchestrator** — Sub-agent POSTs results to orchestrator's callback endpoint
2. **Logs streaming** — Orchestrator watches pod logs via K8s API
3. **Shared volume** — For large artifacts, mount a shared PVC section

### 5. Security: gVisor Sandboxing

For running untrusted agent code safely.

**Why gVisor:**
- Intercepts syscalls, provides defense-in-depth
- Prevents container escapes
- Required for hard multi-tenancy with untrusted code

**Setup:**
```yaml
# RuntimeClass for gVisor
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
```

**All sub-agent Jobs use `runtimeClassName: gvisor`**

### 6. NetworkPolicies

Default-deny between tenant namespaces.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: tenant-acme
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-orchestrator-egress
  namespace: tenant-acme
spec:
  podSelector:
    matchLabels:
      app: orchestrator
  policyTypes:
  - Egress
  egress:
  - {}  # Orchestrator can reach internet (for LLM APIs, etc.)
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-from-gateway
  namespace: tenant-acme
spec:
  podSelector:
    matchLabels:
      app: orchestrator
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: platform
```

---

## Storage Strategy

### Why NOT Neon for Agent Memory

OpenClaw's memory system is SQLite-based (sqlite-vec for vectors, FTS5 for text search). Moving to Postgres would require:
- Building a custom memory backend
- Diverging from upstream OpenClaw
- Added complexity for marginal benefit

**SQLite is fine** when:
- Single writer per tenant (our model)
- Local persistent volume (NOT network filesystem)
- No multi-replica orchestrators

### Storage Breakdown

| Data | Location | Why |
|------|----------|-----|
| Platform data (tenants, billing, audit) | Neon (shared) | Relational, serverless, cheap |
| Session transcripts | Local PV | OpenClaw-native, JSONL format |
| Memory index | Local PV (SQLite) | OpenClaw-native, fast vector search |
| Workspace files | Local PV | Code, configs, generated files |
| Large artifacts | R2/S3 | Cheap object storage, shareable |

---

## Cost Model (Revised)

| Component | Monthly Cost |
|-----------|--------------|
| **Platform (shared)** | |
| K3s cluster (3 nodes) | ~$50 |
| Neon (platform DB) | ~$0-25 |
| Cloudflare (DNS/CDN) | $0 |
| **Per Tenant** | |
| Orchestrator pod (always-on) | ~$3-5 |
| PersistentVolume (10GB) | ~$1 |
| Sub-agent Jobs (usage-based) | ~$0-10 |
| **Total per idle tenant** | **~$4-6/mo** |
| **Total per active tenant** | **~$10-25/mo** |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-12 | Domain: myintell.ai | Short, memorable, .ai TLD fits |
| 2026-02-12 | Platform API: Node/TS + Hono | Fast iteration for MVP |
| 2026-02-12 | Auth: Clerk | $0 to start, handles OAuth/magic links |
| 2026-02-12 | Platform DB: Neon | Serverless, auto-pause, free tier |
| 2026-02-14 | **Always-on orchestrator model** | Simpler than KEDA scale-to-zero, instant response |
| 2026-02-14 | **SQLite for agent memory (not Neon)** | OpenClaw-native, avoids network FS issues |
| 2026-02-14 | **Local PV for agent state** | Single-writer safe, no SQLite corruption risk |
| 2026-02-14 | **gVisor for sub-agents** | Hard multi-tenancy, untrusted code execution |
| 2026-02-14 | **Jobs (not Deployments) for sub-agents** | Ephemeral, auto-cleanup with TTL |
| 2026-02-14 | **Platform gateway as security perimeter** | Don't expose tenant orchestrators directly |

---

## Open Questions (Resolved)

| Question | Answer |
|----------|--------|
| ~~Scale-to-zero vs always-on?~~ | Always-on orchestrator (~$4/mo is worth instant response) |
| ~~SQLite vs Postgres for memory?~~ | SQLite on local PV (OpenClaw-native, safe with single writer) |
| ~~Jobs vs Deployments for sub-agents?~~ | Jobs with TTL cleanup (ephemeral by nature) |
| ~~How to handle untrusted code?~~ | gVisor sandboxing + NetworkPolicies + tight RBAC |

## Remaining Open Questions

- [ ] Billing model: Per-seat? Per-agent? Usage-based?
- [ ] How to handle orchestrator upgrades (rolling update with PV?)
- [ ] Backup strategy for tenant PVs
- [ ] Multi-region / HA story

---

## Directory Structure

```
agent_forge/
├── PROJECT.md              # This file
├── README.md               # Public readme
├── dashboard/              # Next.js dashboard (Vercel)
├── platform-api/           # Hono API (Node/TS)
├── terraform/              # Infrastructure as code
│   ├── k3s/               # K3s cluster setup
│   ├── modules/           # Reusable modules
│   └── tenant/            # Per-tenant resources
├── manifests/              # K8s manifests (TODO)
│   ├── platform/          # Platform-level resources
│   ├── tenant-template/   # Template for new tenants
│   └── runtime-classes/   # gVisor RuntimeClass
└── controller/             # Provisioning controller (TODO)
```

---

## Links

- **Repo:** https://github.com/Daltonopenclaw/agent-forge
- **Dashboard:** https://myintell.ai
- **API:** https://api.myintell.ai
- **Terraform:** `/terraform/`
- **Cloudflare creds:** 1Password → "Cloudflare - myintell.ai"
- **Neon project:** 1Password → "Neon - myintell.ai"

---

*Last updated: 2026-02-14 by Dalton*
