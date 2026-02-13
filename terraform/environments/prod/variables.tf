# Agent Forge - Production Environment Variables

# ============================================================================
# REQUIRED VARIABLES
# ============================================================================

variable "hetzner_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with DNS edit permissions"
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "SSH public key for server access"
  type        = string
}

variable "domain" {
  description = "Base domain for the platform (e.g., agentforge.dev)"
  type        = string
}

variable "postgres_password" {
  description = "Password for platform PostgreSQL database"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Secret key for JWT token signing (min 32 chars)"
  type        = string
  sensitive   = true
}

variable "admin_email" {
  description = "Admin email for platform alerts and Let's Encrypt"
  type        = string
}

# ============================================================================
# CLUSTER CONFIGURATION
# ============================================================================

variable "cluster_name" {
  description = "Name of the K3s cluster"
  type        = string
  default     = "agent-forge"
}

variable "hetzner_location" {
  description = "Hetzner datacenter location"
  type        = string
  default     = "ash" # Falkenstein (cheapest)
}

variable "master_server_type" {
  description = "Server type for master node"
  type        = string
  default     = "cx22" # 2 vCPU, 4GB RAM (~$4.50/mo)
}

variable "worker_server_type" {
  description = "Server type for worker nodes"
  type        = string
  default     = "cx32" # 4 vCPU, 8GB RAM (~$9/mo)
}

variable "worker_count" {
  description = "Number of worker nodes"
  type        = number
  default     = 2
}

variable "k3s_version" {
  description = "K3s version to install"
  type        = string
  default     = "v1.31.4+k3s1"
}

variable "allowed_ssh_ips" {
  description = "IPs allowed to SSH to nodes (CIDR notation)"
  type        = list(string)
  default     = [] # Set in terraform.tfvars!
}

# ============================================================================
# KUBERNETES AUTH (populated after cluster creation)
# ============================================================================

variable "kubeconfig_ca_cert_path" {
  description = "Path to Kubernetes CA certificate file"
  type        = string
  default     = "" # Set after cluster creation
}

variable "k3s_token" {
  description = "K3s cluster token for kubectl auth"
  type        = string
  sensitive   = true
  default     = "" # Set after cluster creation
}

# ============================================================================
# PLATFORM SERVICES
# ============================================================================

variable "platform_image" {
  description = "Docker image for platform API"
  type        = string
  default     = "ghcr.io/agent-forge/platform-api:latest"
}

variable "dashboard_image" {
  description = "Docker image for platform dashboard"
  type        = string
  default     = "ghcr.io/agent-forge/dashboard:latest"
}

variable "enable_monitoring" {
  description = "Enable Prometheus + Grafana monitoring"
  type        = bool
  default     = true
}

# ============================================================================
# INTEGRATIONS (Optional)
# ============================================================================

variable "stripe_secret_key" {
  description = "Stripe secret key for billing"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook signing secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "neon_api_key" {
  description = "Neon API key for tenant database provisioning"
  type        = string
  sensitive   = true
  default     = ""
}

variable "neon_project_id" {
  description = "Neon project ID for tenant databases"
  type        = string
  default     = ""
}

variable "openai_api_key" {
  description = "OpenAI API key for agent orchestration"
  type        = string
  sensitive   = true
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude agents"
  type        = string
  sensitive   = true
  default     = ""
}
