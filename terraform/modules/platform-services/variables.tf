# Platform Services Module - Variables
# Deploys shared platform services (API, dashboard, monitoring)

variable "cluster_name" {
  description = "Name of the K3s cluster"
  type        = string
}

variable "domain" {
  description = "Base domain for the platform"
  type        = string
}

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
  description = "Enable Prometheus + Grafana monitoring stack"
  type        = bool
  default     = true
}

variable "enable_harbor" {
  description = "Enable Harbor container registry"
  type        = bool
  default     = false # Use external registry initially
}

variable "postgres_password" {
  description = "Password for platform PostgreSQL"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret for platform API"
  type        = string
  sensitive   = true
}

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

variable "admin_email" {
  description = "Admin email for platform alerts"
  type        = string
}
