# Platform Services Module - Main Resources
# Deploys shared platform infrastructure

terraform {
  required_providers {
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
}

locals {
  platform_namespace = "agent-forge-platform"
  labels = {
    "app.kubernetes.io/part-of"    = "agent-forge"
    "app.kubernetes.io/managed-by" = "terraform"
  }
}

# ============================================================================
# NAMESPACE (should already exist from k3s-cluster module)
# ============================================================================

resource "kubernetes_namespace" "platform" {
  metadata {
    name = local.platform_namespace
    labels = merge(local.labels, {
      "app.kubernetes.io/name" = "platform"
    })
  }
}

# ============================================================================
# POSTGRESQL (Platform Database)
# ============================================================================

resource "kubernetes_persistent_volume_claim" "postgres" {
  metadata {
    name      = "postgres-data"
    namespace = kubernetes_namespace.platform.metadata[0].name
    labels    = local.labels
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "10Gi"
      }
    }
    storage_class_name = "local-path"
  }
}

resource "kubernetes_secret" "postgres" {
  metadata {
    name      = "postgres-credentials"
    namespace = kubernetes_namespace.platform.metadata[0].name
    labels    = local.labels
  }

  data = {
    "POSTGRES_USER"     = "agentforge"
    "POSTGRES_PASSWORD" = var.postgres_password
    "POSTGRES_DB"       = "agentforge"
  }

  type = "Opaque"
}

resource "kubernetes_stateful_set" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.platform.metadata[0].name
    labels    = local.labels
  }

  spec {
    service_name = "postgres"
    replicas     = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "postgres"
      }
    }

    template {
      metadata {
        labels = merge(local.labels, {
          "app.kubernetes.io/name" = "postgres"
        })
      }

      spec {
        container {
          name  = "postgres"
          image = "postgres:16-alpine"

          port {
            container_port = 5432
            name           = "postgres"
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.postgres.metadata[0].name
            }
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/postgresql/data"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          liveness_probe {
            exec {
              command = ["pg_isready", "-U", "agentforge"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.postgres.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.platform.metadata[0].name
    labels    = local.labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "postgres"
    }

    port {
      port        = 5432
      target_port = 5432
      name        = "postgres"
    }

    type = "ClusterIP"
  }
}

# ============================================================================
# PLATFORM SECRETS
# ============================================================================

resource "kubernetes_secret" "platform_secrets" {
  metadata {
    name      = "platform-secrets"
    namespace = kubernetes_namespace.platform.metadata[0].name
    labels    = local.labels
  }

  data = {
    "DATABASE_URL"           = "postgresql://agentforge:${var.postgres_password}@postgres:5432/agentforge"
    "JWT_SECRET"             = var.jwt_secret
    "STRIPE_SECRET_KEY"      = var.stripe_secret_key
    "STRIPE_WEBHOOK_SECRET"  = var.stripe_webhook_secret
    "NEON_API_KEY"           = var.neon_api_key
    "NEON_PROJECT_ID"        = var.neon_project_id
    "OPENAI_API_KEY"         = var.openai_api_key
    "ANTHROPIC_API_KEY"      = var.anthropic_api_key
  }

  type = "Opaque"
}

# ============================================================================
# PLATFORM API
# ============================================================================

resource "kubernetes_deployment" "platform_api" {
  metadata {
    name      = "platform-api"
    namespace = kubernetes_namespace.platform.metadata[0].name
    labels    = local.labels
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "platform-api"
      }
    }

    template {
      metadata {
        labels = merge(local.labels, {
          "app.kubernetes.io/name" = "platform-api"
        })
      }

      spec {
        container {
          name  = "api"
          image = var.platform_image

          port {
            container_port = 3000
            name           = "http"
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.platform_secrets.metadata[0].name
            }
          }

          env {
            name  = "NODE_ENV"
            value = "production"
          }

          env {
            name  = "PORT"
            value = "3000"
          }

          env {
            name  = "DOMAIN"
            value = var.domain
          }

          resources {
            requests = {
              cpu    = "200m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "1000m"
              memory = "1Gi"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 15
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }

  depends_on = [kubernetes_stateful_set.postgres]
}

resource "kubernetes_service" "platform_api" {
  metadata {
    name      = "platform-api"
    namespace = kubernetes_namespace.platform.metadata[0].name
    labels    = local.labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "platform-api"
    }

    port {
      port        = 80
      target_port = 3000
      name        = "http"
    }

    type = "ClusterIP"
  }
}

# ============================================================================
# PLATFORM DASHBOARD
# ============================================================================

resource "kubernetes_deployment" "dashboard" {
  metadata {
    name      = "dashboard"
    namespace = kubernetes_namespace.platform.metadata[0].name
    labels    = local.labels
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "dashboard"
      }
    }

    template {
      metadata {
        labels = merge(local.labels, {
          "app.kubernetes.io/name" = "dashboard"
        })
      }

      spec {
        container {
          name  = "dashboard"
          image = var.dashboard_image

          port {
            container_port = 3000
            name           = "http"
          }

          env {
            name  = "NEXT_PUBLIC_API_URL"
            value = "https://api.${var.domain}"
          }

          env {
            name  = "NEXT_PUBLIC_DOMAIN"
            value = var.domain
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 3000
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "dashboard" {
  metadata {
    name      = "dashboard"
    namespace = kubernetes_namespace.platform.metadata[0].name
    labels    = local.labels
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "dashboard"
    }

    port {
      port        = 80
      target_port = 3000
      name        = "http"
    }

    type = "ClusterIP"
  }
}

# ============================================================================
# INGRESS ROUTES
# ============================================================================

# Main platform domain
resource "kubernetes_manifest" "platform_ingress" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "IngressRoute"
    metadata = {
      name      = "platform-ingress"
      namespace = kubernetes_namespace.platform.metadata[0].name
      labels    = local.labels
    }
    spec = {
      entryPoints = ["websecure"]
      routes = [
        {
          match = "Host(`${var.domain}`)"
          kind  = "Rule"
          services = [
            {
              name = kubernetes_service.dashboard.metadata[0].name
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

# API subdomain
resource "kubernetes_manifest" "api_ingress" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "IngressRoute"
    metadata = {
      name      = "api-ingress"
      namespace = kubernetes_namespace.platform.metadata[0].name
      labels    = local.labels
    }
    spec = {
      entryPoints = ["websecure"]
      routes = [
        {
          match = "Host(`api.${var.domain}`)"
          kind  = "Rule"
          services = [
            {
              name = kubernetes_service.platform_api.metadata[0].name
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
# MONITORING (Optional)
# ============================================================================

resource "helm_release" "prometheus" {
  count = var.enable_monitoring ? 1 : 0

  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  namespace  = "monitoring"
  version    = "56.6.2"

  create_namespace = true

  set {
    name  = "grafana.enabled"
    value = "true"
  }

  set {
    name  = "grafana.adminPassword"
    value = "admin" # Change in production!
  }

  set {
    name  = "prometheus.prometheusSpec.retention"
    value = "7d"
  }

  set {
    name  = "prometheus.prometheusSpec.resources.requests.memory"
    value = "512Mi"
  }

  set {
    name  = "prometheus.prometheusSpec.resources.limits.memory"
    value = "1Gi"
  }

  # Disable components we don't need to save resources
  set {
    name  = "alertmanager.enabled"
    value = "false"
  }

  values = [<<-YAML
    grafana:
      ingress:
        enabled: true
        ingressClassName: traefik
        hosts:
          - grafana.${var.domain}
        tls:
          - secretName: grafana-tls
            hosts:
              - grafana.${var.domain}
  YAML
  ]
}
