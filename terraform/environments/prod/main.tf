# Agent Forge - Production Environment
# Main Terraform configuration

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state storage (uncomment and configure for production)
  # backend "s3" {
  #   bucket         = "agent-forge-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock"
  # }
}

# ============================================================================
# PROVIDERS
# ============================================================================

provider "hcloud" {
  token = var.hetzner_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Kubernetes provider - configured after cluster is created
provider "kubernetes" {
  host                   = "https://${module.k3s_cluster.master_public_ip}:6443"
  cluster_ca_certificate = file(var.kubeconfig_ca_cert_path)
  token                  = var.k3s_token

  # Alternative: use kubeconfig file
  # config_path = "~/.kube/agent-forge.yaml"
}

provider "helm" {
  kubernetes {
    host                   = "https://${module.k3s_cluster.master_public_ip}:6443"
    cluster_ca_certificate = file(var.kubeconfig_ca_cert_path)
    token                  = var.k3s_token
  }
}

# ============================================================================
# K3S CLUSTER
# ============================================================================

module "k3s_cluster" {
  source = "../../modules/k3s-cluster"

  cluster_name         = var.cluster_name
  hetzner_location     = var.hetzner_location
  master_server_type   = var.master_server_type
  worker_server_type   = var.worker_server_type
  worker_count         = var.worker_count
  ssh_public_key       = var.ssh_public_key
  k3s_version          = var.k3s_version
  allowed_ssh_ips      = var.allowed_ssh_ips
  cloudflare_api_token = var.cloudflare_api_token
  domain               = var.domain
}

# ============================================================================
# PLATFORM SERVICES
# ============================================================================

module "platform_services" {
  source = "../../modules/platform-services"

  cluster_name          = var.cluster_name
  domain                = var.domain
  platform_image        = var.platform_image
  dashboard_image       = var.dashboard_image
  enable_monitoring     = var.enable_monitoring
  postgres_password     = var.postgres_password
  jwt_secret            = var.jwt_secret
  stripe_secret_key     = var.stripe_secret_key
  stripe_webhook_secret = var.stripe_webhook_secret
  neon_api_key          = var.neon_api_key
  neon_project_id       = var.neon_project_id
  openai_api_key        = var.openai_api_key
  anthropic_api_key     = var.anthropic_api_key
  admin_email           = var.admin_email

  depends_on = [module.k3s_cluster]
}

# ============================================================================
# EXAMPLE TENANTS (for testing)
# ============================================================================

# Uncomment to create test tenants

# module "tenant_demo" {
#   source = "../../modules/tenant"
#
#   tenant_name         = "demo"
#   tenant_display_name = "Demo Tenant"
#   domain              = var.domain
#   cloudflare_zone_id  = module.k3s_cluster.cloudflare_zone_id
#   load_balancer_ip    = module.k3s_cluster.load_balancer_ip
#   tenant_tier         = "pro"
#   database_type       = "neon"
#   neon_api_key        = var.neon_api_key
#   neon_project_id     = var.neon_project_id
#   scale_to_zero       = true
#
#   depends_on = [module.platform_services]
# }

# ============================================================================
# OUTPUTS
# ============================================================================

output "cluster_info" {
  description = "K3s cluster information"
  value = {
    name               = module.k3s_cluster.cluster_name
    master_ip          = module.k3s_cluster.master_public_ip
    load_balancer_ip   = module.k3s_cluster.load_balancer_ip
    worker_ips         = module.k3s_cluster.worker_public_ips
    kubeconfig_command = module.k3s_cluster.kubeconfig_command
  }
}

output "platform_urls" {
  description = "Platform service URLs"
  value = {
    dashboard = module.platform_services.platform_url
    api       = module.platform_services.api_url
    grafana   = module.platform_services.grafana_url
  }
}

output "next_steps" {
  description = "Next steps after deployment"
  value       = <<-EOT
    
    ============================================================
    Agent Forge Platform Deployed Successfully!
    ============================================================
    
    1. Get kubeconfig:
       ${module.k3s_cluster.kubeconfig_command}
    
    2. Verify cluster:
       export KUBECONFIG=~/.kube/agent-forge.yaml
       kubectl get nodes
       kubectl get pods -A
    
    3. Access platform:
       Dashboard: ${module.platform_services.platform_url}
       API:       ${module.platform_services.api_url}
       Grafana:   ${module.platform_services.grafana_url}
    
    4. Create a tenant:
       cd terraform/environments/prod
       terraform apply -target=module.tenant_demo
    
    ============================================================
  EOT
}
