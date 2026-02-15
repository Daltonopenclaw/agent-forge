"use client";

import { useWizard } from "./WizardContext";
import { StepIdentity } from "./steps/StepIdentity";
import { StepPersonality } from "./steps/StepPersonality";
import { StepIntelligence } from "./steps/StepIntelligence";
import { StepProvisioning } from "./steps/StepProvisioning";
import { StepFirstBreath } from "./steps/StepFirstBreath";

const STEPS = [
  { num: 1, label: "Identity" },
  { num: 2, label: "Personality" },
  { num: 3, label: "Intelligence" },
  { num: 4, label: "Creating..." },
  { num: 5, label: "Chat" },
];

export function WizardShell() {
  const { step } = useWizard();

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Progress Bar - only show for steps 1-3 */}
      {step <= 3 && (
        <div className="border-b border-slate-800">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-2">
              {STEPS.slice(0, 3).map((s) => (
                <div
                  key={s.num}
                  className={`flex items-center ${s.num < 3 ? "flex-1" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step >= s.num
                        ? "bg-blue-500 text-white"
                        : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {step > s.num ? "✓" : s.num}
                  </div>
                  <span
                    className={`ml-2 text-sm ${
                      step >= s.num ? "text-white" : "text-slate-500"
                    }`}
                  >
                    {s.label}
                  </span>
                  {s.num < 3 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 ${
                        step > s.num ? "bg-blue-500" : "bg-slate-700"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {step === 1 && <StepIdentity />}
        {step === 2 && <StepPersonality />}
        {step === 3 && <StepIntelligence />}
        {step === 4 && <StepProvisioning />}
        {step === 5 && <StepFirstBreath />}
      </div>
    </div>
  );
}
