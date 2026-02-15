"use client";

import { useEffect, useState } from "react";
import { useWizard, WizardData } from "../WizardContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const TEMPLATES = [
  {
    id: "personal-assistant" as const,
    emoji: "🤝",
    name: "Personal Assistant",
    description: "Helpful, proactive, remembers your preferences. Great for daily tasks, scheduling, and staying organized.",
  },
  {
    id: "research-partner" as const,
    emoji: "🔍",
    name: "Research Partner",
    description: "Thorough, analytical, digs deep into topics. Perfect for exploring ideas and synthesizing information.",
  },
  {
    id: "creative-collaborator" as const,
    emoji: "🎨",
    name: "Creative Collaborator",
    description: "Imaginative, generates ideas, helps with writing. Ideal for brainstorming and creative projects.",
  },
  {
    id: "technical-expert" as const,
    emoji: "💻",
    name: "Technical Expert",
    description: "Precise, code-savvy, helps with development. Built for coding, debugging, and technical problem-solving.",
  },
  {
    id: "custom" as const,
    emoji: "✨",
    name: "Custom",
    description: "Define your own personality. You'll answer a few questions to shape how your agent communicates.",
  },
];

export function StepPersonality() {
  const { data, updateData, nextStep, prevStep, setCanProceed } = useWizard();
  const [selected, setSelected] = useState<WizardData["personalityType"]>(data.personalityType);
  const [showCustomForm, setShowCustomForm] = useState(data.personalityType === "custom");
  const [customData, setCustomData] = useState(data.customPersonality || {
    communicationStyle: "",
    focusAreas: "",
    boundaries: "",
  });

  const isCustomValid = selected !== "custom" || (
    customData.communicationStyle.length > 10 &&
    customData.focusAreas.length > 10
  );

  useEffect(() => {
    setCanProceed(isCustomValid);
  }, [isCustomValid, setCanProceed]);

  const handleSelect = (id: WizardData["personalityType"]) => {
    setSelected(id);
    setShowCustomForm(id === "custom");
  };

  const handleContinue = () => {
    updateData({
      personalityType: selected,
      customPersonality: selected === "custom" ? customData : undefined,
    });
    nextStep();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">
          What kind of agent is {data.name}?
        </h1>
        <p className="text-slate-400 mt-2">
          Choose a personality template or create your own.
        </p>
      </div>

      {/* Template Selection */}
      <div className="grid gap-4">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => handleSelect(template.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              selected === template.id
                ? "border-blue-500 bg-blue-500/10"
                : "border-slate-700 bg-slate-800 hover:border-slate-600"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">{template.emoji}</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">
                  {template.name}
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                  {template.description}
                </p>
              </div>
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selected === template.id
                    ? "border-blue-500 bg-blue-500"
                    : "border-slate-600"
                }`}
              >
                {selected === template.id && (
                  <span className="text-white text-sm">✓</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Custom Personality Form */}
      {showCustomForm && (
        <div className="space-y-6 p-6 rounded-xl bg-slate-800 border border-slate-700">
          <h3 className="text-xl font-semibold text-white">
            Tell us about {data.name}
          </h3>

          <div className="space-y-2">
            <Label className="text-white">How should {data.name} communicate?</Label>
            <textarea
              value={customData.communicationStyle}
              onChange={(e) => setCustomData({ ...customData, communicationStyle: e.target.value })}
              placeholder="Casual and friendly, but stays focused on getting things done. Can be witty when appropriate."
              rows={3}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white p-3 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">What should {data.name} help you with?</Label>
            <textarea
              value={customData.focusAreas}
              onChange={(e) => setCustomData({ ...customData, focusAreas: e.target.value })}
              placeholder="Managing my schedule, researching topics, and drafting communications"
              rows={3}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white p-3 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">Anything {data.name} should avoid? (optional)</Label>
            <textarea
              value={customData.boundaries}
              onChange={(e) => setCustomData({ ...customData, boundaries: e.target.value })}
              placeholder="Don't send emails without my approval. Don't make assumptions about my preferences."
              rows={3}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white p-3 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={prevStep} className="text-slate-300">
          ← Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!isCustomValid}
          size="lg"
          className="px-8"
        >
          Continue →
        </Button>
      </div>
    </div>
  );
}
