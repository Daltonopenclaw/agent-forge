# Tenant Module - Variables
# Provisions a complete tenant environment within the K3s cluster

variable "tenant_name" {
  description = "Unique tenant identifier (used in subdomain)"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.tenant_name))
    error_message = "Tenant name must be lowercase alphanumeric with hyphens, 3-63 characters."
  }
}

variable "tenant_display_name" {
  description = "Human-readable tenant name"
  type        = string
}

variable "domain" {
  description = "Base domain (tenant will get subdomain.domain)"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for DNS"
  type        = string
}

variable "load_balancer_ip" {
  description = "IP of the shared load balancer"
  type        = string
}

variable "container_image" {
  description = "Docker image for tenant backend"
  type        = string
  default     = "ghcr.io/agent-forge/tenant-runtime:latest"
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 3000
}

variable "cpu_request" {
  description = "CPU request for tenant pod"
  type        = string
  default     = "100m"
}

variable "cpu_limit" {
  description = "CPU limit for tenant pod"
  type        = string
  default     = "500m"
}

variable "memory_request" {
  description = "Memory request for tenant pod"
  type        = string
  default     = "256Mi"
}

variable "memory_limit" {
  description = "Memory limit for tenant pod"
  type        = string
  default     = "512Mi"
}

variable "min_replicas" {
  description = "Minimum replicas (0 for scale-to-zero)"
  type        = number
  default     = 0
}

variable "max_replicas" {
  description = "Maximum replicas"
  type        = number
  default     = 3
}

variable "scale_to_zero" {
  description = "Enable scale-to-zero with KEDA"
  type        = bool
  default     = true
}

variable "database_type" {
  description = "Database type: 'neon', 'shared-postgres', or 'none'"
  type        = string
  default     = "neon"

  validation {
    condition     = contains(["neon", "shared-postgres", "none"], var.database_type)
    error_message = "Database type must be 'neon', 'shared-postgres', or 'none'."
  }
}

variable "neon_api_key" {
  description = "Neon API key for database provisioning"
  type        = string
  sensitive   = true
  default     = ""
}

variable "neon_project_id" {
  description = "Neon project ID (shared project for all tenants)"
  type        = string
  default     = ""
}

variable "shared_postgres_host" {
  description = "Shared PostgreSQL host (if using shared-postgres)"
  type        = string
  default     = ""
}

variable "shared_postgres_admin_password" {
  description = "Admin password for shared PostgreSQL"
  type        = string
  sensitive   = true
  default     = ""
}

variable "environment_variables" {
  description = "Additional environment variables for tenant"
  type        = map(string)
  default     = {}
}

variable "tenant_tier" {
  description = "Tenant subscription tier: free, pro, enterprise"
  type        = string
  default     = "free"

  validation {
    condition     = contains(["free", "pro", "enterprise"], var.tenant_tier)
    error_message = "Tier must be 'free', 'pro', or 'enterprise'."
  }
}

variable "enable_agent_workspace" {
  description = "Enable persistent workspace PVC for agents"
  type        = bool
  default     = true
}

variable "workspace_size" {
  description = "Size of agent workspace PVC"
  type        = string
  default     = "10Gi"
}
