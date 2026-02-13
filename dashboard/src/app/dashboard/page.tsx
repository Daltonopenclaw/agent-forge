import { auth } from "@clerk/nextjs/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DashboardPage() {
  const { userId } = await auth();

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Manage your AI agents</p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button>Create Agent</Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardDescription className="text-slate-400">Total Agents</CardDescription>
            <CardTitle className="text-3xl text-white">0</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardDescription className="text-slate-400">Active Now</CardDescription>
            <CardTitle className="text-3xl text-green-400">0</CardTitle>
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
            Create your first agent to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-slate-400 mb-4">No agents yet</p>
            <Link href="/dashboard/agents/new">
              <Button>Create Your First Agent</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
