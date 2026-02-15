"use client";

import { useEffect, useState } from "react";
import { useWizard, WizardData } from "../WizardContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MODEL_TIERS = [
  {
    id: "smart" as const,
    emoji: "🧠",
    name: "Smart",
    model: "Claude Sonnet",
    description: "Fast, capable, balanced — great for most tasks",
    pricing: "Included in your plan",
    recommended: true,
  },
  {
    id: "powerful" as const,
    emoji: "🚀",
    name: "Powerful",
    model: "Claude Opus",
    description: "Maximum capability for complex tasks",
    pricing: "+$0.02/message avg",
    recommended: false,
  },
  {
    id: "fast" as const,
    emoji: "⚡",
    name: "Fast",
    model: "Claude Haiku",
    description: "Quick responses for simple tasks",
    pricing: "Included in your plan",
    recommended: false,
  },
];

const PROVIDERS = [
  { id: "anthropic" as const, name: "Anthropic", placeholder: "sk-ant-api03-..." },
  { id: "openai" as const, name: "OpenAI", placeholder: "sk-..." },
];

export function StepIntelligence() {
  const { data, updateData, nextStep, prevStep, setCanProceed } = useWizard();
  const [tier, setTier] = useState<WizardData["modelTier"]>(data.modelTier);
  const [showByok, setShowByok] = useState(false);
  const [byokProvider, setByokProvider] = useState<"anthropic" | "openai">("anthropic");
  const [byokKey, setByokKey] = useState("");
  const [byokError, setByokError] = useState("");

  useEffect(() => {
    setCanProceed(true);
  }, [setCanProceed]);

  const handleContinue = () => {
    updateData({
      modelTier: tier,
      byok: byokKey ? { provider: byokProvider, apiKey: byokKey } : undefined,
    });
    nextStep();
  };

  const validateKey = () => {
    // Basic validation
    if (byokProvider === "anthropic" && !byokKey.startsWith("sk-ant-")) {
      setByokError("Anthropic keys should start with 'sk-ant-'");
      return false;
    }
    if (byokProvider === "openai" && !byokKey.startsWith("sk-")) {
      setByokError("OpenAI keys should start with 'sk-'");
      return false;
    }
    setByokError("");
    return true;
  };

  const handleSaveKey = () => {
    if (validateKey()) {
      setShowByok(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">
          Choose {data.name}'s intelligence
        </h1>
        <p className="text-slate-400 mt-2">
          Select a model tier or bring your own API key for unlimited usage.
        </p>
      </div>

      {/* Model Tier Selection */}
      <div className="grid gap-4">
        {MODEL_TIERS.map((model) => (
          <button
            key={model.id}
            type="button"
            onClick={() => setTier(model.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              tier === model.id
                ? "border-blue-500 bg-blue-500/10"
                : "border-slate-700 bg-slate-800 hover:border-slate-600"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">{model.emoji}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">
                    {model.name}
                  </h3>
                  {model.recommended && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-slate-300 text-sm">{model.model}</p>
                <p className="text-slate-400 text-sm mt-1">{model.description}</p>
                <p className="text-slate-500 text-xs mt-2">{model.pricing}</p>
              </div>
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  tier === model.id
                    ? "border-blue-500 bg-blue-500"
                    : "border-slate-600"
                }`}
              >
                {tier === model.id && (
                  <span className="text-white text-sm">✓</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* BYOK Option */}
      {!showByok ? (
        <div className="p-4 rounded-xl border border-dashed border-slate-600 bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 font-medium">
                💡 Want unlimited usage or a different provider?
              </p>
              <p className="text-slate-500 text-sm mt-1">
                Use your own API key and pay your provider directly
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowByok(true)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Bring Your Own Key →
            </Button>
          </div>
          {byokKey && (
            <div className="mt-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-green-400 text-sm">
                ✓ Using your {byokProvider === "anthropic" ? "Anthropic" : "OpenAI"} API key
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-slate-800 border border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              Bring Your Own Key
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowByok(false)}
              className="text-slate-400"
            >
              Cancel
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Provider</Label>
            <div className="flex gap-3">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setByokProvider(provider.id)}
                  className={`px-4 py-2 rounded-lg border transition ${
                    byokProvider === provider.id
                      ? "border-blue-500 bg-blue-500/10 text-white"
                      : "border-slate-600 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white">API Key</Label>
            <Input
              type="password"
              value={byokKey}
              onChange={(e) => {
                setByokKey(e.target.value);
                setByokError("");
              }}
              placeholder={PROVIDERS.find((p) => p.id === byokProvider)?.placeholder}
              className="bg-slate-700 border-slate-600 text-white font-mono"
            />
            {byokError && (
              <p className="text-red-400 text-sm">{byokError}</p>
            )}
            <p className="text-slate-500 text-xs">
              🔒 Encrypted and stored securely. Never written to agent workspace.
            </p>
          </div>

          <div className="pt-2">
            <p className="text-slate-400 text-sm mb-3">
              <strong className="text-white">Benefits of BYOK:</strong>
            </p>
            <ul className="text-slate-400 text-sm space-y-1">
              <li>• Unlimited usage (you pay provider directly)</li>
              <li>• Access to all models from your provider</li>
              <li>• Use existing enterprise agreements</li>
            </ul>
          </div>

          <Button onClick={handleSaveKey} disabled={!byokKey} className="w-full">
            Save Key
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={prevStep} className="text-slate-300">
          ← Back
        </Button>
        <Button onClick={handleContinue} size="lg" className="px-8">
          Create {data.name} →
        </Button>
      </div>
    </div>
  );
}
