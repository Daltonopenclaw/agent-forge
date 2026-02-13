/**
 * Neon API service for provisioning tenant databases
 * https://api-docs.neon.tech/reference/getting-started-with-neon-api
 */

const NEON_API_URL = 'https://console.neon.tech/api/v2';

interface NeonProject {
  id: string;
  name: string;
  connection_uris: Array<{
    connection_uri: string;
  }>;
}

export async function provisionTenantDB(tenantSlug: string): Promise<string> {
  const apiKey = process.env.NEON_API_KEY;
  
  if (!apiKey) {
    throw new Error('NEON_API_KEY not configured');
  }

  // Create a new Neon project for this tenant
  const response = await fetch(`${NEON_API_URL}/projects`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project: {
        name: `myintell-${tenantSlug}`,
        region_id: 'aws-us-east-1', // TODO: Make configurable
        pg_version: 16,
        autoscaling_limit_min_cu: 0.25,
        autoscaling_limit_max_cu: 2,
        suspend_timeout_seconds: 300, // Auto-pause after 5 min idle
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Neon API error:', error);
    throw new Error(`Failed to create Neon project: ${response.status}`);
  }

  const data = await response.json();
  const project: NeonProject = data.project;
  
  // Get the connection URI
  const connectionUri = data.connection_uris?.[0]?.connection_uri;
  
  if (!connectionUri) {
    throw new Error('No connection URI returned from Neon');
  }

  return connectionUri;
}

export async function deprovisionTenantDB(projectId: string): Promise<void> {
  const apiKey = process.env.NEON_API_KEY;
  
  if (!apiKey) {
    throw new Error('NEON_API_KEY not configured');
  }

  const response = await fetch(`${NEON_API_URL}/projects/${projectId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Neon API error:', error);
    throw new Error(`Failed to delete Neon project: ${response.status}`);
  }
}
