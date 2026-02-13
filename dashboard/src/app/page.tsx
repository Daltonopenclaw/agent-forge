import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { userId } = await auth();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-16">
        <nav className="flex justify-between items-center mb-16">
          <h1 className="text-2xl font-bold text-white">MyIntell</h1>
          <div className="space-x-4">
            {userId ? (
              <Link href="/dashboard">
                <Button>Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost" className="text-white">Sign In</Button>
                </Link>
                <Link href="/sign-up">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </nav>

        <div className="text-center py-20">
          <h2 className="text-5xl font-bold text-white mb-6">
            Your <span className="text-blue-400">Superfriends</span>
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            AI agents that work for you 24/7. They remember everything, 
            never sleep, and cost nearly nothing when idle.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="text-lg px-8 py-6">
              Create Your First Agent
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-3">Scale to Zero</h3>
            <p className="text-slate-400">
              Pay only when your agents are active. They hibernate when idle and wake instantly when needed.
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-3">Persistent Memory</h3>
            <p className="text-slate-400">
              Your agents remember everything. Context that persists across conversations and sessions.
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-3">Your Infrastructure</h3>
            <p className="text-slate-400">
              Each agent gets its own isolated environment. Secure, private, and fully customizable.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
