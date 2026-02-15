# Gemini Deep Research: myintell.ai Agent Creation UX

## Executive Summary

This report outlines the research and design recommendations for **myintell.ai**, a proposed multi-tenant platform leveraging the **OpenClaw** (formerly Moltbot/Clawdbot) open-source agent framework. The objective is to transition OpenClaw's local-first, file-based architecture into a scalable, user-friendly SaaS experience.

**Key Findings:**
1.  **Architectural Dissonance:** OpenClaw is architected as a "single-tenant, local-first" operating system where the file system (Markdown files) acts as the source of truth for memory and configuration [cite: 1, 2]. Transforming this into a multi-tenant platform requires robust virtualization (e.g., containerization or virtualized file systems) to maintain the "workspace" paradigm while ensuring data isolation [cite: 3, 4].
2.  **Identity vs. Instruction:** Leading platforms (Dust.tt, Relevance AI) and OpenClaw itself have moved away from monolithic "System Prompts" toward structured identity files (`SOUL.md`) and distinct instruction sets (`AGENTS.md`). This separation is critical for UX, allowing users to configure "who the agent is" separately from "what the agent does" [cite: 5, 6].
3.  **The "Skill" Standard:** The industry is converging on the "Agent Skill" standard (a directory containing `SKILL.md` with YAML frontmatter). This format allows for progressive disclosure, where the LLM only loads tool instructions when relevant, optimizing context windows [cite: 7, 8].
4.  **Onboarding Friction:** The primary friction point for agent adoption is the "blank canvas" problem. Users struggle to define agent behaviors from scratch. Successful platforms utilize high-fidelity templates (e.g., "HR Onboarding Specialist") to bridge the gap between capability and utility [cite: 9, 10].

**Top Recommendations:**
*   **Virtual Workspace Abstraction:** Instead of rewriting OpenClaw's core, myintell.ai should spawn isolated containerized environments (MicroVMs) for each tenant, mounting persistent storage that maps to OpenClaw's expected file structure (`~/.openclaw/workspace`).
*   **"SoulCraft" Onboarding:** Implement a conversational onboarding flow (similar to OpenClaw's CLI wizard but web-based) that interviews the user to generate the `SOUL.md` and `AGENTS.md` files dynamically, rather than asking users to write Markdown configuration manually [cite: 6].
*   **Integration Abstraction:** Use a middleware layer (like Composio or a custom implementation) to handle OAuth and tool authentication, abstracting the raw `TOOLS.md` configuration from the end-user [cite: 11, 12].

---

## Part 1: OpenClaw Technical Analysis

OpenClaw is distinct from other agent frameworks because it operates as an "operating system for agents" rather than just a chatbot wrapper. It relies heavily on the local filesystem for state, memory, and configuration, which presents unique challenges and opportunities for a cloud-hosted adaptation.

### Configuration Model

OpenClaw’s behavior is governed by a hierarchy of configuration files, primarily using **JSON5** for system settings and **Markdown** for semantic instructions.

*   **System Configuration (`config.json5`):**
    This file acts as the control plane configuration. It handles:
    *   **LLM Provider Settings:** Defines which models are used for specific tasks (e.g., `agents.defaults.model` for main chat, `agents.defaults.subagents.model` for background tasks). It supports "failover" logic, routing simple tasks to cheaper models (e.g., Gemini Flash) and complex tasks to reasoning models (e.g., Claude Opus) [cite: 13, 14].
    *   **Gateway Settings:** Configures the WebSocket server (`port 18789`), authentication tokens, and allowed channels [cite: 1, 2].
    *   **Heartbeat:** Controls the cron-like scheduler that wakes the agent every 30 minutes (default) to perform proactive tasks defined in `HEARTBEAT.md` [cite: 15].

*   **Semantic Configuration ( The "Soul" & "Brain"):**
    OpenClaw injects specific Markdown files into the context window to define the agent's persona and operational boundaries.
    *   **`AGENTS.md`:** The operational baseline. It contains global constraints, non-negotiable rules, and what the agent is fundamentally allowed to do [cite: 16].
    *   **`SOUL.md`:** Defines the "psychological architecture" of the agent—its personality, tone, core values, and communication style (e.g., "Be concise," "Don't use emojis"). It separates "who the agent is" from "what it does" [cite: 5, 6, 17].
    *   **`TOOLS.md`:** User-specific notes on how tools should be used, acting as a bridge between the raw tool schema and the user's specific preferences [cite: 2].
    *   **`IDENTITY.md`:** The "mask" of the agent—its display name, avatar, and user-facing description. Unlike `SOUL.md`, this is purely presentational [cite: 6].

### Channels & Integrations

The **Gateway** is the core component that bridges external messaging platforms with the internal agent runtime.

*   **Architecture:** The Gateway runs a single process that maintains WebSocket connections. It normalizes incoming messages (from WhatsApp, Discord, Slack, etc.) into a standard internal `Message` object before passing them to the agent runtime [cite: 2, 16].
*   **Connection Method:**
    *   **Standard Channels:** WhatsApp, Telegram, and Discord are built-in. Setup typically involves scanning QR codes (WhatsApp) or providing bot tokens (Discord/Telegram) via the CLI [cite: 18, 19].
    *   **DM Policy:** OpenClaw enforces strict security on Direct Messages. By default, unknown senders trigger a "pairing" mode where a code must be approved by the admin before the agent engages, preventing unauthorized usage [cite: 19].
*   **Webhooks:** The Gateway can act as an HTTP server to receive incoming webhooks, allowing external systems (like GitHub or Stripe) to trigger agent actions [cite: 2].

### Session & Memory Architecture

OpenClaw employs a "File-First" philosophy for memory, avoiding complex databases in favor of human-readable files.

*   **Workspace Structure (`~/.openclaw/workspace`):**
    *   **Ephemeral Memory (`memory/YYYY-MM-DD.md`):** Daily logs that capture the raw stream of consciousness, actions, and context. These are append-only and read at the start of a session [cite: 20, 21].
    *   **Durable Memory (`MEMORY.md`):** A curated file for long-term facts, user preferences, and stable knowledge. The agent is instructed to "compact" important information from daily logs into this file [cite: 20, 22].
*   **Hybrid Search:** OpenClaw uses a local SQLite database with `sqlite-vec` to perform hybrid retrieval (BM25 for keyword matching + Vector embeddings for semantic similarity) over these Markdown files. This ensures the agent can recall specific facts even if they have rotated out of the immediate context window [cite: 21, 23].
*   **Sub-Agents:** The main agent can spawn "sub-agents" for parallel tasks. These run in isolated sessions (`agent:<id>:subagent:<uuid>`) with their own context, allowing the main agent to continue chatting while a sub-agent performs long-running research or coding tasks [cite: 24].

### Skills System

OpenClaw uses the **Agent Skills** standard, a directory-based approach to extending capabilities.

*   **Structure:** A skill is a folder containing a `SKILL.md` file.
*   **`SKILL.md`:** Contains **YAML frontmatter** (Name, Description, Requirements) and natural language instructions.
    *   *Progressive Disclosure:* The system loads only the `description` into the main context. The full instructions and prompt logic in `SKILL.md` are loaded *only* when the LLM decides to use that skill. This saves tokens and reduces distraction [cite: 7, 25].
*   **Execution:** Skills can bundle scripts (Python/Bash) or define API calls. Because OpenClaw runs locally, these scripts often have full shell access, posing a security risk in multi-tenant environments if not sandboxed [cite: 26, 27].

---

## Part 2: Industry Best Practices

### Competitor Analysis

| Platform | Agent Creation UX | Key Differentiator | Onboarding Friction |
| :--- | :--- | :--- | :--- |
| **Relevance AI** | Visual flow builder + "Teams" of agents. | Focus on B2B "digital workforce" (e.g., BDR Agents). | High complexity in multi-agent orchestration [cite: 28]. |
| **Dust.tt** | "Instructions" based (not prompts). No visual canvas. | **Horizontal Platform.** Strong integrations with Notion/Slack/Drive. | Requires connecting data sources to see value [cite: 29, 30]. |
| **CrewAI** | Code-first (Python) moving to UI. Role-based (Researcher, Writer). | Enterprise Enterprise/Production focus. | High technical barrier (Python/YAML) for non-devs [cite: 31, 32]. |
| **Composio** | Integration-first. Focus on "Tool Sets". | **Tooling abstraction.** Handles OAuth/Auth for 200+ apps. | Overwhelming choice of tools; complexity of tool routing [cite: 11, 12]. |
| **LangGraph** | Graph-based (Nodes/Edges). | Fine-grained control over loops and state. | Steep learning curve; requires understanding graph theory/logic [cite: 33, 34]. |

### "Aha Moment" Patterns

Research indicates that the "Aha Moment" for agent platforms occurs when the user witnesses the agent **autonomously execute a multi-step action** that connects two disparate systems, rather than just generating text [cite: 35, 36, 37].

*   **Example:** "I wanted to automate tasks from Todoist... the agent created a skill for it on its own." [cite: 35].
*   **Pattern:** Successful onboarding flows force a "quick win" (e.g., "Send a test email to yourself" or "Summarize this URL") within the first 60 seconds [cite: 38].

### Templates vs. Custom Configuration

*   **The "Blank Slate" Problem:** Users struggle when presented with an empty "System Prompt" box.
*   **Best Practice:** Platforms like **Relevance AI** and **Dust.tt** use "Role-Based Templates" (e.g., "HR Assistant", "Python Code Reviewer"). These pre-fill the `SOUL.md` (personality) and `TOOLS.md` (capabilities), allowing users to "tweak" rather than "write" [cite: 9, 39].
*   **Progressive Disclosure:** Advanced settings (Model temperature, specific LLM choice, base prompt overrides) are hidden behind "Advanced" toggles to prevent cognitive overload during initial setup [cite: 40, 41].

### UX Patterns for Complex Configuration

*   **Natural Language Logic:** **Dust.tt** has explicitly rejected visual "node-based" builders in favor of natural language instructions (e.g., "If the user asks for X, search Notion first"). This aligns better with how LLMs actually work compared to rigid flowchart logic [cite: 30].
*   **Conversational Config:** Instead of forms, use a "meta-agent" to interview the user. "What is this agent's job?" "How formal should it be?" The system then generates the configuration files (`SOUL.md`) based on the answers [cite: 6].

---

## Part 3: Recommendations for myintell.ai

### Recommended Onboarding Flow

To bridge the gap between OpenClaw's technical complexity and a user-friendly SaaS, use a **Wizard-based flow** that abstracts the file system generation.

**Step 1: The Identity (The "Mask")**
*   **Input:** Name, Avatar, Description.
*   **UX:** Simple form.
*   **Output:** Generates `IDENTITY.md`.

**Step 2: The Soul (The "Brain")**
*   **Input:** Select a "Archetype" (e.g., Professional Assistant, Coding Buddy, Creative Writer) OR run a "SoulCraft" chat interview.
*   **UX:** A chat interface where a meta-agent asks 3-5 questions about tone and behavior.
*   **Output:** Generates `SOUL.md`.
*   *Why:* This prevents the "blank page" paralysis of writing system prompts [cite: 6].

**Step 3: The Hands (Skills & Tools)**
*   **Input:** "What apps does this agent need?" (e.g., Gmail, GitHub, Calendar).
*   **UX:** A marketplace-style grid of icons. Clicking one opens an OAuth flow (via Composio or similar middleware).
*   **Output:** Updates `config.json5` (plugins) and generates `TOOLS.md` with usage instructions.
*   *Why:* OpenClaw users usually have to install CLI tools and manage keys manually. The platform **must** automate this via managed OAuth [cite: 11].

**Step 4: The Home (Channels)**
*   **Input:** "Where will you talk to this agent?" (WhatsApp, Slack, Web Chat).
*   **UX:** QR code display (for WhatsApp) or "Add to Slack" button.
*   **Output:** Configures Gateway channels in `config.json5`.

**Step 5: The "First Breath" (Aha Moment)**
*   **Action:** Trigger a proactive "Welcome" message from the agent to the connected channel *immediately* upon completion.
*   **Content:** The agent should introduce itself using the persona defined in `SOUL.md` and suggest 3 actions it can perform based on the tools selected in Step 3.

### Configuration Schema & Abstraction

**What to Expose vs. Abstract:**

| Component | UX Strategy for Non-Technical Users | Backend File Mapping |
| :--- | :--- | :--- |
| **LLM Provider** | **Abstract.** Provide a "Intelligence Level" slider (Basic vs. Advanced). | `config.json5` (`agents.defaults.model`) |
| **System Prompt** | **Expose as "Behavior".** Use natural language text area + "SoulCraft" chat. | `SOUL.md`, `AGENTS.md` |
| **Tools/Skills** | **Expose as "App Store".** Grid of integrations. | `TOOLS.md`, `plugins` block in config |
| **Memory** | **Abstract.** "Remember me" toggle. | `MEMORY.md`, `memory/` folder |
| **Cron/Heartbeat**| **Abstract.** "Proactive Updates" toggle (e.g., "Check every 30m"). | `config.json5` (`heartbeat`), `HEARTBEAT.md` |

### Architecture: OpenClaw File Mapping Strategy

Since OpenClaw expects a local filesystem, **myintell.ai** must virtualize this environment for multi-tenancy.

*   **Container per Tenant:** Deploy a lightweight Docker container (or Firecracker microVM) for each active agent.
*   **Persistent Volume:** Mount a volume to `~/.openclaw/workspace`. This volume contains the user's specific `SOUL.md`, `MEMORY.md`, and `config.json5`.
*   **Management API:** Build a "Control Plane" API that writes to these files on the persistent volume when the user changes settings in the UI.
    *   *Example:* User updates "Agent Name" in UI -> API writes to `IDENTITY.md` in the container's volume.

### API Key Strategy

**Recommendation: Hybrid Model**

1.  **Platform-Provided (Starter/Pro Tier):**
    *   **UX:** User pays a monthly subscription (e.g., $20/mo). The platform handles the LLM API keys (OpenAI/Anthropic) on the backend.
    *   **Pros:** Zero friction. No need for user to get keys.
    *   **Cons:** Platform bears the risk of token overage/abuse. Requires strict rate limiting and cost monitoring [cite: 3].

2.  **Bring-Your-Own-Key (BYOK) (Power User/Enterprise Tier):**
    *   **UX:** User enters their own Anthropic/OpenAI key in "Advanced Settings".
    *   **Pros:** Lower platform cost. User gets higher limits and privacy guarantees (billing directly with provider).
    *   **Cons:** Higher friction. Security risk if keys are stored insecurely (must use Vault/Secrets Manager) [cite: 42].

### MVP vs. Future Scope

**MVP Scope:**
*   **Single Agent per User:** Avoid complexity of multi-agent orchestration.
*   **Web Chat Only:** Start with a built-in web chat UI (hosted Gateway) to avoid the complexity of WhatsApp/Slack approval processes initially.
*   **Core Skills Only:** Web Search, File Management (virtual), and Time/Calendar.
*   **Managed Auth:** Platform provides the LLM (no BYOK initially to simplify support).

**Future Scope:**
*   **Multi-Channel Support:** WhatsApp/Slack integrations.
*   **Skill Marketplace:** Allow users to upload custom `SKILL.md` files (requires sandbox security auditing) [cite: 26, 27].
*   **Team Collaboration:** Shared workspaces where multiple users can chat with the same agent (requires rewriting OpenClaw's session logic to handle multi-user context within a single workspace) [cite: 43].

## Sources

[cite: 35] OpenClaw Docs (openclaw.ai)
[cite: 18] OpenClaw Docs (docs.openclaw.ai)
[cite: 15] OpenClaw Heartbeat Docs
[cite: 1] Milvus Blog: OpenClaw Explained
[cite: 19] GitHub: openclaw/openclaw
[cite: 36] Medium: OpenClaw for Product Managers
[cite: 42] ShipClaw: OpenClaw Cheatsheet
[cite: 2] CSDN: OpenClaw Architecture Analysis
[cite: 17] Medium: SOUL.md Guide
[cite: 22] Reddit: SOUL.md vs USER.md
[cite: 5] mmntm.net: Identity Architecture
[cite: 33] LangChain Blog: Assistant Editor
[cite: 9] Relevance AI: Onboarding Agents
[cite: 44] UXDesign: The First 30 Seconds
[cite: 45] Pipefy: AI Agent Onboarding
[cite: 46] Dust.tt Quickstart
[cite: 29] Dust.tt Homepage
[cite: 39] Dust.tt Blog: Project Status Agent
[cite: 31] CrewAI: Getting Started
[cite: 32] CrewAI: Enterprise Platform
[cite: 47] Composio Homepage
[cite: 11] Dev.to: Top AI Integration Platforms
[cite: 48] GitHub: awesome-openclaw-skills
[cite: 49] ZenVanRiel: Custom Skill Guide
[cite: 26] Snyk: Skill.md Security
[cite: 27] 1Password: Agent Skills Attack Surface
[cite: 3] BrimLabs: Multi-tenant AI Architecture
[cite: 24] OpenClaw Docs: Sub-agents
[cite: 13] VelvetShark: Multi-model Routing
[cite: 6] SmallAI: SOUL.md Personality
[cite: 16] Substack: OpenClaw System Architecture
[cite: 7] Strapi: What are Agent Skills
[cite: 8] VS Code Docs: Agent Skills
[cite: 28] Vellum.ai: Top Agent Builders
[cite: 10] Relevance AI: User Adoption Agents
[cite: 16] Substack: System Prompt Architecture
[cite: 30] Dust.tt Blog: Boxes and Lines
[cite: 1] Milvus: OpenClaw Complete Guide
[cite: 19] GitHub: OpenClaw Readme
[cite: 12] WorkOS: Composio Overview
[cite: 20] OpenClaw Docs: Memory
[cite: 21] Snowan: Memory System Deep Dive
[cite: 14] GitHub Gist: OpenClaw Config
[cite: 25] SonuSahani: Local AI Agent
[cite: 37] Jimo.ai: Autonomous Agents
[cite: 38] ProductLed: AI Onboarding
[cite: 43] Nex.ai: OpenClaw Multi-tenant Challenges
[cite: 23] PingCAP: Local-First RAG
[cite: 4] WZ-IT: Secure Deployment
[cite: 50] Medium: Lessons from OpenClaw

**Sources:**
1. [milvus.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHUzv6OS0vCIvhROP6nEJFzkkUkyfpzwmif2cX7RUJWAWvm1Xq2nRzpxVc_Jy6jRD9JZD2jjogVU6ha8W335EJa8Z3yebiX2lZPhD2MJK5Opu0NPsEQwXaUzVmQ0n660HpTO9toikOT1o3j9w0aAzrVObbuYOMVWEymdwsaB0c9J8iE9mHrBlYjAw17o_Qgb1dmCXCIuLG7PZbmE-w3T9rg_8ui_tKQRl4=)
2. [csdn.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEm8UkKFtZmP0X9yC4dfaK7tl_KjQJYaJnhiBi1wZgdDVRy-7oTSRQwqiyuOKJfVXhkwXWKY9Bt9oTCW_TukrP9EnnbzbxWmDkoY6HL2uePnMtib46uARCfG0EGaQc3PuhMFzn6uAuXg4Ldh5WOmrnh)
3. [brimlabs.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFLVriwA40rx0By6cRBMrv-rMABFddKtSf6MsWhN6_A3FblL4P5-crFapCp7xedUIuNpYYm7Wocf4nXKs5pZGFO8XjZoXMPr-bIk8TVYrKwbd9cq3Yk7xTiFqMAN17pgg0D_b0Ztd-97tTjoJ5Q9JYMiuR9HqPNBavU-T5ObBEEBpOuYboKHDYx-bwAPv0UZ-KoV6G3)
4. [wz-it.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE2KpeZ2jit0xYMCOC_LWbj1MKOvXFsX7ICyftvTCQpyXrMCxZS0hyeLMcSkl-tm5GcBxGoN-7VCYWVonP7mLM7HT6LRi1xTbRnkJGXf36lLlyOYqS_xzhMi3hK6fVQpPBL9crb0frmppPxyapofnq9zCbwrLp-fXgjIPtckas2-UpZ1nU=)
5. [mmntm.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERBy4WRNTK_fuYfIcjLPsFmac6WzDFMsYbpp8iGPq_BiILkEPPC4FgceBpwAI-Zz9lqFKIXZ59_FxD7X6sa8g5IxWhwFaf8EUsjw65u_IKAumIh9pkcvBCI0ah_f-ZeI5L5f8jF4w-HcHQt8Hd2Ilhzggh)
6. [smallai.in](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIbkrTffiKzhjq413h11347idrhbn3msP-zZ_OAi1G34AEWdqiavD4YwOmoBloUnb9qGW4hxHTMywZqMl4pl6XbNvJ5AqN5nxWTm3iqzVeGBBFHKhKBwRirA0IZF0HxlVJDuItrTYBikMgh9fSiLEymRan41Oy)
7. [strapi.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGryKxWMj9J8eSTX5OBNKp8YwKvBxQfUCAMyoVKxLRvkaBGT6KP3CAs9yQKQTjviS6PNHL2MR6_rtSresctz6cB7gLj4u_tM4tZvhRZMtxYJ82Gb4cq4wdkQDHvJR1hgHZOHRwknD_75HpqIXhd20UFLknm1B6s)
8. [visualstudio.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEX4-lNJN_PnXFSRT4OKbkSSDCc1HDlCbSE_gCycqDRCL-PbEkvwLmW9cnJio6ACVatkz847UAg0OAKF4yiR1U-1Yv6gcsaJdQSLCIBUlZNruZbo2f94wTbGMpwUIQh-XzeJDuxv6DyF6-9xcetCS0iET-dws-wtPbwe2s=)
9. [relevanceai.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEy3RNdE-ne1Oj3qhud5wpFHrLUlu-nYHDYVG6BxtigWw25OBYkAu7drTAZ8WpEha7AvYPyqSqENLtaXYQZ-dsnWULWgeg6PprCmwAk8er3kR-LSZ5gXWhM0_b7ozk8v4QnJJL_MIZy_lzrLgrjWRFIQRkdCOxzodlkpAgJNZWf_DHAyStsaeGgV3-o5SHY-oduEQ==)
10. [relevanceai.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEVw2z3rgQfoPL2MUly_u41ttCn2kp8mZLfLmZG46geADr7EoipFxHYMW1JWi98CISrUJddlofQ6CSCJ9KbOCXgcAU9uqS8lCmsK4Xxgmvfe2hfgyT5AQVt29dJFLjcktUwwaTZ47_4djMsPANkmv1MX4yYaLm2U8t3Pe0S_Y_KvLZ2PbjhUg==)
11. [dev.to](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHWJW84rZotlFPT-6BJsgN4wppdl_JFFPXBxpaVyRwz686zrHQnBZlBfgvfsymFnihnAmyi7nM9jH3V1nM6KGTNxaqw5kN4EFIj1mVKfrheykv6AfxLiBM8PKc4qCOpNFm5FYWELtb18mW7oNNid8YgcMq8ATr6S2CcrMw=)
12. [workos.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFh2NtgiFwzVIEgk7Kc0m0E7Y3_xY7RJS-LsDD7__zR5r9FpZv-EXVQkQUYjSXKJagad7NLGCsbCrEwSBazE38afcYehG3DjU4qTTx8KVHgxA3VLhcsy702Og1gm4klRp99zX0=)
13. [velvetshark.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFfKBPpm-dPdMKHL2RWbPPCwvWaDIF_SPZUA3o3rRshTrIkY8JQ7t25hWhAZ6sHrFEKqY6Z1LuGl44biUHzKhx0TqFkgsHL-dIFBqc3iXhUZ5cmAgjv0I1xI9GvVNT01nwlWpDOTLt2b04h)
14. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFM3OotP_19-1JDjr8h_TpjRF_-h9Db8-C9xd98oJxn-eiAo960ufN7p6giYl2Tn_1XKcXDk4-Fs9kjeX8NLs7cCxpY7LlJ_eLLRq4809wiMXUNcV9wItEZWOyV9KX100cCP9wgu5dh4JYUbN_2JILuEO84G29K_iwI)
15. [openclaw.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHm3a0ZZxkB0sEF0RwKJzoNZTj3SK426QE2rWc9jxP7wRqbhPYkGOCb0-pIwgAJaGYax3s6_0vDOlcoImkOfD0QVtXIeUFPxoNrA3USIFjxCuTl6GBXvbdcqSnr4Ss=)
16. [substack.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEus00VzBxl0z4NqT8iSwgCdxSIaMS7gk2ZBSd2w377mM-qE2xnyz7b1moX44L-TN3VNP5hasLET6fWCdo4s37nPW3hyO4HJN0KC-zvBRN6u2aea7S4e0DWu9awJZO6BSGRWlmNPuCdpvQcQxdeRvVZaRgNkJy3s7pd)
17. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGqQn3uhAjGjO1lUDBHQzzIiBDLBO_J7WvbyH9wmE-qqB_cQklKmTO3Ni0tadHfAp4zpXjicBI4LAFhjqjqTYtvbEhuEFx9_eK0ZuVFyzwoXOsKqQhHPDElnRe0jtZVObgO35Wjd6fTYQnlIZGK3p6mdleKzr2fFvFRyKulvstaOqWT6MVy8eUTQluUiHHNbG9I5HMsoejgCLUnJln3OWiCTa6tKFAvnvs056588XJCnW4Kl2jXhjZ4gg0AZGzNOH9Cb_Y=)
18. [openclaw.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEcZKYDuv1Ys-mudoWO-rwFBna266qTAQV0zfNf7uZ_90oyeXJoZlr4G-eT61Tenvobs6m_MXjpPoCbKWocENjAGVvsXxCSOv_vpOWTdIoZ)
19. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF19_O3rYgTi4H6aMN5F6tgo-1H3nEGk0VTnxDOY0KLHk9v6RWJD-0w8f8BO8udNLRsiWkFFTL1SCvC4tIB-CbgrnShTprwE06HgQ9LMxjmSxPthzsz1zM_TcA=)
20. [openclaw.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF5GduEpiAAxZVtYB9fElAD93fGetpZIlfoNAa8DiiQgd6iK43WXV1wk4frx5Tn1kiKmBo4h0bVcshECoFf2Y0zgW4LfN-wawoNiuGO486QeTT9QNyUNvEqgk9X9bgV)
21. [gitbook.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGpeN04ecUIoMSJM6YyDoE-gEqEyf26kdZERdbQTKb1QS6VBA7C4X8gq8PGnH4AFKpUo2JvVStBrklZ8Dwda7M-ttP0l-2EVqWKegARXXsFcKTUkdDo3TMp0vhTVm2_HwzGjybRkTXkbhxoxMLA6VmTww7cp40rFQSYN_is8lIV4svbJrLX)
22. [reddit.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF_hvXVwGXuaym3oT405eHw5We9q85tUvQ5gDVn0PpcKWR12glBTYA-4fBOsZn83kjm3dubPDWmYP0wVVRfmTYCu67X0HlZwdGJZBsiNONnvMEUMc9EaIgZ82RdSGxXZQgGX2xbZp0zk8Iv6BgR7V9EwaiVCNqJW-fDFlhMUD1J_fmYXYRBSpNpgU6Lv-OOrZtQiFZqknM=)
23. [pingcap.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE2SA7YXKv1YoXTbKtG3LkN56x793Blay0G0-Jkn5GAv9eXkpfWdaZ_k000dnQF4WW7vYlUIbbJVcQ3yCdsQky_k4jv5ZcPwDuXEKWAltNyzyrEznyapIL8l8j81xxKpbRGaStIPTdalrCw3Pru7KSOnnR2FoAHO4iJO7hJOhQrmrYRh8N6k296cw==)
24. [openclaw.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHhkR2Z_pqZPjUDY23d7y8v_Y8c8Oz88h9wwV_YMB0wFZq2y6IpNXWGyg6AjMY2qVATNiUe0DIPiDfWwz4MxoGpt352eHV1lc4rUaYwKFk0uyxVNyJJd73BDdv96Ea_)
25. [sonusahani.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFLmphvxsKQutZ8osog2RELOO87LXk6u3-EEAU3MlZBOaG7yqRUyRTDvW4prM00iowYotr_lrXHMtgkdOKyHusLQ7nBGlUSkjPfZ2X8StnkKHFpYpgE0Cn_vHWN1PbI4l9-WOlaJx9fBtQg)
26. [snyk.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEXsge2JB2MEHNag-MPattw5SegnzVeldnrr2eFFV3HyfoS13MowQ_FIE7PV8dGoX65RCJztrAPKwuZMoU66ffnlR-EiIVg8mEqBsrwCOSLkr5jZt1-f6xqykyKol69LFTPpSfkZw==)
27. [1password.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHaKBLzPGpRGLxBXxtUGcDuV2pgGgjevnUYVv0aY6Jl7ndUwhxeTJogG2XkU4SOXfiTzAxOwx6HGJovTkCB8EV4RSuqmIrB6hn2YNojy_oWckHm9b7OUSsB4vS_EgfwysHd2yrhvuUzdH5vivMVmOV03BM5xBXfK0Xo3w-aM7aBKVAU0LfgbP3G2FTMWF433J4SKY8Dv_gU_LAz)
28. [vellum.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG7ArClyXTzjuilG8kLBwP1mN9fAgMFuPrhKK3XiNWi2KivnLq2E6lMYGifoBwBEu-HFuYdwHGZFer-YsRNijo0us38hgVoRYj6cDPficmw8Ah-NGs257O9ExuTZevyu7talSbDLyV-u-iqiUDVqfwLFVePJK5tcCsAujyEQAk=)
29. [dust.tt](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHZG4ihE26tK_OHEk-TJstXMeRq_EL2rlZS3mvFRzzWr47C2BDnSACr1yLq-Be8kfgwxmriy6lfaBmabS18Vin6sJWtqYLQ)
30. [dust.tt](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFb8SDsCU54fQkJvPAP58pK7wfRJwqIc8-0qAlD8iEyChOZ7_APZM_KgqH4EAnyPrsjkyGfLw2MtIi7QTPUvOAdKukfo4AxBq5vdEvqldGA5d8YIUHyO_P6BNWumhFZMyaWFnYK)
31. [crewai.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEDVHW7TNEQwTX_CFKpjood6Xy5Dbh3jh1BAdN9NaSufPIYUO8sI-KuqkWBt7Vpwwmm-gGN4SdJn67h9Zp2Oc_cMUrN3S-6mvgHwc--iN61A5C1dI3oDPOo0q1tTaoLMwXAk5YC7f0GQFIfTS6vTEV4SuKdOiinFlyMCyVuQK6ERQ==)
32. [crewai.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHroOz6sEHIrR5WUj7TkkoG3ZhVrR62k4GOyFSvQiP3O4rhUV66hnh7VrbYyycjAYvNxhEsvS-TumdHpew_6X0NYFA1k5e_d0VXlH1bDxXgp3W2MdOuK3IkgUbD6ddCV8vyKzHEyhz_8Jpjuf8uR1cFQ6YlYx7oTfgkX5iPpgOS6raGT0K6II8iuzl_TDNdzZ12rsUOEj6yk1Ottq0cnwsDbHLTD81RDWGy4KE=)
33. [langchain.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFkkd3TjvBioCrdawF5qP-VYcaUp1tDM0fJ1Piz3zw1_JHNj3vV-FYFSQQnNMPMDYTTgNPMICWGNh793rax5pBv2dgHfyv0TEl9MIlHBgMexB4eR3pqeYrhxjSq0i-quDt7W1o=)
34. [substack.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHD5CYlYcqtNTQMPczgTGCKuAgXWl6cm26i3fjtnuk2RRZbBUFQnzxtPPwSBYO0YzjPHNFBsFauFgbteCPmW8NANCCqOS3H5T_H4Q2Zocr0UWlTXf5KJvkfcsEKGR0qXYK9bYmjh5pYFsHreuDmBmVFGXOku6uAEl9LldDn3OEmrE24)
35. [openclaw.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHAUWYQcHIMPsh0zPWvZfIfV15w2Svlwmn_YItmoQJ7KvJLSKeCabARVMgvtKIpwyHSn305tL48yd9ISJmkuehtLraewEM79AlCSQ==)
36. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFxkOfTJ8cAQwXPWCSNXETG_TcVI3OMpiTY-dF79yoPv4neLiSIdhjU3jXmBd-sg2BlFn8e7Lch_Uq7jF0lEboIXvXQQMzmdnIGHbGBNqAZ1LVojeqqJpXJzzBmxYrOSQ7Ge9U9PjfDJKrqc5Lq_HrevW3j9x7L82vL7qTH43QYX-5uTDQCq4nF3Kuo8VEk8BsW5TOx1Ri9vkHErw6byQTbNDl1zquhIBHsIXncCiNv9A==)
37. [jimo.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFkNitzrwJ1KqTHNfnV8p3ZHI0EZZHkx1p0fxhRBJNXxKLAAO33rQ7B_Fjn5dWPwHba911TqQZdhFD0vkxRg9OrsfQ5oTWHidUANm8JiFCc0m-A3VkcUMPRSQCBivb-9VDSg8g7k9TYyZ9XCj01XjftN4Nrd_zQdBkc5SgTtW38ZZ--vUc6PaS-47MPe4cRmpZEqh23upx5s1w8sHDZoFytio81LhQaBo1fONYn)
38. [productled.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHLtUUcE9laPz59JxkWCPfH5ngjJ65kecaFvlT83dzlqAgnv56fR-xpyH-X-huqWsS5Tj61lxYIMQwN-HClsNQMjTJz4gvjpE3ZaZek3pc7sHTRn3tDUnLOyHak-ypsJA==)
39. [dust.tt](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEJy2wUxhGeP9Tv5HK9drNAqOPah6PIwX39-KH8CpS4QY9htSqVgsrbpEgXnTV6W04tQ_gnrSB_cg8MbabcD2G6lS1NMxBUGBmjbfpuq7xWQFDiUqEP8d2yWFXnkvJIlVJjkaNRv_1CDF4NpgCF_2_fbwrBnxoaPwbwlWSEUvliHE4=)
40. [zenml.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG1J7t8W9pPHg4MwpGCrq8b1YObXxDFZUPdhftiECE-OXs4AdKMCKKcJqhFH9GVo0jTtDyK8oCi5lt3rvXxrrMhMd_Uks1emim8thZVeJEeyd2KrUyjzc5AWnolOrjYIM0JlpVAdjB3ItqrS788IVL59anSuz2Nfk1jaVRM7PRreEJg6VIwkYcQfoKzJHvy_3fDtE_8nrptFUgZKXVjN3A3a_VcnIiNQFWO3tN33w==)
41. [dust.tt](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAM2HiI8GkkZcLab7g45xdNWJGBToiqIFqkqfKikt1vQ4J-ZIP63WdXP4Duc4bzBXcmFktyQ7qyq1KQ4Hwz3SMHEOJGyyTh2kpUJ97imxBZL6fwH3fadovxBji1HxCmLw6)
42. [shipclaw.app](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHh9vzF35b8SvAc-ZM7pqV8lqddQKJLozS9ZRYgbxlPkGC0Rna3f54ttbI16qMw7u3ZUp0XRewehzRDCRTvvja1A-huOM4XvjNLscvD0nkEy8VF6jTJm3kijoy67xr4pfqt6VM=)
43. [nex.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIFrscj2zQbRLSPDTF3Ox6ps2IRgm_V1geslk4M9HJyRA6qtlgETx5sA9Z5f0CLxqV9azvX2TEokD6QleiTXRyxOLaalVeNvHyJRO__P_RmLoHBVuWVrgO1cJmxEauKmUdXES1vE7_Qxr9LGCx5RgQ3g==)
44. [uxdesign.cc](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHGuehCR89lZs_CGcDFEWSZJ0CGyoFYsxGIghyzbBqxjNI9G_UmRzX-wF3C42VBCBYbezMFJqrHUJGM3hYdDp4WpdPybvk1WXuhBHNKuaYN4WeD4DWo2BEGEQTsl-BUXHMTZndBLibMMdY9chGZNUHpKysYTRw0W9WrMXr1YT0PsMUx6GCfLbDHRPc0hv-8JxuvOuynDCo=)
45. [pipefy.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEMo_NU7ksnsTIP3DYOgotOyrok5KuF-4d9hK9nQNyQ3fGROW8NbCBsl-Jlrirfe5mASmVe2Jhp__xelWur9fHyWszDUGSbJuWJ96SLmKVsMRwz5BKB8Eaw2fNXAyIyMXNZOHGOCf2sDIcZgmw4n8Fk-Ik9GGBJfnlx6w==)
46. [dust.tt](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGgSHyil8_h_98Ak403rcqLP7Z1Yv2mNavGFdljCJtJSvLvsu2kTuLVYp6YNjD7pDZVRvmb6wIUVbAmCnp7jh589jGaz2Ti99JXk6VfnnEvIggyY_s23e0Rys_-uspsGos=)
47. [composio.dev](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF_QBAFkynY1rAU385skMs9m1pUBlpVQTMx3BjDKYObLSzJY1f_8-dGKgDQ4Td2TE3sa3pQxZIV9Do0bF3MrVBPjazawyfAcVCnXrc=)
48. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGtD_EWUGPhW2iT2baffv_3Bu2JE9bD3mvpt06vDIzT4d909daJDjgvVCE_cVJfRjqnTPJ789gUy1Qwbn5VP51IGxULmXkm14V93UFkhI_vq6XC2Z8JXQXyGvVGC0HwpLITe5Qdk1uZzwmNS-sInnY-yyoSK1iDdreC0ogJXY4=)
49. [zenvanriel.nl](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGlwWHLZgYCIPE2i3dvKv774yKlgHxMEIy87JmItkJPubU9Y8TeN5a6hUw15d62J8Yu4mRNI3qn9WcT-Vq9XjtvuV-6CqVNPG49wl2SwYzIDgySqTQtmhtE74mkMVFpaURMLF_5ZvnbyaEj2TtytUFCrCWNkObytuJUgkLRupdoJwK9)
50. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGMbsCnGpK6LRTC39gCtmogzNHx63U4phEfrcgyQ-CugnNQKluolJgxYa5J3-seefAeeXkIeIkYnt4dCHm3Rd9EP6Kjzd3ByFOJegvSzb0wLjmfLC99qDnvNy6scFimtkrG-aUIHBXMuwBo4FP_AFQ7wdaIlPRo3zBeL8HfQu982L6HSlTahzJYrGvmfD8mz13BLsaqY7RbZa9H2rG3kpPPFR0k4q0=)

