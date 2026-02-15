"use client";

import { useEffect, useState } from "react";
import { useWizard } from "../WizardContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AVATAR_OPTIONS = ["🤖", "🧠", "⚡", "🎯", "🌟", "🔮", "💡", "🚀", "🎨", "🔬"];

export function StepIdentity() {
  const { data, updateData, nextStep, setCanProceed } = useWizard();
  const [name, setName] = useState(data.name);
  const [avatar, setAvatar] = useState(data.avatar);
  const [customAvatar, setCustomAvatar] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const isValid = name.length >= 2 && name.length <= 30 && avatar.length > 0;

  useEffect(() => {
    setCanProceed(isValid);
  }, [isValid, setCanProceed]);

  const handleContinue = () => {
    updateData({ name, avatar });
    nextStep();
  };

  const handleAvatarSelect = (emoji: string) => {
    setAvatar(emoji);
    setShowCustom(false);
  };

  const handleCustomAvatar = () => {
    if (customAvatar.length > 0) {
      setAvatar(customAvatar);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Let's create your agent</h1>
        <p className="text-slate-400 mt-2">
          Give your agent a name and pick an avatar to get started.
        </p>
      </div>

      <div className="space-y-6">
        {/* Name Input */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-white text-lg">
            What should we call them?
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Atlas"
            className="bg-slate-800 border-slate-700 text-white text-lg h-12"
            maxLength={30}
          />
          <p className="text-sm text-slate-500">
            {name.length}/30 characters
          </p>
        </div>

        {/* Avatar Selection */}
        <div className="space-y-3">
          <Label className="text-white text-lg">Pick an avatar</Label>
          <div className="flex flex-wrap gap-3">
            {AVATAR_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleAvatarSelect(emoji)}
                className={`w-14 h-14 text-3xl rounded-xl border-2 transition-all ${
                  avatar === emoji && !showCustom
                    ? "border-blue-500 bg-blue-500/20 scale-110"
                    : "border-slate-700 bg-slate-800 hover:border-slate-600"
                }`}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className={`w-14 h-14 text-xl rounded-xl border-2 transition-all ${
                showCustom
                  ? "border-blue-500 bg-blue-500/20"
                  : "border-slate-700 bg-slate-800 hover:border-slate-600"
              }`}
            >
              ✏️
            </button>
          </div>

          {showCustom && (
            <div className="flex gap-2 mt-3">
              <Input
                value={customAvatar}
                onChange={(e) => setCustomAvatar(e.target.value)}
                placeholder="Enter emoji..."
                className="bg-slate-800 border-slate-700 text-white w-32"
                maxLength={2}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleCustomAvatar}
                disabled={!customAvatar}
              >
                Use this
              </Button>
            </div>
          )}
        </div>

        {/* Preview */}
        {name && (
          <div className="p-6 rounded-xl bg-slate-800 border border-slate-700">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-4xl">
                {avatar}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">{name}</h3>
                <p className="text-slate-400">Your AI agent</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleContinue}
          disabled={!isValid}
          size="lg"
          className="px-8"
        >
          Continue →
        </Button>
      </div>
    </div>
  );
}
