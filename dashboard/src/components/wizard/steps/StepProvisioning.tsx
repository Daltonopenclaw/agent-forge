"use client";

import { useEffect, useState, useRef } from "react";
import { useWizard } from "../WizardContext";
import { useAuth } from "@clerk/nextjs";
import { useTenant } from "@/lib/tenant-context";
import { createAgent, getAgentStatus, CreateAgentData } from "@/lib/api";

// Import personality templates
const SOUL_TEMPLATES: Record<string, string> = {
  'personal-assistant': `# SOUL.md - Personal Assistant

You are {{NAME}}, a capable, proactive personal assistant who genuinely cares about being helpful.

## Personality
- Proactive: You anticipate needs before being asked
- Reliable: You follow through on commitments
- Warm but efficient: Friendly without being chatty
- Adaptable: You adjust your style to the situation

## Communication
- Be concise by default, detailed when needed
- Confirm understanding before taking significant actions
- Summarize key points when conversations get long

## Boundaries
- Always ask before sending external communications
- Don't make financial transactions without explicit approval
- Be transparent about uncertainty

Be the assistant you'd want to have — helpful, trustworthy, and a pleasure to work with.`,

  'research-partner': `# SOUL.md - Research Partner

You are {{NAME}}, a thorough, analytical thinker who loves diving deep into complex topics.

## Personality
- Thorough: You dig deep rather than skimming the surface
- Analytical: You break down complex topics clearly
- Curious: You ask follow-up questions
- Balanced: You present multiple perspectives

## Communication
- Lead with key findings, then provide detail
- Use structure: headers, bullet points when helpful
- Cite sources and distinguish facts from interpretations

## Research Approach
1. Understand the question first
2. Gather information from multiple angles
3. Synthesize and find patterns
4. Present clearly and acknowledge gaps

Be the research partner who makes complex topics accessible.`,

  'creative-collaborator': `# SOUL.md - Creative Collaborator

You are {{NAME}}, an imaginative partner who helps bring ideas to life.

## Personality
- Imaginative: You generate unexpected ideas
- Encouraging: You build on ideas rather than shooting them down
- Playful: You're not afraid to be bold or experimental
- Collaborative: You riff on ideas together

## Communication
- Embrace "yes, and..." thinking
- Offer multiple options and variations
- Balance wild ideas with practical suggestions
- Match creative energy

## Creative Process
1. Explore freely first
2. Find the gems
3. Develop and refine
4. Iterate based on feedback

Be the creative partner who makes brainstorming sessions productive.`,

  'technical-expert': `# SOUL.md - Technical Expert

You are {{NAME}}, a precise, knowledgeable technical partner.

## Personality
- Precise: You value accuracy and correctness
- Pragmatic: You balance ideal solutions with constraints
- Patient: You explain complex concepts clearly
- Thorough: You consider edge cases and security

## Communication
- Use code examples to illustrate points
- Be specific: versions, configurations, exact commands
- Explain the "why" alongside the "how"

## Code Philosophy
- Readable code > clever code
- Handle errors explicitly
- Document non-obvious decisions
- Security is non-negotiable

Be the technical partner who makes complex problems tractable.`,
};

const AGENTS_TEMPLATE = `# AGENTS.md

## First Run
Read SOUL.md to understand who you are.
Read USER.md if it exists for context about your human.

## Every Session
Check memory/YYYY-MM-DD.md (today + yesterday) for recent context.

## Memory
Capture what matters. Decisions, context, things to remember.
Write to MEMORY.md for long-term important items.
Write to memory/YYYY-MM-DD.md for daily logs.

## Safety
- Don't exfiltrate private data
- Don't run destructive commands without asking
- When in doubt, ask

## External vs Internal
Safe to do freely: Read files, explore, search the web
Ask first: Sending emails, public posts, anything that leaves the machine
`;

const STAGES = [
  { id: "namespace", label: "Setting up secure environment" },
  { id: "config", label: "Configuring personality" },
  { id: "gateway", label: "Starting agent runtime" },
  { id: "ready", label: "Preparing first conversation" },
];

const TIPS = [
  "Your agent will remember conversations and learn your preferences over time.",
  "You can customize your agent's personality anytime in settings.",
  "Try asking your agent to remember something — it'll stick!",
  "Your agent can search the web, manage files, and more.",
];

export function StepProvisioning() {
  const { data, nextStep, updateData } = useWizard();
  const { getToken } = useAuth();
  const { tenant } = useTenant();
  const [currentStage, setCurrentStage] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const provisioningStarted = useRef(false);

  useEffect(() => {
    // Rotate tips
    const tipInterval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(tipInterval);
  }, []);

  useEffect(() => {
    if (provisioningStarted.current) return;
    provisioningStarted.current = true;

    const provisionAgent = async () => {
      try {
        const token = await getToken();
        if (!token || !tenant) {
          throw new Error("Not authenticated");
        }

        // Generate SOUL.md content
        let soulContent: string;
        if (data.personalityType === 'custom' && data.customPersonality) {
          soulContent = `# SOUL.md - ${data.name}

${data.customPersonality.communicationStyle}

## What I Help With
${data.customPersonality.focusAreas}

## Boundaries
${data.customPersonality.boundaries || 'Ask before taking actions that cannot be undone.'}

## How I Work
I pay attention to preferences and learn over time. I'm here to be genuinely helpful.`;
        } else {
          soulContent = (SOUL_TEMPLATES[data.personalityType] || SOUL_TEMPLATES['personal-assistant'])
            .replace(/\{\{NAME\}\}/g, data.name);
        }

        // Create agent via API
        setCurrentStage(0);
        const agentData: CreateAgentData = {
          tenantId: tenant.id,
          name: data.name,
          avatar: data.avatar,
          personalityType: data.personalityType,
          soulContent,
          agentsContent: AGENTS_TEMPLATE,
          modelTier: data.modelTier,
          byokProvider: data.byok?.provider,
          byokApiKey: data.byok?.apiKey,
        };

        const { agent } = await createAgent(token, agentData);
        setAgentId(agent.id);

        // Poll for provisioning status
        let complete = false;
        let attempts = 0;
        const maxAttempts = 90; // 3 minutes max

        while (!complete && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2000));
          attempts++;

          // Refresh token on each poll to avoid expiration
          const freshToken = await getToken();
          if (!freshToken) {
            throw new Error('Session expired - please refresh and try again');
          }
          
          const status = await getAgentStatus(freshToken, agent.id);
          
          if (status.agentStatus === 'running') {
            complete = true;
            setCurrentStage(STAGES.length);
          } else if (status.agentStatus === 'error') {
            throw new Error(status.provisioning?.error || 'Provisioning failed');
          } else if (status.provisioning) {
            // Map provisioning stage to UI stage
            const stageIndex = STAGES.findIndex(s => s.id === status.provisioning?.stage);
            if (stageIndex >= 0) {
              setCurrentStage(stageIndex);
            }
          }
        }

        if (!complete) {
          throw new Error('Provisioning timed out');
        }

        // Store agent ID and move to chat
        (updateData as any)({ agentId: agent.id });
        setTimeout(() => nextStep(), 1000);

      } catch (err) {
        console.error('Provisioning error:', err);
        setError(err instanceof Error ? err.message : 'Failed to create agent');
      }
    };

    provisionAgent();
  }, [data, getToken, tenant, nextStep, updateData]);

  const progress = ((currentStage + 1) / (STAGES.length + 1)) * 100;

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      {error ? (
        <div className="space-y-4">
          <div className="text-6xl">😕</div>
          <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
          <p className="text-slate-400 max-w-md">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="space-y-8 w-full max-w-md">
          {/* Avatar animation */}
          <div className="text-6xl animate-bounce">{data.avatar}</div>
          
          <div>
            <h2 className="text-2xl font-bold text-white">
              Creating {data.name}...
            </h2>
            <p className="text-slate-400 mt-2">This usually takes about 30-60 seconds</p>
          </div>

          {/* Progress stages */}
          <div className="space-y-3 text-left">
            {STAGES.map((stage, index) => (
              <div
                key={stage.id}
                className={`flex items-center gap-3 transition-opacity ${
                  index > currentStage ? "opacity-40" : "opacity-100"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                    index < currentStage
                      ? "bg-green-500 text-white"
                      : index === currentStage
                      ? "bg-blue-500 text-white animate-pulse"
                      : "bg-slate-700 text-slate-500"
                  }`}
                >
                  {index < currentStage ? "✓" : index === currentStage ? "◐" : "○"}
                </div>
                <span
                  className={
                    index <= currentStage ? "text-white" : "text-slate-500"
                  }
                >
                  {stage.label}
                </span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Tip */}
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
            <p className="text-slate-400 text-sm">
              💡 <span className="text-slate-300">{TIPS[tipIndex]}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
