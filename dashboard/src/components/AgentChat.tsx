'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AgentChatProps {
  agentId: string;
  agentName: string;
  agentAvatar: string;
}

export function AgentChat({ agentId, agentName, agentAvatar }: AgentChatProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentStreamRef = useRef<string>('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setConnecting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        setError('Not authenticated');
        setConnecting(false);
        return;
      }

      const wsUrl = `${process.env.NEXT_PUBLIC_API_URL?.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/agent?agentId=${agentId}&token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket open, waiting for proxy connection...');
        // Don't set connected yet - wait for the 'connected' message from proxy
      };

      ws.onmessage = async (event) => {
        try {
          // Handle both text and Blob data
          let rawData = event.data;
          if (rawData instanceof Blob) {
            rawData = await rawData.text();
          }
          
          const data = JSON.parse(rawData);
          console.log('Received:', data.type, data);
          
          // Handle connection confirmation from proxy
          if (data.type === 'connected') {
            console.log('Connected to agent via proxy');
            setConnected(true);
            setConnecting(false);
            setError(null);
            return;
          }
          
          // Handle streaming chunks
          if (data.type === 'chunk') {
            const content = data.payload?.delta?.text || data.payload?.text || '';
            if (content) {
              setStreaming(true);
              currentStreamRef.current += content;
              
              setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg?.role === 'assistant' && streaming) {
                  // Update existing streaming message
                  return [
                    ...prev.slice(0, -1),
                    { ...lastMsg, content: currentStreamRef.current }
                  ];
                }
                // Start new streaming message
                return [...prev, {
                  id: Date.now().toString(),
                  role: 'assistant' as const,
                  content: currentStreamRef.current,
                  timestamp: new Date(),
                }];
              });
            }
            return;
          }
          
          // Handle complete message
          if (data.type === 'message') {
            const content = data.payload?.content || data.payload?.text || '';
            if (content) {
              setStreaming(false);
              currentStreamRef.current = '';
              
              setMessages(prev => {
                // If we were streaming, the last message should be updated
                const lastMsg = prev[prev.length - 1];
                if (lastMsg?.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    { ...lastMsg, content }
                  ];
                }
                // Otherwise add new message
                return [...prev, {
                  id: data.payload?.id || Date.now().toString(),
                  role: 'assistant' as const,
                  content,
                  timestamp: new Date(),
                }];
              });
            }
            return;
          }
          
          // Handle done event
          if (data.type === 'done') {
            setStreaming(false);
            currentStreamRef.current = '';
            return;
          }
          
          // Handle errors
          if (data.type === 'error') {
            console.error('Agent error:', data);
            setError(data.error || data.payload?.message || 'Agent error');
            setStreaming(false);
            currentStreamRef.current = '';
            return;
          }
          
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('Connection error');
        setConnecting(false);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnected(false);
        setConnecting(false);
        setStreaming(false);
        currentStreamRef.current = '';
        wsRef.current = null;

        // Auto-reconnect after 3 seconds if not intentional close
        if (event.code !== 1000) {
          setError('Disconnected. Reconnecting...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

    } catch (err) {
      console.error('Connection failed:', err);
      setError('Failed to connect');
      setConnecting(false);
    }
  }, [agentId, getToken, streaming]);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000);
      }
    };
  }, [connect]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !connected) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Send simplified message format - proxy will convert to OpenClaw format
    wsRef.current.send(JSON.stringify({
      type: 'message',
      content: input.trim(),
    }));

    setInput('');
  };

  return (
    <div className="flex flex-col h-[600px] bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="text-2xl">{agentAvatar}</div>
        <div className="flex-1">
          <h3 className="text-white font-medium">{agentName}</h3>
          <p className={`text-xs ${connected ? 'text-green-400' : connecting ? 'text-yellow-400' : 'text-gray-400'}`}>
            {connecting ? 'Connecting...' : connected ? 'Connected' : 'Disconnected'}
          </p>
        </div>
        {!connected && !connecting && (
          <button
            onClick={connect}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded"
          >
            Reconnect
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="text-center text-red-400 text-sm py-2">
            {error}
          </div>
        )}
        
        {messages.length === 0 && connected && (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg mb-2">👋 Say hello to {agentName}!</p>
            <p className="text-sm">Start a conversation below.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                {msg.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        
        {streaming && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg px-4 py-2">
              <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={connected ? `Message ${agentName}...` : 'Connecting...'}
            disabled={!connected || streaming}
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!connected || !input.trim() || streaming}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
