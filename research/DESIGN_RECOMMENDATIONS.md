# myintell.ai Agent Creation UX — Design Recommendations

**Generated:** 2026-02-14  
**Based on:** Gemini Deep Research + Current Codebase Analysis

---

## Executive Summary

The current `dashboard/src/app/dashboard/agents/new/page.tsx` implements a minimal create-agent form with 3 fields:
- **Name** (text input)
- **Model** (radio selection: Claude Sonnet/Opus, GPT-4o)
- **System Prompt** (textarea)

This is a solid MVP foundation, but the research identifies a critical UX problem: **the "blank canvas" problem**. Users struggle to write effective system prompts from scratch. The research recommends a wizard-based approach that generates OpenClaw configuration files (`SOUL.md`, `AGENTS.md`, etc.) from user-friendly inputs.

---

## Current State vs. Research Recommendations

| Aspect | Current Implementation | Research Recommendation |
|--------|----------------------|------------------------|
| **Flow** | Single form | 5-step wizard |
| **Personality** | Blank textarea ("System Prompt") | "SoulCraft" chat interview OR archetype selection |
| **Tools** | Not implemented | App store grid with OAuth |
| **Templates** | None | Role-based templates (HR Assistant, Coder, etc.) |
| **Aha Moment** | None | Immediate proactive welcome message |
| **Model Selection** | Exposed (3 options) | Abstract as "Intelligence Level" slider |

---

## Recommended Onboarding Flow

### Phase 1: MVP Enhancement (Quick Wins)

Add templates and improve the system prompt section without major refactor.

```
┌─────────────────────────────────────────────────────────┐
│                    CREATE AGENT                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. CHOOSE A STARTING POINT                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ 🧑‍💼      │ │ 💻      │ │ ✍️      │ │ ⚙️      │        │
│  │Assistant│ │ Coder   │ │ Writer  │ │ Custom  │        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                                                          │
│  2. PERSONALIZE                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Name: [My Agent________________]                  │   │
│  │                                                   │   │
│  │ Personality:                                      │   │
│  │ ○ Professional & Formal                           │   │
│  │ ○ Friendly & Casual                               │   │
│  │ ○ Technical & Precise                             │   │
│  │ ○ Creative & Playful                              │   │
│  │                                                   │   │
│  │ Additional instructions: (optional)               │   │
│  │ [___________________________________________]     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  3. INTELLIGENCE LEVEL                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Fast ●━━━━━━━○━━━━━━━━━━━━━━━━━━○ Powerful      │   │
│  │       Sonnet      Opus        GPT-4o             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [Create Agent]  [Cancel]                                │
└─────────────────────────────────────────────────────────┘
```

### Phase 2: Full Wizard (Post-MVP)

Implement the 5-step flow from research:

```
Step 1: Identity        → IDENTITY.md
Step 2: Soul/Personality → SOUL.md (via SoulCraft chat or archetype)
Step 3: Tools           → TOOLS.md + config.json5 (via Composio OAuth)
Step 4: Channels        → Gateway config
Step 5: First Breath    → Proactive welcome message
```

---

## Implementation Plan

### Phase 1: MVP Enhancement

#### 1.1 Add Agent Templates

Create a templates data structure:

```typescript
// dashboard/src/lib/agent-templates.ts
export const AGENT_TEMPLATES = [
  {
    id: 'assistant',
    name: 'Personal Assistant',
    icon: '🧑‍💼',
    description: 'General-purpose helper for tasks, scheduling, and research',
    soulMd: `You are a helpful personal assistant. You are:
- Proactive and anticipatory of needs
- Organized and detail-oriented
- Professional but warm
- Efficient with time`,
    defaultModel: 'claude-sonnet-4-20250514',
  },
  {
    id: 'coder',
    name: 'Code Assistant',
    icon: '💻',
    description: 'Expert programmer for debugging, code review, and development',
    soulMd: `You are an expert software engineer. You are:
- Precise and technically accurate
- Security-conscious
- You explain your reasoning
- You write clean, maintainable code
- You suggest tests and edge cases`,
    defaultModel: 'claude-opus-4-20250514',
  },
  {
    id: 'writer',
    name: 'Writing Partner',
    icon: '✍️',
    description: 'Creative collaborator for content, copywriting, and editing',
    soulMd: `You are a skilled writer and editor. You are:
- Creative and imaginative
- Attentive to tone and voice
- Clear and concise
- You adapt to different styles`,
    defaultModel: 'claude-sonnet-4-20250514',
  },
  {
    id: 'custom',
    name: 'Start from Scratch',
    icon: '⚙️',
    description: 'Build your own agent with full control',
    soulMd: '',
    defaultModel: 'claude-sonnet-4-20250514',
  },
];
```

#### 1.2 Add Personality Presets

```typescript
// dashboard/src/lib/personality-presets.ts
export const PERSONALITY_PRESETS = [
  {
    id: 'professional',
    name: 'Professional & Formal',
    traits: ['Uses proper grammar', 'Avoids slang and emoji', 'Structured responses'],
  },
  {
    id: 'friendly',
    name: 'Friendly & Casual',
    traits: ['Conversational tone', 'Uses occasional emoji', 'Warm and approachable'],
  },
  {
    id: 'technical',
    name: 'Technical & Precise',
    traits: ['Detailed explanations', 'Cites sources', 'Uses proper terminology'],
  },
  {
    id: 'creative',
    name: 'Creative & Playful',
    traits: ['Uses metaphors', 'Thinks outside the box', 'Energetic and enthusiastic'],
  },
];
```

#### 1.3 Updated Form Component

```tsx
// dashboard/src/app/dashboard/agents/new/page.tsx (updated)
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useTenant } from "@/lib/tenant-context";
import { createAgent } from "@/lib/api";
import { AGENT_TEMPLATES } from "@/lib/agent-templates";
import { PERSONALITY_PRESETS } from "@/lib/personality-presets";

const MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Sonnet', level: 0 },
  { id: 'claude-opus-4-20250514', name: 'Opus', level: 1 },
  { id: 'gpt-4o', name: 'GPT-4o', level: 2 },
];

export default function NewAgentPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [personality, setPersonality] = useState<string | null>(null);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [modelLevel, setModelLevel] = useState(0); // 0 = Sonnet, 1 = Opus, 2 = GPT-4o

  // Generate the final system prompt from selections
  function generateSystemPrompt(): string {
    const parts: string[] = [];
    
    // Add template base
    const template = AGENT_TEMPLATES.find(t => t.id === selectedTemplate);
    if (template?.soulMd) {
      parts.push(template.soulMd);
    }
    
    // Add personality traits
    const preset = PERSONALITY_PRESETS.find(p => p.id === personality);
    if (preset) {
      parts.push(`\nCommunication style:\n${preset.traits.map(t => `- ${t}`).join('\n')}`);
    }
    
    // Add custom instructions
    if (additionalInstructions.trim()) {
      parts.push(`\nAdditional instructions:\n${additionalInstructions}`);
    }
    
    return parts.join('\n');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!tenant) {
      setError("Workspace not loaded");
      return;
    }
    
    if (!selectedTemplate) {
      setError("Please select a template");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      
      const selectedModel = MODELS[modelLevel].id;
      const systemPrompt = generateSystemPrompt();
      
      await createAgent(token, {
        tenantId: tenant.id,
        name: name || "My Agent",
        model: selectedModel,
        systemPrompt,
      });
      
      router.push("/dashboard/agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setLoading(false);
    }
  }

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Create Agent</h1>
        <p className="text-slate-400 mt-1">Build your AI superfriend</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Template Selection */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">1. Choose a Starting Point</CardTitle>
            <CardDescription className="text-slate-400">
              Pick a template or start from scratch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {AGENT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(template.id);
                    if (template.defaultModel) {
                      const modelIndex = MODELS.findIndex(m => m.id === template.defaultModel);
                      if (modelIndex >= 0) setModelLevel(modelIndex);
                    }
                  }}
                  className={`p-4 rounded-lg border text-center transition ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                  }`}
                >
                  <div className="text-3xl mb-2">{template.icon}</div>
                  <p className="font-medium text-white">{template.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{template.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Personalization (only shown after template selected) */}
        {selectedTemplate && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">2. Personalize</CardTitle>
              <CardDescription className="text-slate-400">
                Give your agent a name and personality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Assistant"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-white">Personality</Label>
                <div className="grid grid-cols-2 gap-3">
                  {PERSONALITY_PRESETS.map((preset) => (
                    <label
                      key={preset.id}
                      className={`flex items-start p-3 rounded-lg border cursor-pointer transition ${
                        personality === preset.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="personality"
                        value={preset.id}
                        checked={personality === preset.id}
                        onChange={() => setPersonality(preset.id)}
                        className="sr-only"
                      />
                      <div>
                        <p className="font-medium text-white text-sm">{preset.name}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {preset.traits.slice(0, 2).join(', ')}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {selectedTemplate === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="instructions" className="text-white">
                    Custom Instructions
                  </Label>
                  <textarea
                    id="instructions"
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    placeholder="Describe what you want your agent to do..."
                    rows={4}
                    className="w-full rounded-md bg-slate-700 border border-slate-600 text-white p-3 text-sm"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Intelligence Level (only shown after template selected) */}
        {selectedTemplate && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">3. Intelligence Level</CardTitle>
              <CardDescription className="text-slate-400">
                Balance speed vs. capability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Slider
                  value={[modelLevel]}
                  onValueChange={([value]) => setModelLevel(value)}
                  max={2}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">⚡ Fast</span>
                  <span className="text-white font-medium">{MODELS[modelLevel].name}</span>
                  <span className="text-slate-400">🧠 Powerful</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error & Actions */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-4">
          <Button type="submit" disabled={loading || !selectedTemplate}>
            {loading ? "Creating..." : "Create Agent"}
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => router.back()}
            className="text-slate-300"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
```

---

## OpenClaw File Mapping

When the Platform API creates an agent, it should generate these files in the orchestrator's PV:

### Generated Files

```
/state/workspace/
├── IDENTITY.md        # Agent name, description
├── SOUL.md            # Personality (from template + personality preset)
├── AGENTS.md          # Base operational rules (platform-provided)
├── TOOLS.md           # User-specific tool notes (initially empty)
├── MEMORY.md          # Long-term memory (initially empty)
└── memory/            # Daily memory logs (auto-created)
```

### Example Generated SOUL.md

```markdown
# Soul

You are an expert software engineer. You are:
- Precise and technically accurate
- Security-conscious
- You explain your reasoning
- You write clean, maintainable code
- You suggest tests and edge cases

## Communication Style
- Detailed explanations
- Cites sources
- Uses proper terminology
```

### Example Generated IDENTITY.md

```markdown
# Identity

**Name:** CodeBot  
**Created:** 2026-02-14  
**Template:** Code Assistant  
**Owner:** tenant-acme
```

---

## API Changes Required

### Platform API: Create Agent Endpoint

```typescript
// platform-api/src/routes/agents.ts
app.post('/tenants/:tenantId/agents', async (c) => {
  const { tenantId } = c.req.param();
  const body = await c.req.json();
  
  // Validate
  const { name, model, systemPrompt, template, personality } = body;
  
  // Generate OpenClaw files
  const soulMd = generateSoulMd(template, personality, systemPrompt);
  const identityMd = generateIdentityMd(name, template);
  const agentsMd = DEFAULT_AGENTS_MD; // Platform-provided base rules
  
  // Create agent record in Neon
  const agent = await db.agents.create({
    tenantId,
    name,
    model,
    status: 'provisioning',
  });
  
  // Trigger provisioning controller to:
  // 1. Write files to orchestrator PV
  // 2. Restart/signal orchestrator to reload
  await provisioningQueue.add('configure-agent', {
    agentId: agent.id,
    tenantId,
    files: {
      'SOUL.md': soulMd,
      'IDENTITY.md': identityMd,
      'AGENTS.md': agentsMd,
    },
  });
  
  return c.json(agent);
});
```

---

## Phase 2: Future Enhancements

### SoulCraft Chat Interview

Instead of form fields, a conversational flow:

```
Agent: "Hi! I'm going to help you create your AI agent. What will 
       they mainly be used for?"

User:  "I need help managing my calendar and emails"

Agent: "Got it! Should they be formal (like a professional assistant) 
       or more casual (like a friend)?"

User:  "Professional but not stiff"

Agent: "Perfect. Any specific things they should always do or never do?"

User:  "Always summarize long emails, never schedule meetings before 10am"

Agent: "Great! I've created 'Calendar Assistant' for you. Here's a 
       preview of their personality..."
       
       [Shows generated SOUL.md preview]
       
       "Want to tweak anything before we launch?"
```

### Tool Integration (via Composio)

```tsx
// Future: Step 3 would show an app store grid
<div className="grid grid-cols-4 gap-4">
  <ToolCard icon="📧" name="Gmail" connected={false} onConnect={handleOAuth} />
  <ToolCard icon="📅" name="Google Calendar" connected={true} />
  <ToolCard icon="📁" name="Google Drive" connected={false} />
  <ToolCard icon="💬" name="Slack" connected={false} />
  {/* etc. */}
</div>
```

---

## Summary of Recommendations

### Immediate (This Sprint)
1. ✅ Add template selection grid (4 templates)
2. ✅ Add personality preset radio buttons
3. ✅ Replace model dropdown with "Intelligence Level" slider
4. ✅ Generate SOUL.md on backend from selections

### Short-term (Next Sprint)
5. Add "Preview" of generated system prompt
6. Add "Advanced" expandable section for power users
7. Implement "First Breath" welcome message after creation

### Medium-term (Post-MVP)
8. SoulCraft conversational onboarding
9. Tool/integration marketplace with OAuth
10. Channel configuration (WhatsApp, Slack, etc.)

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `dashboard/src/lib/agent-templates.ts` | Create | Template definitions |
| `dashboard/src/lib/personality-presets.ts` | Create | Personality options |
| `dashboard/src/app/dashboard/agents/new/page.tsx` | Modify | Enhanced form |
| `platform-api/src/routes/agents.ts` | Modify | Generate OpenClaw files |
| `platform-api/src/lib/openclaw-generator.ts` | Create | File generation logic |

---

*Based on Gemini Deep Research analysis of OpenClaw architecture and industry best practices.*
