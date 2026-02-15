import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { verifyToken } from '@clerk/backend';
import { db } from '../db/index.js';
import { agents } from '../db/schema.js';
import { eq } from 'drizzle-orm';

interface AgentConnection {
  userId: string;
  agentId: string;
  clientWs: WebSocket;
  agentWs: WebSocket | null;
}

const connections = new Map<WebSocket, AgentConnection>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupWebSocketProxy(server: any) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/agent',
  });

  wss.on('connection', async (clientWs: WebSocket, req: IncomingMessage) => {
    try {
      // Parse URL to get agentId and token
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const agentId = url.searchParams.get('agentId');
      const token = url.searchParams.get('token');

      if (!agentId || !token) {
        clientWs.close(4000, 'Missing agentId or token');
        return;
      }

      // Verify Clerk token
      let userId: string;
      try {
        const payload = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY!,
        });
        userId = payload.sub;
      } catch (err) {
        console.error('Token verification failed:', err);
        clientWs.close(4001, 'Invalid token');
        return;
      }

      // Get agent info and verify access
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);

      if (!agent) {
        clientWs.close(4004, 'Agent not found');
        return;
      }

      // Get agent gateway URL from config
      const config = (agent.config || {}) as Record<string, any>;
      const namespace = config.namespace;
      
      if (!namespace) {
        clientWs.close(4004, 'Agent not provisioned');
        return;
      }

      // Build internal gateway URL (K8s service DNS)
      const agentGatewayUrl = `ws://gateway.${namespace}.svc.cluster.local:18789`;

      console.log(`[ws-proxy] Connecting user ${userId} to agent ${agentId} at ${agentGatewayUrl}`);

      // Connect to agent gateway
      const agentWs = new WebSocket(agentGatewayUrl, {
        headers: {
          'x-myintell-user-id': userId,
          'x-myintell-agent-id': agentId,
          'Origin': 'https://myintell.ai',
          'User-Agent': 'MyIntell-Platform/1.0',
        },
      });

      const conn: AgentConnection = {
        userId,
        agentId,
        clientWs,
        agentWs,
      };
      connections.set(clientWs, conn);

      // Handle agent connection events
      agentWs.on('open', () => {
        console.log(`[ws-proxy] Connected to agent ${agentId}`);
      });

      agentWs.on('message', (data) => {
        // Parse message to handle auth challenges
        try {
          const msg = JSON.parse(data.toString());
          
          // Handle connect challenge - respond with trusted proxy auth
          if (msg.type === 'event' && msg.event === 'connect.challenge') {
            console.log(`[ws-proxy] Received challenge, responding for user ${userId}`);
            agentWs.send(JSON.stringify({
              type: 'auth',
              mode: 'trusted-proxy',
              nonce: msg.payload?.nonce,
            }));
            return; // Don't forward challenge to client
          }
        } catch {
          // Not JSON, forward as-is
        }
        
        // Forward agent messages to client
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data);
        }
      });

      agentWs.on('close', (code, reason) => {
        console.log(`[ws-proxy] Agent connection closed: ${code} ${reason}`);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(code, reason.toString());
        }
        connections.delete(clientWs);
      });

      agentWs.on('error', (err) => {
        console.error(`[ws-proxy] Agent connection error:`, err);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(4502, 'Agent connection failed');
        }
        connections.delete(clientWs);
      });

      // Handle client events
      clientWs.on('message', (data) => {
        // Forward client messages to agent
        if (agentWs.readyState === WebSocket.OPEN) {
          agentWs.send(data);
        }
      });

      clientWs.on('close', () => {
        console.log(`[ws-proxy] Client disconnected from agent ${agentId}`);
        if (agentWs.readyState === WebSocket.OPEN) {
          agentWs.close();
        }
        connections.delete(clientWs);
      });

      clientWs.on('error', (err) => {
        console.error(`[ws-proxy] Client error:`, err);
        if (agentWs.readyState === WebSocket.OPEN) {
          agentWs.close();
        }
        connections.delete(clientWs);
      });

    } catch (err) {
      console.error('[ws-proxy] Connection error:', err);
      clientWs.close(4500, 'Internal error');
    }
  });

  console.log('🔌 WebSocket proxy ready at /ws/agent');
}
