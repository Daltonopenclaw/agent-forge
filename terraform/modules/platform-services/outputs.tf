# Platform Services Module - Outputs

output "platform_namespace" {
  description = "Kubernetes namespace for platform services"
  value       = kubernetes_namespace.platform.metadata[0].name
}

output "platform_api_service" {
  description = "Platform API service name"
  value       = kubernetes_service.platform_api.metadata[0].name
}

output "dashboard_service" {
  description = "Dashboard service name"
  value       = kubernetes_service.dashboard.metadata[0].name
}

output "postgres_service" {
  description = "PostgreSQL service name"
  value       = kubernetes_service.postgres.metadata[0].name
}

output "platform_url" {
  description = "URL for the platform dashboard"
  value       = "https://${var.domain}"
}

output "api_url" {
  description = "URL for the platform API"
  value       = "https://api.${var.domain}"
}

output "grafana_url" {
  description = "URL for Grafana (if monitoring enabled)"
  value       = var.enable_monitoring ? "https://grafana.${var.domain}" : null
}

output "database_internal_url" {
  description = "Internal database URL (for platform services)"
  value       = "postgresql://agentforge:***@postgres.${local.platform_namespace}.svc.cluster.local:5432/agentforge"
  sensitive   = true
}
