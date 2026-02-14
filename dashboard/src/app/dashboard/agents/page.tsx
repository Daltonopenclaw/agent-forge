"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTenant } from "@/lib/tenant-context";
import { getAgents, wakeAgent, deleteAgent, Agent } from "@/lib/api";

export default function AgentsPage() {
  const { getToken } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAgents = async () => {
    if (!tenant) return;
    
    try {
      const token = await getToken();
      if (!token) return;
      
      const { agents: fetchedAgents } = await getAgents(token, tenant.id);
      setAgents(fetchedAgents || []);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenant) {
      fetchAgents();
    }
  }, [tenant]);

  const handleWake = async (agentId: string) => {
    setActionLoading(agentId);
    try {
      const token = await getToken();
      if (!token) return;
      
      await wakeAgent(token, agentId);
      await fetchAgents(); // Refresh list
    } catch (err) {
      console.error("Failed to wake agent:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (agentId: string, agentName: string) => {
    if (!confirm(`Are you sure you want to delete "${agentName}"?`)) return;
    
    setActionLoading(agentId);
    try {
      const token = await getToken();
      if (!token) return;
      
      await deleteAgent(token, agentId);
      setAgents(agents.filter(a => a.id !== agentId));
    } catch (err) {
      console.error("Failed to delete agent:", err);
    } finally {
      setActionLoading(null);
    }
  };

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Agents</h1>
          <p className="text-slate-400 mt-1">Create and manage your AI agents</p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button>Create Agent</Button>
        </Link>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">All Agents</CardTitle>
          <CardDescription className="text-slate-400">
            {agents.length} agent{agents.length === 1 ? '' : 's'} in your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-400">Loading agents...</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">No agents yet. Create one to get started!</p>
              <Link href="/dashboard/agents/new">
                <Button>Create Agent</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div 
                  key={agent.id} 
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-white">{agent.name}</p>
                    <p className="text-sm text-slate-400">{agent.model}</p>
                    {agent.systemPrompt && (
                      <p className="text-sm text-slate-500 mt-1 truncate max-w-md">
                        {agent.systemPrompt}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      agent.status === 'running' 
                        ? 'bg-green-500/20 text-green-400' 
                        : agent.status === 'error'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {agent.status}
                    </span>
                    {agent.status === 'idle' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-slate-600 text-slate-300"
                        onClick={() => handleWake(agent.id)}
                        disabled={actionLoading === agent.id}
                      >
                        {actionLoading === agent.id ? 'Waking...' : 'Wake'}
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleDelete(agent.id, agent.name)}
                      disabled={actionLoading === agent.id}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
