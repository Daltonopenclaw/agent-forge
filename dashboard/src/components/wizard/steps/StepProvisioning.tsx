"use client";

import { useEffect, useState } from "react";
import { useWizard } from "../WizardContext";

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
  const { data, nextStep } = useWizard();
  const [currentStage, setCurrentStage] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Rotate tips
    const tipInterval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 4000);

    return () => clearInterval(tipInterval);
  }, []);

  useEffect(() => {
    // Simulate provisioning stages
    // In real implementation, this would poll the backend
    const provisionAgent = async () => {
      try {
        for (let i = 0; i < STAGES.length; i++) {
          setCurrentStage(i);
          // Simulate each stage taking 1-2 seconds
          await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));
        }
        
        // TODO: Replace with actual API call
        // const response = await fetch('/api/agents/provision', {
        //   method: 'POST',
        //   body: JSON.stringify(data),
        // });
        
        // Move to chat
        setTimeout(() => nextStep(), 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create agent");
      }
    };

    provisionAgent();
  }, [data, nextStep]);

  const progress = ((currentStage + 1) / STAGES.length) * 100;

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      {error ? (
        <div className="space-y-4">
          <div className="text-6xl">😕</div>
          <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
          <p className="text-slate-400">{error}</p>
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
            <p className="text-slate-400 mt-2">This usually takes about 30 seconds</p>
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
