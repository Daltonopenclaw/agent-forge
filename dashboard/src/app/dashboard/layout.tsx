import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-900">
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-xl font-bold text-white">
              MyIntell
            </Link>
            <div className="hidden md:flex space-x-6">
              <Link href="/dashboard" className="text-slate-300 hover:text-white transition">
                Overview
              </Link>
              <Link href="/dashboard/agents" className="text-slate-300 hover:text-white transition">
                Agents
              </Link>
            </div>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
