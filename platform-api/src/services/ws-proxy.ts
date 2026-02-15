import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { verifyToken } from '@clerk/backend';
import { db } from '../db/index.js';
import { agents } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const PROTOCOL_VERSION = 3;

interface AgentConnection {
  userId: string;
  agentId: string;
  clientWs: WebSocket;
  agentWs: WebSocket | null;
  connected: boolean;
  pendingMessages: string[];
  requestId: number;
}

const connections = new Map<WebSocket, AgentConnection>();

function generateRequestId(conn: AgentConnection): string {
  return `req-${++conn.requestId}`;
}

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
        connected: false,
        pendingMessages: [],
        requestId: 0,
      };
      connections.set(clientWs, conn);

      // Handle agent connection events
      agentWs.on('open', () => {
        console.log(`[ws-proxy] WebSocket open to agent ${agentId}, sending connect frame`);
        
        // Send the OpenClaw connect frame as first message
        // Valid client.id: webchat, webchat-ui, gateway-client, cli, etc.
        // Valid client.mode: webchat, backend, cli, probe, etc.
        const connectFrame = {
          type: 'req',
          id: generateRequestId(conn),
          method: 'connect',
          params: {
            minProtocol: PROTOCOL_VERSION,
            maxProtocol: PROTOCOL_VERSION,
            client: {
              id: 'webchat',
              version: '1.0.0',
              platform: 'web',
              mode: 'webchat',
              instanceId: randomUUID(),
            },
            // Auth handled via trusted-proxy headers
          },
        };
        
        agentWs.send(JSON.stringify(connectFrame));
      });

      agentWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          
          // Handle connect response
          if (msg.type === 'res' && msg.id && !conn.connected) {
            if (msg.ok) {
              console.log(`[ws-proxy] Connected to agent ${agentId} successfully`);
              conn.connected = true;
              
              // Send any pending messages
              for (const pending of conn.pendingMessages) {
                sendChatMessage(conn, pending);
              }
              conn.pendingMessages = [];
              
              // Notify client they're connected
              clientWs.send(JSON.stringify({
                type: 'connected',
                agentId: agentId,
              }));
            } else {
              console.error(`[ws-proxy] Connect failed:`, msg.error);
              clientWs.close(4003, msg.error?.message || 'Connect failed');
            }
            return;
          }
          
          // Handle chat events from OpenClaw
          if (msg.type === 'event') {
            // Forward relevant events to client in a simplified format
            if (msg.event === 'chat.chunk') {
              clientWs.send(JSON.stringify({
                type: 'chunk',
                payload: msg.payload,
              }));
            } else if (msg.event === 'chat.message') {
              clientWs.send(JSON.stringify({
                type: 'message',
                payload: msg.payload,
              }));
            } else if (msg.event === 'chat.done') {
              clientWs.send(JSON.stringify({
                type: 'done',
                payload: msg.payload,
              }));
            } else if (msg.event === 'chat.error') {
              clientWs.send(JSON.stringify({
                type: 'error',
                payload: msg.payload,
              }));
            }
            return;
          }
          
          // Handle chat.send response
          if (msg.type === 'res') {
            if (!msg.ok) {
              console.error(`[ws-proxy] Request failed:`, msg.error);
              clientWs.send(JSON.stringify({
                type: 'error',
                error: msg.error?.message || 'Request failed',
              }));
            }
            // Success responses for chat.send are handled via events
            return;
          }
          
        } catch {
          // Not JSON or parse error, log and ignore
          console.error(`[ws-proxy] Failed to parse agent message:`, data.toString().substring(0, 200));
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
        try {
          const msg = JSON.parse(data.toString());
          
          // Client sends simple messages, we convert to OpenClaw format
          if (msg.type === 'message' && msg.content) {
            if (conn.connected && conn.agentWs?.readyState === WebSocket.OPEN) {
              sendChatMessage(conn, msg.content);
            } else {
              // Queue message until connected
              conn.pendingMessages.push(msg.content);
            }
          }
        } catch {
          console.error(`[ws-proxy] Failed to parse client message`);
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

function sendChatMessage(conn: AgentConnection, content: string) {
  if (!conn.agentWs || conn.agentWs.readyState !== WebSocket.OPEN) {
    console.error(`[ws-proxy] Cannot send: agent not connected`);
    return;
  }
  
  const chatFrame = {
    type: 'req',
    id: generateRequestId(conn),
    method: 'chat.send',
    params: {
      sessionKey: 'agent:main:main',
      message: content,
      idempotencyKey: randomUUID(),
    },
  };
  
  console.log(`[ws-proxy] Sending chat message to agent ${conn.agentId}`);
  conn.agentWs.send(JSON.stringify(chatFrame));
}
