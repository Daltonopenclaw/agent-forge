# Agent Forge 🔥

A multi-tenant Agent-as-a-Service (AaaS) platform built on K3s. Deploy AI agents for customers with automated infrastructure provisioning, scale-to-zero economics, and visual QA capabilities.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SHARED PLATFORM (~$30-50/mo)                     │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ K3s      │  │ Traefik  │  │ Cert-    │  │ Platform         │   │
│  │ Cluster  │  │ Ingress  │  │ Manager  │  │ API + Dashboard  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ KEDA     │  │ Sealed   │  │ Postgres │  │ Prometheus +     │   │
│  │ Scaler   │  │ Secrets  │  │ (SQLite) │  │ Grafana          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Tenant: acme    │  │ Tenant: demo    │  │ Tenant: ...     │
│ ~$2-5/mo idle   │  │ ~$2-5/mo idle   │  │                 │
│                 │  │                 │  │                 │
│ • Deployment    │  │ • Deployment    │  │ • Deployment    │
│ • Service       │  │ • Service       │  │ • Service       │
│ • Neon DB       │  │ • Neon DB       │  │ • Neon DB       │
│ • Workspace PVC │  │ • Workspace PVC │  │ • Workspace PVC │
│ • KEDA scaler   │  │ • KEDA scaler   │  │ • KEDA scaler   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Cost Structure

| Component | Monthly Cost |
|-----------|-------------|
| K3s Master (cx22) | ~$4.50 |
| K3s Workers (2x cx32) | ~$18.00 |
| Load Balancer (lb11) | ~$6.00 |
| Platform storage | ~$2.00 |
| **Platform Total** | **~$30-50** |
| Per tenant (idle) | ~$2-5 |
| Per tenant (active) | ~$15-25 |

## Quick Start

### Prerequisites

- [Terraform](https://terraform.io) >= 1.6
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Hetzner Cloud account](https://console.hetzner.cloud/)
- [Cloudflare account](https://cloudflare.com/) (for DNS)
- Domain managed by Cloudflare

### 1. Clone and Configure

```bash
git clone https://github.com/your-org/agent-forge.git
cd agent-forge/terraform/environments/prod

# Copy example config
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
vim terraform.tfvars
```

### 2. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy (takes ~10-15 minutes)
terraform apply
```

### 3. Get Kubeconfig

```bash
# Copy kubeconfig from master node
ssh root@<master-ip> cat /root/kubeconfig-external.yaml > ~/.kube/agent-forge.yaml

# Set as default
export KUBECONFIG=~/.kube/agent-forge.yaml

# Verify cluster
kubectl get nodes
kubectl get pods -A
```

### 4. Access Platform

- **Dashboard**: https://agentforge.dev (or your domain)
- **API**: https://api.agentforge.dev
- **Grafana**: https://grafana.agentforge.dev

## Creating Tenants

### Via Terraform

Add to `terraform/environments/prod/main.tf`:

```hcl
module "tenant_acme" {
  source = "../../modules/tenant"

  tenant_name         = "acme"
  tenant_display_name = "Acme Corp"
  domain              = var.domain
  cloudflare_zone_id  = module.k3s_cluster.cloudflare_zone_id
  load_balancer_ip    = module.k3s_cluster.load_balancer_ip
  tenant_tier         = "pro"
  database_type       = "neon"
  neon_api_key        = var.neon_api_key
  neon_project_id     = var.neon_project_id
  scale_to_zero       = true

  depends_on = [module.platform_services]
}
```

Then apply:

```bash
terraform apply -target=module.tenant_acme
```

### Via API (Coming Soon)

```bash
curl -X POST https://api.agentforge.dev/tenants \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "acme",
    "displayName": "Acme Corp",
    "tier": "pro"
  }'
```

## Project Structure

```
agent_forge/
├── README.md
├── terraform/
│   ├── modules/
│   │   ├── k3s-cluster/       # K3s cluster on Hetzner
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── templates/
│   │   │       ├── master-init.sh
│   │   │       └── worker-init.sh
│   │   ├── platform-services/ # Shared platform components
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   └── tenant/           # Per-tenant resources
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       └── outputs.tf
│   └── environments/
│       ├── prod/
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── terraform.tfvars.example
│       └── staging/
└── docs/
```

## Key Features

### Scale-to-Zero with KEDA

Tenant workloads automatically scale to 0 replicas when idle, reducing costs to just storage:

```yaml
# Automatic scaling based on HTTP traffic
triggers:
  - type: prometheus
    metadata:
      query: sum(rate(http_requests_total{service="tenant-acme"}[2m]))
      threshold: "1"
```

### Header-Based Multi-Tenant Routing

A single ingress serves all tenants using custom headers injected by Cloudflare:

```
Cloudflare adds: X-Tenant-Host: acme
                      │
                      ▼
              Traefik routes to
              acme's backend service
```

### Serverless Databases (Neon)

Each tenant gets an isolated Postgres database that auto-pauses when idle:

- **Idle cost**: $0
- **Active cost**: ~$20/mo
- **Auto-pause**: After 5 minutes of inactivity

### Persistent Agent Workspaces

Each tenant has a persistent volume for agent memory and files:

```yaml
volumes:
  - name: workspace
    persistentVolumeClaim:
      claimName: agent-workspace
```

## Monitoring

Access Grafana at `https://grafana.yourdomain.com`:

- **Cluster health**: Node status, resource usage
- **Tenant metrics**: Request rates, latency, errors
- **Cost tracking**: Resource consumption per tenant

## Security

- **Network isolation**: Each tenant in separate namespace with NetworkPolicy
- **Secrets management**: Sealed Secrets for encrypted secrets in git
- **TLS everywhere**: Automatic certificates via cert-manager + Let's Encrypt
- **Resource quotas**: Per-tenant CPU/memory limits based on tier

## Upgrading

### K3s Version

```bash
# Update k3s_version in terraform.tfvars
k3s_version = "v1.32.0+k3s1"

# Apply changes (rolling update)
terraform apply
```

### Adding Workers

```bash
# Update worker_count in terraform.tfvars
worker_count = 3

# Apply changes
terraform apply
```

## Troubleshooting

### Check cluster status

```bash
kubectl get nodes
kubectl get pods -A
kubectl describe node <node-name>
```

### Check tenant status

```bash
kubectl get all -n tenant-<name>
kubectl logs -n tenant-<name> deployment/backend
```

### Check ingress

```bash
kubectl get ingressroute -A
kubectl logs -n traefik-system -l app.kubernetes.io/name=traefik
```

## Roadmap

- [ ] Platform API for tenant management
- [ ] Web dashboard for customers
- [ ] Agent orchestration layer
- [ ] Visual QA with Playwright
- [ ] Mobile testing with Android emulator
- [ ] Billing integration (Stripe)
- [ ] Custom domain support per tenant

## License

MIT
