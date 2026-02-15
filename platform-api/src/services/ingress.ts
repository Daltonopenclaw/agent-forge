import * as k8s from '@kubernetes/client-node';
import { join } from 'path';

/**
 * Service to manage Traefik IngressRoutes for agent gateways
 */
export class IngressManager {
  private kc: k8s.KubeConfig;
  private customApi: k8s.CustomObjectsApi;

  constructor() {
    this.kc = new k8s.KubeConfig();
    
    if (process.env.KUBECONFIG) {
      this.kc.loadFromFile(process.env.KUBECONFIG);
    } else if (process.env.KUBERNETES_SERVICE_HOST) {
      this.kc.loadFromCluster();
    } else {
      this.kc.loadFromFile(join(process.env.HOME || '/root', '.kube/myintell.yaml'));
    }

    this.customApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
  }

  /**
   * Create an IngressRoute for an agent gateway
   * Routes: agent-{slug}.myintell.ai -> gateway service in agent namespace
   */
  async createAgentIngress(
    agentNamespace: string,
    agentSlug: string,
    tlsSecretName: string = 'wildcard-myintell-tls'
  ): Promise<void> {
    const hostname = `agent-${agentSlug}.myintell.ai`;
    
    const ingressRoute = {
      apiVersion: 'traefik.io/v1alpha1',
      kind: 'IngressRoute',
      metadata: {
        name: 'agent-gateway',
        namespace: agentNamespace,
        labels: {
          'app.kubernetes.io/name': 'agent-gateway',
          'myintell.ai/agent': agentSlug,
        },
      },
      spec: {
        entryPoints: ['websecure'],
        routes: [
          {
            match: `Host(\`${hostname}\`)`,
            kind: 'Rule',
            services: [
              {
                name: 'gateway',
                port: 18789,
              },
            ],
            middlewares: [
              {
                name: 'agent-headers',
                namespace: agentNamespace,
              },
            ],
          },
        ],
        tls: {
          secretName: tlsSecretName,
        },
      },
    };

    // Create middleware to add trusted proxy headers
    const middleware = {
      apiVersion: 'traefik.io/v1alpha1',
      kind: 'Middleware',
      metadata: {
        name: 'agent-headers',
        namespace: agentNamespace,
      },
      spec: {
        headers: {
          customRequestHeaders: {
            'X-Forwarded-Proto': 'https',
          },
        },
      },
    };

    // Create middleware first
    try {
      await this.customApi.createNamespacedCustomObject({
        group: 'traefik.io',
        version: 'v1alpha1',
        namespace: agentNamespace,
        plural: 'middlewares',
        body: middleware,
      });
    } catch (error: any) {
      if (error.statusCode !== 409) { // Ignore "already exists"
        throw error;
      }
    }

    // Create IngressRoute
    try {
      await this.customApi.createNamespacedCustomObject({
        group: 'traefik.io',
        version: 'v1alpha1',
        namespace: agentNamespace,
        plural: 'ingressroutes',
        body: ingressRoute,
      });
    } catch (error: any) {
      if (error.statusCode !== 409) {
        throw error;
      }
    }
  }

  /**
   * Delete an agent's IngressRoute
   */
  async deleteAgentIngress(agentNamespace: string): Promise<void> {
    try {
      await this.customApi.deleteNamespacedCustomObject({
        group: 'traefik.io',
        version: 'v1alpha1',
        namespace: agentNamespace,
        plural: 'ingressroutes',
        name: 'agent-gateway',
      });
    } catch (error: any) {
      if (error.statusCode !== 404) {
        throw error;
      }
    }

    try {
      await this.customApi.deleteNamespacedCustomObject({
        group: 'traefik.io',
        version: 'v1alpha1',
        namespace: agentNamespace,
        plural: 'middlewares',
        name: 'agent-headers',
      });
    } catch (error: any) {
      if (error.statusCode !== 404) {
        throw error;
      }
    }
  }
}

export const ingressManager = new IngressManager();
