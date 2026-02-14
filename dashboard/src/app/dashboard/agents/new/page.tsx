"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/lib/tenant-context";
import { createAgent } from "@/lib/api";

const MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Fast and capable' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most intelligent' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI flagship' },
];

export default function NewAgentPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!tenant) {
      setError("Workspace not loaded");
      return;
    }
    
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const systemPrompt = formData.get("systemPrompt") as string;

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }
      
      await createAgent(token, {
        tenantId: tenant.id,
        name,
        model: selectedModel,
        systemPrompt: systemPrompt || undefined,
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
        <p className="text-slate-400 mt-1">Configure your new AI agent</p>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Agent Details</CardTitle>
          <CardDescription className="text-slate-400">
            Give your agent a name and personality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="My Assistant"
                required
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Model</Label>
              <div className="grid gap-3">
                {MODELS.map((model) => (
                  <label
                    key={model.id}
                    className={`flex items-center p-4 rounded-lg border cursor-pointer transition ${
                      selectedModel === model.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="model"
                      value={model.id}
                      checked={selectedModel === model.id}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="sr-only"
                    />
                    <div>
                      <p className="font-medium text-white">{model.name}</p>
                      <p className="text-sm text-slate-400">{model.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt" className="text-white">System Prompt</Label>
              <textarea
                id="systemPrompt"
                name="systemPrompt"
                placeholder="You are a helpful assistant..."
                rows={4}
                className="w-full rounded-md bg-slate-700 border border-slate-600 text-white p-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400">
                Define your agent's personality and capabilities (optional)
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
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
        </CardContent>
      </Card>
    </div>
  );
}
