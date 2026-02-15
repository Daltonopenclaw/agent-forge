# myintell.ai Unified Onboarding Spec

*Synthesized from Gemini + GPT research, incorporating platform-managed services with BYOK option*

---

## Design Principles

1. **Zero-friction first chat** — User should be talking to their agent within 2 minutes
2. **Platform-managed by default** — We provide all capabilities out of the box
3. **BYOK for power users** — Transparent option to bring your own keys for unlimited usage
4. **OpenClaw-native** — Use OpenClaw's actual config model, not a parallel abstraction
5. **Progressive disclosure** — Simple first, advanced later

---

## Onboarding Flow (5 Steps)

### Step 1: Identity (30 seconds)
**What the user sees:**
```
┌─────────────────────────────────────────────────┐
│  Let's create your agent                        │
│                                                 │
│  What should we call them?                      │
│  ┌─────────────────────────────────────────┐   │
│  │ Atlas                                    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Pick an avatar                                 │
│  [🤖] [🧠] [⚡] [🎯] [🌟] [🔮] [custom...]     │
│                                                 │
│                              [Continue →]       │
└─────────────────────────────────────────────────┘
```

**What gets generated:**
- `IDENTITY.md` with name and avatar

---

### Step 2: Personality — "SoulCraft" (60 seconds)
**What the user sees:**
```
┌─────────────────────────────────────────────────┐
│  What kind of agent is Atlas?                   │
│                                                 │
│  ○ Personal Assistant — Helpful, proactive,     │
│    remembers your preferences                   │
│                                                 │
│  ○ Research Partner — Thorough, analytical,     │
│    digs deep into topics                        │
│                                                 │
│  ○ Creative Collaborator — Imaginative,         │
│    generates ideas, writes content              │
│                                                 │
│  ○ Technical Expert — Precise, code-savvy,      │
│    helps with development                       │
│                                                 │
│  ○ Custom — I'll describe what I want           │
│                                                 │
│  [← Back]                    [Continue →]       │
└─────────────────────────────────────────────────┘
```

**If "Custom" selected → Conversational interview:**
```
┌─────────────────────────────────────────────────┐
│  Tell us about Atlas                            │
│                                                 │
│  How should Atlas communicate?                  │
│  ┌─────────────────────────────────────────┐   │
│  │ Casual and friendly, but stays focused   │   │
│  │ on getting things done. Can be witty.    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  What should Atlas help you with primarily?     │
│  ┌─────────────────────────────────────────┐   │
│  │ Managing my schedule, researching        │   │
│  │ topics, and drafting emails              │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Anything Atlas should never do?                │
│  ┌─────────────────────────────────────────┐   │
│  │ Don't send emails without my approval    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [← Back]                    [Continue →]       │
└─────────────────────────────────────────────────┘
```

**What gets generated:**
- `SOUL.md` — Personality and tone
- `AGENTS.md` — Behavior rules and boundaries

---

### Step 3: Intelligence — Model Selection + BYOK Option (30 seconds)
**What the user sees:**
```
┌─────────────────────────────────────────────────┐
│  Choose Atlas's intelligence                    │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  🧠 Smart (Recommended)                  │   │
│  │  Claude Sonnet — Fast, capable, balanced │   │
│  │  Included in your plan                   │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  🚀 Powerful                             │   │
│  │  Claude Opus — Maximum capability        │   │
│  │  +$0.02/message avg                      │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  ⚡ Fast                                 │   │
│  │  Claude Haiku — Quick responses          │   │
│  │  Included in your plan                   │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│    💡 Want unlimited usage or a different      │
│    provider? Use your own API key              │
│    [Bring Your Own Key →]                      │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                                                 │
│  [← Back]                    [Continue →]       │
└─────────────────────────────────────────────────┘
```

**BYOK Modal (if clicked):**
```
┌─────────────────────────────────────────────────┐
│  Bring Your Own Key                             │
│                                                 │
│  Provider                                       │
│  [Anthropic ▼]                                  │
│                                                 │
│  API Key                                        │
│  ┌─────────────────────────────────────────┐   │
│  │ sk-ant-api03-xxxxxxxxxxxxx              │   │
│  └─────────────────────────────────────────┘   │
│  🔒 Encrypted and stored securely               │
│                                                 │
│  Benefits of BYOK:                              │
│  • Unlimited usage (you pay provider directly)  │
│  • Access to all models from your provider      │
│  • Use existing enterprise agreements           │
│                                                 │
│  [Cancel]                    [Save Key →]       │
└─────────────────────────────────────────────────┘
```

**What gets configured:**
- `config.json5` → `providers` section
- `agents.defaults.model.primary`
- API key stored as K8s Secret (never in workspace files)

---

### Step 4: Provisioning (30-60 seconds)
**What the user sees:**
```
┌─────────────────────────────────────────────────┐
│                                                 │
│           Creating Atlas...                     │
│                                                 │
│     ✓ Setting up secure environment            │
│     ✓ Configuring personality                  │
│     ◐ Starting agent runtime...                │
│     ○ Preparing first conversation             │
│                                                 │
│     ░░░░░░░░░░░░░░░████████░░░░░░░░  67%       │
│                                                 │
│  💡 Did you know? Atlas will remember your      │
│     conversations and learn your preferences    │
│     over time.                                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**What happens behind the scenes:**
1. Create K8s namespace: `tenant-{slug}`
2. Create PersistentVolumeClaim for agent state
3. Generate OpenClaw config files from user inputs
4. Create K8s Secrets for API keys
5. Deploy OpenClaw Gateway pod
6. Wait for health check
7. Initialize first session

---

### Step 5: First Breath + Memory Ritual (2 minutes)
**What the user sees:**
```
┌─────────────────────────────────────────────────┐
│  Atlas                                      ⚡  │
├─────────────────────────────────────────────────┤
│                                                 │
│  🤖 Atlas                                       │
│  ┌─────────────────────────────────────────┐   │
│  │ Hey! I'm Atlas, and I'm excited to      │   │
│  │ start working with you. 👋               │   │
│  │                                          │   │
│  │ Before we dive in, I'd love to learn    │   │
│  │ a few things so I can be more helpful:  │   │
│  │                                          │   │
│  │ • What should I call you?               │   │
│  │ • What timezone are you in?             │   │
│  │ • Any topics you'd like me to focus on? │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Type a message...                        │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**After user responds, agent:**
1. Writes preferences to `USER.md`
2. Stores key facts in `MEMORY.md`
3. Shows confirmation: *"Got it! I've saved that to my memory. I'll remember this across our conversations."*

**This demonstrates:**
- Agent personality (from SOUL.md)
- Proactive behavior
- Memory persistence (the "aha moment")

---

## OpenClaw File Mapping

| User Input | OpenClaw File | Section/Content |
|------------|---------------|-----------------|
| Agent name | `IDENTITY.md` | `name: Atlas` |
| Avatar | `IDENTITY.md` | `emoji: ⚡` |
| Personality template | `SOUL.md` | Full personality doc |
| Custom personality answers | `SOUL.md` | Interpolated into template |
| Behavior rules | `AGENTS.md` | Safety boundaries, preferences |
| Model selection | `config.json5` | `agents.defaults.model.primary` |
| BYOK API key | K8s Secret | Injected as env var `ANTHROPIC_API_KEY` |
| User's name | `USER.md` | Written by agent in first chat |
| User's timezone | `USER.md` | Written by agent in first chat |
| User preferences | `MEMORY.md` | Written by agent in first chat |

---

## Platform-Managed Services

### Credential Flow
```
User creates agent
        │
        ▼
Platform provisions tenant namespace
        │
        ▼
Credential Vending Service allocates:
  • LLM API access (pooled, metered)
  • Email sending (Resend, scoped key)
  • Web search (pooled quota)
  • Database (Neon project, if needed)
        │
        ▼
Credentials injected as K8s Secrets
        │
        ▼
OpenClaw Gateway reads from env vars
```

### Default Capabilities (Included in Base Plan)
| Capability | Provider | Limit |
|------------|----------|-------|
| LLM (Smart tier) | Anthropic Claude Sonnet | 100k tokens/day |
| Web Search | Brave API | 100 searches/day |
| Memory | SQLite + sqlite-vec | Unlimited |
| File Storage | Local PV | 1GB |

### Upgrade Paths
| Upgrade | What it unlocks |
|---------|-----------------|
| BYOK LLM | Unlimited LLM usage, any model |
| Pro Plan | Higher limits, priority support |
| Add-on: Email | Resend integration for agent emails |
| Add-on: Channels | Slack, Discord, Telegram |

---

## Technical Implementation

### Auth Integration (Trusted Proxy Mode)

Per GPT research, use OpenClaw's trusted-proxy auth:

```json5
// config.json5
{
  gateway: {
    auth: {
      mode: "trusted-proxy",
      trustedProxy: {
        userHeader: "x-myintell-user-id"
      }
    },
    trustedProxies: ["10.0.0.0/8"]  // K8s internal
  }
}
```

Platform gateway (Traefik) injects `x-myintell-user-id` header after Clerk auth.

### OpenClaw Wizard RPC (Optional Enhancement)

GPT noted OpenClaw has a wizard RPC (`wizard.start`, `wizard.next`). For deeper integration:

1. Provision Gateway first (minimal config)
2. Run wizard steps via RPC from dashboard
3. Wizard writes config files natively

This keeps us 100% OpenClaw-native but adds complexity. **Recommend deferring to v2.**

### Workspace Bootstrap Files

Generated at provisioning time:

```
/state/workspace/
├── IDENTITY.md      # Name, avatar
├── SOUL.md          # Personality (from template + customization)
├── AGENTS.md        # Behavior rules
├── USER.md          # Empty, agent fills in during first chat
├── MEMORY.md        # Empty, agent fills in during first chat
├── TOOLS.md         # Platform defaults
└── HEARTBEAT.md     # Empty (proactive disabled by default)
```

---

## MVP Scope (Week 1-2)

### Build
- [ ] 5-step onboarding wizard UI
- [ ] 4 personality templates (SOUL.md presets)
- [ ] Model selection with 3 tiers
- [ ] BYOK modal for API keys
- [ ] Provisioning flow with K8s integration
- [ ] Dashboard chat UI (WebSocket to Gateway)
- [ ] First Breath prompt (agent initiates memory ritual)

### Skip for MVP
- [ ] External channels (Slack, Discord, etc.)
- [ ] Skills marketplace
- [ ] OpenClaw Control UI/TUI exposure
- [ ] Multi-agent per tenant
- [ ] Custom integrations beyond LLM

---

## Post-MVP Roadmap

### Phase 2: Enhance (Week 3-4)
- [ ] "Enhance your agent" panel
- [ ] Web search toggle (Brave API key provisioning)
- [ ] Memory browser (view/edit MEMORY.md)
- [ ] Persona editor (edit SOUL.md, AGENTS.md)
- [ ] Usage dashboard (tokens, costs)

### Phase 3: Connect (Week 5-6)
- [ ] Slack integration wizard
- [ ] Discord integration wizard
- [ ] Telegram integration wizard
- [ ] DM policy configuration

### Phase 4: Extend (Week 7+)
- [ ] Skills browser (curated list)
- [ ] ClawHub integration
- [ ] Multi-agent support
- [ ] Team/collaboration features
- [ ] API access for developers

---

## Open Questions (Need Decisions)

1. **Pricing tiers** — What are the actual limits per tier?
2. **Trial period** — Free trial with caps, or require payment upfront?
3. **BYOK incentive** — Discount for BYOK users (lower our costs)?
4. **Abuse prevention** — Require payment method even for free tier?
5. **Agent deletion** — Soft delete with recovery period, or hard delete?

---

*Last updated: 2026-02-14*
