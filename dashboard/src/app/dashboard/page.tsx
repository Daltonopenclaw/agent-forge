"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTenant } from "@/lib/tenant-context";
import { getAgents, Agent } from "@/lib/api";

export default function DashboardPage() {
  const { getToken } = useAuth();
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
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
    }

    if (tenant) {
      fetchAgents();
    }
  }, [tenant, getToken]);

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400">Loading workspace...</div>
      </div>
    );
  }

  if (tenantError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{tenantError}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  const activeAgents = agents.filter(a => a.status === 'running');

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            {tenant?.name || 'My Workspace'}
          </p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button>Create Agent</Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardDescription className="text-slate-400">Total Agents</CardDescription>
            <CardTitle className="text-3xl text-white">{agents.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardDescription className="text-slate-400">Active Now</CardDescription>
            <CardTitle className="text-3xl text-green-400">{activeAgents.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardDescription className="text-slate-400">This Month</CardDescription>
            <CardTitle className="text-3xl text-white">$0.00</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Your Agents</CardTitle>
          <CardDescription className="text-slate-400">
            {agents.length > 0 
              ? `${agents.length} agent${agents.length === 1 ? '' : 's'} in your workspace`
              : 'Create your first agent to get started'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-400">Loading agents...</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">No agents yet</p>
              <Link href="/dashboard/agents/new">
                <Button>Create Your First Agent</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.slice(0, 5).map((agent) => (
                <div 
                  key={agent.id} 
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50"
                >
                  <div>
                    <p className="font-medium text-white">{agent.name}</p>
                    <p className="text-sm text-slate-400">{agent.model}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      agent.status === 'running' 
                        ? 'bg-green-500/20 text-green-400' 
                        : agent.status === 'error'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {agent.status}
                    </span>
                    <Link href={`/dashboard/agents/${agent.id}`}>
                      <Button variant="ghost" size="sm" className="text-slate-300">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {agents.length > 5 && (
                <Link href="/dashboard/agents" className="block text-center">
                  <Button variant="ghost" className="text-slate-400">
                    View all {agents.length} agents →
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
