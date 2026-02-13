# Tenant Module - Main Resources
# Provisions a complete isolated tenant environment

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

locals {
  tenant_namespace = "tenant-${var.tenant_name}"
  tenant_fqdn      = "${var.tenant_name}.${var.domain}"
  labels = {
    "app.kubernetes.io/name"       = var.tenant_name
    "app.kubernetes.io/part-of"    = "agent-forge"
    "app.kubernetes.io/managed-by" = "terraform"
    "agent-forge.dev/tenant"       = var.tenant_name
    "agent-forge.dev/tier"         = var.tenant_tier
  }
}

# ============================================================================
# NAMESPACE
# ============================================================================

resource "kubernetes_namespace" "tenant" {
  metadata {
    name   = local.tenant_namespace
    labels = local.labels
    annotations = {
      "agent-forge.dev/display-name" = var.tenant_display_name
      "agent-forge.dev/created-at"   = timestamp()
    }
  }
}

# ============================================================================
# RESOURCE QUOTA (based on tier)
# ============================================================================

resource "kubernetes_resource_quota" "tenant" {
  metadata {
    name      = "tenant-quota"
    namespace = kubernetes_namespace.tenant.metadata[0].name
  }

  spec {
    hard = {
      "requests.cpu"    = var.tenant_tier == "enterprise" ? "8" : (var.tenant_tier == "pro" ? "4" : "1")
      "requests.memory" = var.tenant_tier == "enterprise" ? "16Gi" : (var.tenant_tier == "pro" ? "8Gi" : "2Gi")
      "limits.cpu"      = var.tenant_tier == "enterprise" ? "16" : (var.tenant_tier == "pro" ? "8" : "2")
      "limits.memory"   = var.tenant_tier == "enterprise" ? "32Gi" : (var.tenant_tier == "pro" ? "16Gi" : "4Gi")
      "pods"            = var.tenant_tier == "enterprise" ? "50" : (var.tenant_tier == "pro" ? "20" : "5")
      "services"        = var.tenant_tier == "enterprise" ? "20" : (var.tenant_tier == "pro" ? "10" : "3")
    }
  }
}

# ============================================================================
# DATABASE (Neon - Serverless Postgres)
# ============================================================================

# Generate database password
resource "random_password" "db_password" {
  count   = var.database_type != "none" ? 1 : 0
  length  = 32
  special = false
}

# Create Neon database branch (using Neon API)
resource "null_resource" "neon_database" {
  count = var.database_type == "neon" && var.neon_api_key != "" ? 1 : 0

  triggers = {
    tenant_name = var.tenant_name
  }

  provisioner "local-exec" {
    command = <<-EOT
      curl -s -X POST "https://console.neon.tech/api/v2/projects/${var.neon_project_id}/branches" \
        -H "Authorization: Bearer ${var.neon_api_key}" \
        -H "Content-Type: application/json" \
        -d '{
          "branch": {
            "name": "tenant-${var.tenant_name}"
          },
          "endpoints": [{
            "type": "read_write"
          }]
        }' > /tmp/neon-${var.tenant_name}.json
    EOT
  }

  provisioner "local-exec" {
    when    = destroy
    command = <<-EOT
      # Get branch ID and delete
      BRANCH_ID=$(curl -s "https://console.neon.tech/api/v2/projects/${self.triggers.neon_project_id}/branches" \
        -H "Authorization: Bearer ${self.triggers.neon_api_key}" | \
        jq -r '.branches[] | select(.name == "tenant-${self.triggers.tenant_name}") | .id')
      
      if [ -n "$BRANCH_ID" ]; then
        curl -s -X DELETE "https://console.neon.tech/api/v2/projects/${self.triggers.neon_project_id}/branches/$BRANCH_ID" \
          -H "Authorization: Bearer ${self.triggers.neon_api_key}"
      fi
    EOT
  }
}

# ============================================================================
# SECRETS
# ============================================================================

resource "kubernetes_secret" "tenant_secrets" {
  metadata {
    name      = "tenant-secrets"
    namespace = kubernetes_namespace.tenant.metadata[0].name
    labels    = local.labels
  }

  data = merge(
    {
      "TENANT_NAME" = var.tenant_name
      "TENANT_TIER" = var.tenant_tier
    },
    var.database_type != "none" ? {
      "DATABASE_PASSWORD" = random_password.db_password[0].result
      "DATABASE_URL"      = var.database_type == "neon" ? "postgresql://tenant_${var.tenant_name}:${random_password.db_password[0].result}@${var.tenant_name}.${var.neon_project_id}.neon.tech/neondb" : "postgresql://tenant_${var.tenant_name}:${random_password.db_password[0].result}@${var.shared_postgres_host}/tenant_${var.tenant_name}"
    } : {},
    var.environment_variables
  )

  type = "Opaque"
}

# ============================================================================
# PERSISTENT VOLUME CLAIM (Agent Workspace)
# ============================================================================

resource "kubernetes_persistent_volume_claim" "workspace" {
  count = var.enable_agent_workspace ? 1 : 0

  metadata {
    name      = "agent-workspace"
    namespace = kubernetes_namespace.tenant.metadata[0].name
    labels    = local.labels
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = var.workspace_size
      }
    }
    storage_class_name = "local-path" # K3s default storage class
  }
}

# ============================================================================
# DEPLOYMENT
# ============================================================================

resource "kubernetes_deployment" "tenant_backend" {
  metadata {
    name      = "backend"
    namespace = kubernetes_namespace.tenant.metadata[0].name
    labels    = local.labels
  }

  spec {
    replicas = var.scale_to_zero ? 0 : 1 # KEDA will manage if scale-to-zero

    selector {
      match_labels = {
        "app.kubernetes.io/name" = var.tenant_name
      }
    }

    template {
      metadata {
        labels = local.labels
        annotations = {
          "agent-forge.dev/config-hash" = sha256(jsonencode(var.environment_variables))
        }
      }

      spec {
        container {
          name  = "backend"
          image = var.container_image

          port {
            container_port = var.container_port
            name           = "http"
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.tenant_secrets.metadata[0].name
            }
          }

          env {
            name  = "PORT"
            value = tostring(var.container_port)
          }

          env {
            name  = "NODE_ENV"
            value = "production"
          }

          resources {
            requests = {
              cpu    = var.cpu_request
              memory = var.memory_request
            }
            limits = {
              cpu    = var.cpu_limit
              memory = var.memory_limit
            }
          }

          dynamic "volume_mount" {
            for_each = var.enable_agent_workspace ? [1] : []
            content {
              name       = "workspace"
              mount_path = "/workspace"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = var.container_port
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = var.container_port
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }

        dynamic "volume" {
          for_each = var.enable_agent_workspace ? [1] : []
          content {
            name = "workspace"
            persistent_volume_claim {
              claim_name = kubernetes_persistent_volume_claim.workspace[0].metadata[0].name
            }
          }
        }

        # Security context
        security_context {
          run_as_non_root = true
          run_as_user     = 1000
          fs_group        = 1000
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      spec[0].replicas # Let KEDA manage replicas
    ]
  }
}

# ============================================================================
# SERVICE
# ============================================================================

resource "kubernetes_service" "tenant_backend" {
  metadata {
    name      = "backend"
    namespace = kubernetes_namespace.tenant.metadata[0].name
    labels    = local.labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = var.tenant_name
    }

    port {
      port        = 80
      target_port = var.container_port
      name        = "http"
    }

    type = "ClusterIP"
  }
}

# ============================================================================
# INGRESS (Traefik IngressRoute)
# ============================================================================

resource "kubernetes_manifest" "ingress_route" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "IngressRoute"
    metadata = {
      name      = "tenant-ingress"
      namespace = kubernetes_namespace.tenant.metadata[0].name
      labels    = local.labels
    }
    spec = {
      entryPoints = ["websecure"]
      routes = [
        {
          match = "Host(`${local.tenant_fqdn}`)"
          kind  = "Rule"
          services = [
            {
              name = kubernetes_service.tenant_backend.metadata[0].name
              port = 80
            }
          ]
        },
        {
          # Also match header-based routing (for CloudFront/Cloudflare)
          match = "PathPrefix(`/`) && Headers(`X-Tenant-Host`, `${var.tenant_name}`)"
          kind  = "Rule"
          services = [
            {
              name = kubernetes_service.tenant_backend.metadata[0].name
              port = 80
            }
          ]
        }
      ]
      tls = {
        certResolver = "letsencrypt-prod"
      }
    }
  }
}

# ============================================================================
# KEDA SCALEDOBJECT (Scale to Zero)
# ============================================================================

resource "kubernetes_manifest" "keda_scaledobject" {
  count = var.scale_to_zero ? 1 : 0

  manifest = {
    apiVersion = "keda.sh/v1alpha1"
    kind       = "ScaledObject"
    metadata = {
      name      = "backend-scaler"
      namespace = kubernetes_namespace.tenant.metadata[0].name
      labels    = local.labels
    }
    spec = {
      scaleTargetRef = {
        name = kubernetes_deployment.tenant_backend.metadata[0].name
      }
      minReplicaCount = var.min_replicas
      maxReplicaCount = var.max_replicas
      cooldownPeriod  = 300 # 5 minutes before scaling down

      triggers = [
        {
          type = "prometheus"
          metadata = {
            serverAddress = "http://prometheus-server.monitoring.svc.cluster.local"
            metricName    = "http_requests_total"
            threshold     = "1"
            query         = "sum(rate(traefik_service_requests_total{service=\"${kubernetes_namespace.tenant.metadata[0].name}-backend@kubernetes\"}[2m]))"
          }
        }
      ]

      # Fallback: scale up on any ingress traffic
      advanced = {
        horizontalPodAutoscalerConfig = {
          behavior = {
            scaleDown = {
              stabilizationWindowSeconds = 300
              policies = [
                {
                  type          = "Percent"
                  value         = 100
                  periodSeconds = 60
                }
              ]
            }
            scaleUp = {
              stabilizationWindowSeconds = 0
              policies = [
                {
                  type          = "Percent"
                  value         = 100
                  periodSeconds = 15
                }
              ]
            }
          }
        }
      }
    }
  }
}

# ============================================================================
# DNS (Cloudflare - only if not using wildcard)
# ============================================================================

# Note: If using Cloudflare wildcard DNS, this is optional
# Uncomment if you need explicit per-tenant DNS records

# resource "cloudflare_record" "tenant" {
#   zone_id = var.cloudflare_zone_id
#   name    = var.tenant_name
#   content = var.load_balancer_ip
#   type    = "A"
#   ttl     = 300
#   proxied = true
# }
