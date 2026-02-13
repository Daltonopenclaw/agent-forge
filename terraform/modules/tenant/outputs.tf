# Tenant Module - Outputs

output "tenant_name" {
  description = "Tenant identifier"
  value       = var.tenant_name
}

output "tenant_namespace" {
  description = "Kubernetes namespace for tenant"
  value       = kubernetes_namespace.tenant.metadata[0].name
}

output "tenant_url" {
  description = "URL for tenant application"
  value       = "https://${local.tenant_fqdn}"
}

output "tenant_fqdn" {
  description = "Fully qualified domain name for tenant"
  value       = local.tenant_fqdn
}

output "backend_service_name" {
  description = "Kubernetes service name for backend"
  value       = kubernetes_service.tenant_backend.metadata[0].name
}

output "database_url" {
  description = "Database connection URL"
  value       = var.database_type != "none" ? "postgresql://tenant_${var.tenant_name}:***@${var.database_type == "neon" ? "${var.tenant_name}.${var.neon_project_id}.neon.tech" : var.shared_postgres_host}/tenant_${var.tenant_name}" : null
  sensitive   = true
}

output "workspace_pvc_name" {
  description = "Name of the agent workspace PVC"
  value       = var.enable_agent_workspace ? kubernetes_persistent_volume_claim.workspace[0].metadata[0].name : null
}

output "tier" {
  description = "Tenant subscription tier"
  value       = var.tenant_tier
}

output "scale_to_zero_enabled" {
  description = "Whether scale-to-zero is enabled"
  value       = var.scale_to_zero
}
