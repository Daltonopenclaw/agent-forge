const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    throw new Error(error.error || 'Request failed');
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

// Agent APIs
export async function getAgents(token: string, tenantId: string) {
  return apiClient(`/api/agents?tenantId=${tenantId}`, {
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
