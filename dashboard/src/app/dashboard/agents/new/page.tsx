"use client";

import { WizardProvider, WizardShell } from "@/components/wizard";

export default function NewAgentPage() {
  return (
    <WizardProvider>
      <WizardShell />
    </WizardProvider>
  );
}
