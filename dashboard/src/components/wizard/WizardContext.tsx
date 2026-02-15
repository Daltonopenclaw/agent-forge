"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export interface WizardData {
  // Step 1: Identity
  name: string;
  avatar: string;
  
  // Step 2: Personality
  personalityType: "personal-assistant" | "research-partner" | "creative-collaborator" | "technical-expert" | "custom";
  customPersonality?: {
    communicationStyle: string;
    focusAreas: string;
    boundaries: string;
  };
  
  // Step 3: Intelligence
  modelTier: "smart" | "powerful" | "fast";
  byok?: {
    provider: "anthropic" | "openai";
    apiKey: string;
  };
}

interface WizardContextType {
  step: number;
  setStep: (step: number) => void;
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  canProceed: boolean;
  setCanProceed: (can: boolean) => void;
}

const WizardContext = createContext<WizardContextType | null>(null);

const initialData: WizardData = {
  name: "",
  avatar: "🤖",
  personalityType: "personal-assistant",
  modelTier: "smart",
};

export function WizardProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData);
  const [canProceed, setCanProceed] = useState(false);

  const updateData = (updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 5));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <WizardContext.Provider
      value={{
        step,
        setStep,
        data,
        updateData,
        nextStep,
        prevStep,
        canProceed,
        setCanProceed,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used within WizardProvider");
  }
  return context;
}
