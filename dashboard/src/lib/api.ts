const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.myintell.ai';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiClient(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(error.error || 'Request failed', res.status);
  }

  return res.json();
}

// Tenant APIs
export async function getTenants(token: string) {
  return apiClient('/api/tenants', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createTenant(token: string, data: { name: string; slug: string }) {
  return apiClient('/api/tenants', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function getOrCreateTenant(token: string, userId: string) {
  // Try to get existing tenants
  const { tenants } = await getTenants(token);
  
  if (tenants && tenants.length > 0) {
    return tenants[0]; // Return first tenant
  }
  
  // Create a default tenant for new users
  const slug = `user-${userId.slice(0, 8).toLowerCase()}`;
  const { tenant } = await createTenant(token, {
    name: 'My Workspace',
    slug,
  });
  
  return tenant;
}

// Agent APIs
export async function getAgents(token: string, tenantId: string) {
  return apiClient(`/api/agents?tenantId=${tenantId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAgent(token: string, agentId: string) {
  return apiClient(`/api/agents/${agentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createAgent(token: string, data: {
  tenantId: string;
  name: string;
  model?: string;
  systemPrompt?: string;
}) {
  return apiClient('/api/agents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function wakeAgent(token: string, agentId: string) {
  return apiClient(`/api/agents/${agentId}/wake`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteAgent(token: string, agentId: string) {
  return apiClient(`/api/agents/${agentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  status: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  tenantId: string;
  name: string;
  model: string;
  systemPrompt: string;
  status: 'idle' | 'running' | 'error' | 'deleted';
  lastActiveAt: string | null;
  createdAt: string;
}
