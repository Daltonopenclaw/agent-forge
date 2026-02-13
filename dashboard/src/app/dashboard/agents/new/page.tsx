"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewAgentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const systemPrompt = formData.get("systemPrompt") as string;

    try {
      // TODO: Connect to API
      // For now, just redirect
      console.log("Creating agent:", { name, systemPrompt });
      router.push("/dashboard/agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setLoading(false);
    }
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
              <Label htmlFor="systemPrompt" className="text-white">System Prompt</Label>
              <textarea
                id="systemPrompt"
                name="systemPrompt"
                placeholder="You are a helpful assistant..."
                rows={4}
                className="w-full rounded-md bg-slate-700 border-slate-600 text-white p-3 text-sm"
              />
              <p className="text-xs text-slate-400">
                Define your agent's personality and capabilities
              </p>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
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
