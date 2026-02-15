# Personality Templates

These SOUL.md templates define agent personalities for the myintell.ai onboarding wizard.

## Available Templates

| Template | File | Description |
|----------|------|-------------|
| Personal Assistant | `personal-assistant.md` | Helpful, proactive, remembers preferences |
| Research Partner | `research-partner.md` | Thorough, analytical, digs deep |
| Creative Collaborator | `creative-collaborator.md` | Imaginative, generates ideas |
| Technical Expert | `technical-expert.md` | Precise, code-savvy, development focus |
| Custom | `custom-template.md` | Template with placeholders for user input |

## Template Variables

Templates use `{{VARIABLE}}` placeholders that get replaced during agent creation:

| Variable | Source | Description |
|----------|--------|-------------|
| `{{AGENT_NAME}}` | Step 1 | User-provided agent name |
| `{{PERSONALITY_SUMMARY}}` | Step 2 (custom) | One-line personality summary |
| `{{PURPOSE_DESCRIPTION}}` | Step 2 (custom) | What the agent helps with |
| `{{COMMUNICATION_STYLE}}` | Step 2 (custom) | How the agent communicates |
| `{{FOCUS_AREAS}}` | Step 2 (custom) | Primary tasks/topics |
| `{{BOUNDARIES}}` | Step 2 (custom) | Things the agent should avoid |

## Usage

```typescript
import { readFileSync } from 'fs';

function generateSoulMd(template: string, variables: Record<string, string>): string {
  let content = readFileSync(`templates/personalities/${template}.md`, 'utf-8');
  for (const [key, value] of Object.entries(variables)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content;
}
```

## Adding New Templates

1. Create a new `.md` file in this directory
2. Follow the existing structure (Core Identity, Traits, Style, Boundaries)
3. Use `{{AGENT_NAME}}` at minimum for personalization
4. Add to the README table
5. Add to the frontend template selector
