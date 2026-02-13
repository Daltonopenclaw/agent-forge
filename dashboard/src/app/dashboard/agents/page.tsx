import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AgentsPage() {
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
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-slate-400 mb-4">No agents yet. Create one to get started!</p>
            <Link href="/dashboard/agents/new">
              <Button>Create Agent</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
