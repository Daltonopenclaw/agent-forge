# Deep Research Request: myintell.ai Agent Creation UX

## Goal

We're building **myintell.ai** — a multi-tenant platform where customers can spin up persistent AI agents powered by OpenClaw. We need to design the **customer experience for creating their first agent**.

---

## What is OpenClaw?

OpenClaw is an open-source AI agent runtime/gateway. Key features:

- **Always-on daemon** that runs locally or on a server
- **Multi-channel**: Connects to Telegram, Discord, Slack, Signal, WhatsApp, iMessage, IRC, webchat
- **Persistent memory**: SQLite-based vector search + session transcripts
- **Tool use**: Shell commands, file operations, browser control, web search, etc.
- **Sub-agent spawning**: Can spawn isolated sub-agents for background tasks
- **Skills system**: Modular capabilities via SKILL.md files
- **Personality**: Configurable via SOUL.md, AGENTS.md, MEMORY.md
- **Cron/heartbeats**: Proactive scheduling and periodic check-ins

**Repos to analyze:**
- OpenClaw main repo: https://github.com/openclaw/openclaw
- OpenClaw docs: https://docs.openclaw.ai (or `/usr/lib/node_modules/openclaw/docs` locally)
- ClawHub (skills marketplace): https://clawhub.com

---

## What is myintell.ai?

A "Heroku for AI agents" — multi-tenant platform where:
- Customers sign up and create AI agents
- Each tenant gets a dedicated OpenClaw instance (always-on)
- Agents have persistent memory, personality, and integrations
- Agents can spawn sub-agents and provision infrastructure

**Architecture decisions already made:**
- K8s cluster (K3s on Hetzner)
- 1 OpenClaw Gateway per tenant (always-on, ~$4-6/mo)
- SQLite on local PersistentVolume (not Postgres)
- gVisor sandboxing for sub-agent code execution
- Namespace isolation with NetworkPolicies
- Platform gateway handles auth (Clerk) and routing

---

## The Question

**How should we design the customer experience when they create their first agent?**

Specific sub-questions:

### 1. Configuration Model
- What should customers configure when creating an agent?
  - Name, avatar, personality (SOUL.md)?
  - Capabilities/skills to enable?
  - Integrations (Slack, Discord, etc.)?
  - Model selection (Claude, GPT, etc.)?
- Should we use templates/presets or fully custom?
- How much OpenClaw config should be exposed vs. abstracted?

### 2. API Keys / Model Access
- Should customers bring their own API keys (Anthropic, OpenAI)?
- Or do we proxy through our keys and bill usage?
- Hybrid approach (we provide default, they can override)?

### 3. Onboarding Flow
- What's the minimal viable first experience?
- Should there be a "wizard" or just a form?
- How do we handle the ~30-60 second provisioning time?
- What's the "aha moment" we're optimizing for?

### 4. Interaction Channels
- Dashboard webchat only for MVP?
- API access from day 1?
- When/how to add Slack/Discord/etc. integrations?
- How does OpenClaw's multi-channel architecture map to a SaaS product?

### 5. Tenant vs. Agent Model
- Is 1 tenant = 1 agent? Or can tenants have multiple agents?
- If multiple agents, do they share memory/workspace or are they isolated?
- How does this map to OpenClaw's session model?

### 6. OpenClaw Integration Points
- What OpenClaw configs need to be generated per-tenant?
  - config.json5, SOUL.md, AGENTS.md, etc.?
- How do we handle OpenClaw updates/upgrades?
- Can customers access the OpenClaw workspace directly (files, memory)?
- Should we expose the OpenClaw TUI or only our dashboard?

---

## Constraints

1. **Hard multi-tenancy**: Tenants don't trust each other. Agents may run untrusted code.
2. **Cost-sensitive**: ~$4-6/mo base cost per tenant, need to be viable at low price points.
3. **OpenClaw-native**: Don't diverge from upstream OpenClaw unnecessarily.
4. **MVP simplicity**: First version should be shippable in 1-2 weeks.

---

## Current Dashboard State

The dashboard (Next.js + Clerk) currently has:
- Sign up / sign in (Clerk)
- Dashboard home (placeholder)
- "Create Agent" form (name, description, model selection)
- Agent list view

The "Create Agent" form currently collects:
- Agent name
- Description
- Model (dropdown: Claude Sonnet, GPT-4, etc.)

This is likely insufficient. We need to decide what else is needed.

---

## Deliverables Requested

1. **Recommended onboarding flow** — Step-by-step UX for first agent creation
2. **Configuration schema** — What fields/options to expose
3. **OpenClaw mapping** — How each config maps to OpenClaw files/settings
4. **MVP scope** — What to build first vs. defer
5. **Open questions** — Anything that needs product decisions

---

## Reference: OpenClaw Config Structure

A typical OpenClaw setup has these files in the workspace:

```
~/.openclaw/
├── config.json5          # Main gateway config (API keys, channels, model settings)
├── workspace/
│   ├── AGENTS.md         # Agent behavior instructions
│   ├── SOUL.md           # Personality and tone
│   ├── USER.md           # Info about the user/owner
│   ├── MEMORY.md         # Long-term curated memory
│   ├── TOOLS.md          # Tool-specific notes and configs
│   ├── HEARTBEAT.md      # Periodic task checklist
│   └── memory/
│       ├── YYYY-MM-DD.md # Daily memory logs
│       └── *.md          # Other memory files
├── skills/               # Installed skills
└── sessions/             # Session transcripts (JSONL)
```

Key config.json5 sections:
- `providers` — LLM API keys and endpoints
- `channels` — Messaging integrations (telegram, discord, slack, webchat, etc.)
- `defaults` — Default model, thinking level, etc.
- `security` — Exec policies, tool permissions
- `heartbeat` — Polling interval and prompt

---

## Links

- OpenClaw repo: https://github.com/openclaw/openclaw
- OpenClaw docs: https://docs.openclaw.ai
- myintell.ai PROJECT.md: (included above)
- Dashboard repo: https://github.com/Daltonopenclaw/agent-forge

---

*Please analyze OpenClaw's architecture, configuration model, and capabilities, then recommend a customer-facing UX for myintell.ai that is simple, powerful, and aligned with how OpenClaw actually works.*
