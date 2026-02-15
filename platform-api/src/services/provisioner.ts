import * as k8s from '@kubernetes/client-node';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ingressManager } from './ingress.js';

// Types for agent provisioning
export interface AgentConfig {
  agentId: string;
  tenantId: string;
  name: string;
  avatar: string;
  personalityType: string;
  soulContent: string;
  agentsContent: string;
  modelTier: 'smart' | 'powerful' | 'fast';
  byokProvider?: 'anthropic' | 'openai';
  byokApiKey?: string;
}

export interface ProvisioningStatus {
  stage: 'namespace' | 'pvc' | 'config' | 'secrets' | 'deployment' | 'health' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

// Model tier to actual model mapping
const MODEL_MAP = {
  smart: 'claude-sonnet-4-20250514',
  powerful: 'claude-opus-4-20250514',
  fast: 'claude-3-5-haiku-20241022',
};

export class AgentProvisioner {
  private kc: k8s.KubeConfig;
  private coreApi: k8s.CoreV1Api;
  private appsApi: k8s.AppsV1Api;
  private networkApi: k8s.NetworkingV1Api;
  private rbacApi: k8s.RbacAuthorizationV1Api;

  constructor() {
    this.kc = new k8s.KubeConfig();
    
    // Load kubeconfig - in production, use in-cluster config
    if (process.env.KUBECONFIG) {
      this.kc.loadFromFile(process.env.KUBECONFIG);
    } else if (process.env.KUBERNETES_SERVICE_HOST) {
      this.kc.loadFromCluster();
    } else {
      // Fallback to default location
      this.kc.loadFromFile(join(process.env.HOME || '/root', '.kube/myintell.yaml'));
    }

    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.networkApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
    this.rbacApi = this.kc.makeApiClient(k8s.RbacAuthorizationV1Api);
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40);
  }

  async provision(
    config: AgentConfig,
    onProgress: (status: ProvisioningStatus) => void
  ): Promise<{ namespace: string; gatewayUrl: string }> {
    const namespace = `agent-${this.slugify(config.name)}-${config.agentId.substring(0, 8)}`;
    
    try {
      // Stage 1: Create namespace
      onProgress({ stage: 'namespace', progress: 10, message: 'Creating secure environment...' });
      await this.createNamespace(namespace, config);

      // Stage 2: Create PVC
      onProgress({ stage: 'pvc', progress: 25, message: 'Allocating storage...' });
      await this.createPVC(namespace);

      // Stage 3: Create config files
      onProgress({ stage: 'config', progress: 40, message: 'Configuring personality...' });
      await this.createConfigMap(namespace, config);

      // Stage 4: Create secrets
      onProgress({ stage: 'secrets', progress: 55, message: 'Setting up credentials...' });
      await this.createSecrets(namespace, config);

      // Stage 5: Create deployment
      onProgress({ stage: 'deployment', progress: 70, message: 'Starting agent runtime...' });
      await this.createDeployment(namespace, config);
      await this.createService(namespace);
      await this.createNetworkPolicy(namespace);

      // Stage 6: Wait for health
      onProgress({ stage: 'health', progress: 85, message: 'Waiting for agent to be ready...' });
      await this.waitForReady(namespace);

      // Stage 7: Create IngressRoute for external access
      onProgress({ stage: 'health', progress: 95, message: 'Setting up external access...' });
      const agentSlug = this.slugify(config.name) + '-' + config.agentId.substring(0, 8);
      await ingressManager.createAgentIngress(namespace, agentSlug);

      onProgress({ stage: 'complete', progress: 100, message: 'Agent is ready!' });

      return {
        namespace,
        gatewayUrl: `https://agent-${agentSlug}.myintell.ai`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      onProgress({ stage: 'error', progress: 0, message: 'Provisioning failed', error: message });
      
      // Attempt cleanup on failure
      try {
        await this.deprovision(namespace);
      } catch {
        // Ignore cleanup errors
      }
      
      throw error;
    }
  }

  async deprovision(namespace: string): Promise<void> {
    try {
      // Delete IngressRoute first
      await ingressManager.deleteAgentIngress(namespace);
    } catch (error) {
      console.log(`Cleanup: IngressRoute for ${namespace} may not exist`);
    }

    try {
      await this.coreApi.deleteNamespace({ name: namespace });
    } catch (error) {
      // Namespace might not exist
      console.log(`Cleanup: namespace ${namespace} may not exist`);
    }
  }

  private async createNamespace(namespace: string, config: AgentConfig): Promise<void> {
    const ns: k8s.V1Namespace = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: namespace,
        labels: {
          'app.kubernetes.io/name': 'myintell-agent',
          'app.kubernetes.io/instance': config.agentId,
          'myintell.ai/tenant': config.tenantId,
          'myintell.ai/agent': config.agentId,
        },
      },
    };

    await this.coreApi.createNamespace({ body: ns });

    // Create ResourceQuota
    const quota: k8s.V1ResourceQuota = {
      apiVersion: 'v1',
      kind: 'ResourceQuota',
      metadata: {
        name: 'agent-quota',
        namespace,
      },
      spec: {
        hard: {
          'pods': '10',
          'requests.cpu': '4',
          'requests.memory': '4Gi',
          'limits.cpu': '8',
          'limits.memory': '8Gi',
          'persistentvolumeclaims': '2',
          'requests.storage': '5Gi',
        },
      },
    };

    await this.coreApi.createNamespacedResourceQuota({ namespace, body: quota });
  }

  private async createPVC(namespace: string): Promise<void> {
    const pvc: k8s.V1PersistentVolumeClaim = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: 'agent-state',
        namespace,
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: {
          requests: {
            storage: '1Gi',
          },
        },
      },
    };

    await this.coreApi.createNamespacedPersistentVolumeClaim({ namespace, body: pvc });
  }

  private async createConfigMap(namespace: string, config: AgentConfig): Promise<void> {
    // Generate OpenClaw config
    const openclawConfig = this.generateOpenclawConfig(config);
    
    const configMap: k8s.V1ConfigMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'agent-config',
        namespace,
      },
      data: {
        'config.json5': openclawConfig,
        'IDENTITY.md': this.generateIdentityMd(config),
        'SOUL.md': config.soulContent,
        'AGENTS.md': config.agentsContent,
        'USER.md': '# USER.md\n\n_Your agent will fill this in during your first conversation._\n',
        'MEMORY.md': '# MEMORY.md\n\n_Long-term memories will be stored here._\n',
        'TOOLS.md': '# TOOLS.md\n\n_Tool configurations and notes._\n',
        'HEARTBEAT.md': '# HEARTBEAT.md\n\n_Proactive check-in tasks (disabled by default)._\n',
      },
    };

    await this.coreApi.createNamespacedConfigMap({ namespace, body: configMap });
  }

  private generateOpenclawConfig(config: AgentConfig): string {
    const model = MODEL_MAP[config.modelTier];
    
    // Use OpenRouter provider for platform-managed agents (unless BYOK)
    const useOpenRouter = !config.byokApiKey || config.byokProvider !== 'anthropic';
    const modelConfig = useOpenRouter 
      ? `"openrouter/${model}"` 
      : `"${model}"`;
    
    return `{
  // OpenClaw Gateway Configuration
  // Auto-generated by myintell.ai
  
  agents: {
    defaults: {
      model: {
        primary: ${modelConfig},
      },
      bootstrapMaxChars: 8000,
      bootstrapTotalMaxChars: 16000,
    },
  },
  
  gateway: {
    auth: {
      mode: "trusted-proxy",
      trustedProxy: {
        userHeader: "x-myintell-user-id",
      },
    },
    trustedProxies: ["10.0.0.0/8", "172.16.0.0/12"],
  },
  
  channels: {
    webchat: {
      enabled: true,
    },
  },
  
  memory: {
    search: {
      enabled: true,
      provider: "auto",
    },
  },
  
  tools: {
    web: {
      search: {
        enabled: true,
      },
      fetch: {
        enabled: true,
      },
    },
  },
  
  heartbeat: {
    enabled: false,
  },
}`;
  }

  private generateIdentityMd(config: AgentConfig): string {
    return `# IDENTITY.md

- **Name:** ${config.name}
- **Avatar:** ${config.avatar}
- **Created:** ${new Date().toISOString().split('T')[0]}

---

_This is ${config.name}, powered by myintell.ai_
`;
  }

  private async createSecrets(namespace: string, config: AgentConfig): Promise<void> {
    // Determine which API key to use
    // Platform uses OpenRouter for Claude models by default
    let openrouterKey = process.env.OPENROUTER_API_KEY || '';
    let openaiKey = process.env.OPENAI_API_KEY || '';
    
    // BYOK overrides platform keys
    if (config.byokApiKey) {
      if (config.byokProvider === 'anthropic') {
        // If user provides their own Anthropic key, use it directly
        openrouterKey = ''; // Clear OpenRouter, we'll set ANTHROPIC_API_KEY
      } else if (config.byokProvider === 'openai') {
        openaiKey = config.byokApiKey;
      }
    }

    const stringData: Record<string, string> = {
      OPENAI_API_KEY: openaiKey,
    };

    // Use OpenRouter for platform-managed Claude, or direct Anthropic for BYOK
    if (config.byokApiKey && config.byokProvider === 'anthropic') {
      stringData.ANTHROPIC_API_KEY = config.byokApiKey;
    } else if (openrouterKey) {
      stringData.OPENROUTER_API_KEY = openrouterKey;
    }

    const secret: k8s.V1Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'agent-credentials',
        namespace,
      },
      type: 'Opaque',
      stringData,
    };

    await this.coreApi.createNamespacedSecret({ namespace, body: secret });
  }

  private async createDeployment(namespace: string, config: AgentConfig): Promise<void> {
    const deployment: k8s.V1Deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'gateway',
        namespace,
        labels: {
          app: 'gateway',
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'gateway',
          },
        },
        template: {
          metadata: {
            labels: {
              app: 'gateway',
            },
          },
          spec: {
            containers: [
              {
                name: 'openclaw',
                image: 'ghcr.io/openclaw/openclaw:latest',
                ports: [
                  { containerPort: 4444 },
                ],
                env: [
                  { name: 'OPENCLAW_STATE_DIR', value: '/state' },
                  { name: 'OPENCLAW_WORKSPACE', value: '/state/workspace' },
                ],
                envFrom: [
                  { secretRef: { name: 'agent-credentials' } },
                ],
                volumeMounts: [
                  { name: 'state', mountPath: '/state' },
                  { name: 'config', mountPath: '/state/workspace', subPath: 'workspace' },
                ],
                resources: {
                  requests: {
                    memory: '512Mi',
                    cpu: '100m',
                  },
                  limits: {
                    memory: '1Gi',
                    cpu: '1000m',
                  },
                },
                livenessProbe: {
                  httpGet: {
                    path: '/health',
                    port: 4444 as any,
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 30,
                },
                readinessProbe: {
                  httpGet: {
                    path: '/health',
                    port: 4444 as any,
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                },
              },
            ],
            volumes: [
              {
                name: 'state',
                persistentVolumeClaim: {
                  claimName: 'agent-state',
                },
              },
              {
                name: 'config',
                configMap: {
                  name: 'agent-config',
                },
              },
            ],
          },
        },
      },
    };

    await this.appsApi.createNamespacedDeployment({ namespace, body: deployment });
  }

  private async createService(namespace: string): Promise<void> {
    const service: k8s.V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'gateway',
        namespace,
      },
      spec: {
        selector: {
          app: 'gateway',
        },
        ports: [
          { port: 4444, targetPort: 4444 as any },
        ],
        type: 'ClusterIP',
      },
    };

    await this.coreApi.createNamespacedService({ namespace, body: service });
  }

  private async createNetworkPolicy(namespace: string): Promise<void> {
    // Default deny all
    const denyAll: k8s.V1NetworkPolicy = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: 'default-deny',
        namespace,
      },
      spec: {
        podSelector: {},
        policyTypes: ['Ingress', 'Egress'],
      },
    };

    await this.networkApi.createNamespacedNetworkPolicy({ namespace, body: denyAll });

    // Allow gateway to reach internet (for LLM APIs)
    const allowEgress: k8s.V1NetworkPolicy = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: 'allow-gateway-egress',
        namespace,
      },
      spec: {
        podSelector: {
          matchLabels: {
            app: 'gateway',
          },
        },
        policyTypes: ['Egress'],
        egress: [{}], // Allow all egress
      },
    };

    await this.networkApi.createNamespacedNetworkPolicy({ namespace, body: allowEgress });

    // Allow ingress from platform namespace
    const allowIngress: k8s.V1NetworkPolicy = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: 'allow-platform-ingress',
        namespace,
      },
      spec: {
        podSelector: {
          matchLabels: {
            app: 'gateway',
          },
        },
        policyTypes: ['Ingress'],
        ingress: [
          {
            _from: [
              {
                namespaceSelector: {
                  matchLabels: {
                    'app.kubernetes.io/name': 'myintell',
                  },
                },
              },
            ],
          },
        ],
      },
    };

    await this.networkApi.createNamespacedNetworkPolicy({ namespace, body: allowIngress });
  }

  private async waitForReady(namespace: string, timeoutMs: number = 180000): Promise<void> { // 3 minutes for cold start
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const deployment = await this.appsApi.readNamespacedDeployment({
          name: 'gateway',
          namespace,
        });
        
        const ready = deployment.status?.readyReplicas || 0;
        const desired = deployment.spec?.replicas || 1;
        
        if (ready >= desired) {
          return;
        }
      } catch {
        // Deployment might not exist yet
      }
      
      await new Promise((r) => setTimeout(r, 2000));
    }
    
    throw new Error('Timeout waiting for gateway to be ready');
  }
}

// Singleton instance
export const provisioner = new AgentProvisioner();
