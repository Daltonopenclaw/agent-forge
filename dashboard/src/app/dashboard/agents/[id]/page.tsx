'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { AgentChat } from '@/components/AgentChat';

interface Agent {
  id: string;
  name: string;
  avatar: string;
  status: string;
  subdomain: string;
  model: string;
  channels: {
    telegram?: { enabled: boolean; botUsername?: string };
    webchat?: { enabled: boolean };
  };
  createdAt: string;
}

type Tab = 'chat' | 'overview' | 'channels' | 'settings';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  useEffect(() => {
    loadAgent();
  }, [params.id]);

  async function loadAgent() {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAgent(await res.json());
      }
    } catch (error) {
      console.error('Failed to load agent:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Agent not found</p>
        <button
          onClick={() => router.push('/dashboard/agents')}
          className="mt-4 text-blue-400 hover:text-blue-300"
        >
          ← Back to agents
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push('/dashboard/agents')}
          className="text-gray-400 hover:text-white"
        >
          ←
        </button>
        <div className="text-4xl">{agent.avatar}</div>
        <div>
          <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
          <p className="text-gray-400 text-sm">
            {agent.subdomain}.myintell.ai •{' '}
            <span className={agent.status === 'running' ? 'text-green-400' : 'text-yellow-400'}>
              {agent.status}
            </span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700 mb-6">
        <nav className="flex gap-6">
          {(['chat', 'overview', 'channels', 'settings'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' && agent.status === 'running' && (
        <AgentChat agentId={agent.id} agentName={agent.name} agentAvatar={agent.avatar} />
      )}
      {activeTab === 'chat' && agent.status !== 'running' && (
        <div className="bg-gray-800/50 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">
            {agent.status === 'provisioning' 
              ? 'Agent is still provisioning...' 
              : 'Agent is not running. Click Wake to start it.'}
          </p>
        </div>
      )}
      {activeTab === 'overview' && <OverviewTab agent={agent} />}
      {activeTab === 'channels' && <ChannelsTab agent={agent} onUpdate={loadAgent} />}
      {activeTab === 'settings' && <SettingsTab agent={agent} />}
    </div>
  );
}

function OverviewTab({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">Agent Info</h3>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-gray-400 text-sm">Model</dt>
            <dd className="text-white">{agent.model || 'Claude Sonnet'}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-sm">Created</dt>
            <dd className="text-white">{new Date(agent.createdAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-sm">Gateway URL</dt>
            <dd className="text-white font-mono text-sm">
              https://{agent.subdomain}.myintell.ai
            </dd>
          </div>
          <div>
            <dt className="text-gray-400 text-sm">Status</dt>
            <dd className={agent.status === 'running' ? 'text-green-400' : 'text-yellow-400'}>
              {agent.status}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">Quick Actions</h3>
        <div className="flex gap-3">
          <a
            href={`https://${agent.subdomain}.myintell.ai`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Open Control Panel →
          </a>
        </div>
      </div>
    </div>
  );
}

function ChannelsTab({ agent, onUpdate }: { agent: Agent; onUpdate: () => void }) {
  const { getToken } = useAuth();
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const telegramEnabled = agent.channels?.telegram?.enabled;

  async function connectTelegram() {
    if (!telegramToken.trim()) {
      setError('Please enter your bot token');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/${agent.id}/channels/telegram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ botToken: telegramToken }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to connect Telegram');
      }

      setShowTelegramSetup(false);
      setTelegramToken('');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setSaving(false);
    }
  }

  async function disconnectTelegram() {
    if (!confirm('Disconnect Telegram? Your agent will stop receiving messages.')) return;

    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/${agent.id}/channels/telegram`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      onUpdate();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  }

  return (
    <div className="space-y-4">
      {/* Telegram */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0088cc] rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-white font-medium">Telegram</h3>
              <p className="text-gray-400 text-sm">
                {telegramEnabled
                  ? `Connected as @${agent.channels?.telegram?.botUsername || 'bot'}`
                  : 'Message your agent via Telegram'}
              </p>
            </div>
          </div>
          {telegramEnabled ? (
            <button
              onClick={disconnectTelegram}
              className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => setShowTelegramSetup(true)}
              className="px-4 py-2 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-lg transition-colors"
            >
              Connect
            </button>
          )}
        </div>

        {showTelegramSetup && !telegramEnabled && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
              <h4 className="text-white font-medium mb-2">Setup Instructions</h4>
              <ol className="text-gray-300 text-sm space-y-2 list-decimal list-inside">
                <li>Open Telegram and search for <span className="font-mono text-blue-400">@BotFather</span></li>
                <li>Send <span className="font-mono text-blue-400">/newbot</span> and follow the prompts</li>
                <li>Copy the bot token (looks like <span className="font-mono text-xs">123456789:ABCdefGHI...</span>)</li>
                <li>Paste it below and click Connect</li>
              </ol>
            </div>

            <div className="space-y-3">
              <input
                type="password"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="Paste your bot token here"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={connectTelegram}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {saving ? 'Connecting...' : 'Connect Telegram'}
                </button>
                <button
                  onClick={() => {
                    setShowTelegramSetup(false);
                    setTelegramToken('');
                    setError('');
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Coming Soon */}
      <div className="bg-gray-800/30 rounded-lg p-6 opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
            <span className="text-xl">💬</span>
          </div>
          <div>
            <h3 className="text-white font-medium">SMS</h3>
            <p className="text-gray-400 text-sm">Coming soon — Text your agent from any phone</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800/30 rounded-lg p-6 opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-xl">🎙️</span>
          </div>
          <div>
            <h3 className="text-white font-medium">Voice</h3>
            <p className="text-gray-400 text-sm">Coming soon — Talk to your agent with TTS/STT</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ agent }: { agent: Agent }) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete "${agent.name}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/${agent.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push('/dashboard/agents');
      } else {
        alert('Failed to delete agent');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete agent');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">Danger Zone</h3>
        <p className="text-gray-400 text-sm mb-4">
          Deleting your agent will permanently remove all data and conversations.
        </p>
        <button 
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded-lg transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete Agent'}
        </button>
      </div>
    </div>
  );
}
