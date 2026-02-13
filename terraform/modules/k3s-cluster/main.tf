# K3s Cluster Module - Main Resources
# Creates a production-ready K3s cluster on Hetzner Cloud

terraform {
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# ============================================================================
# SSH KEY
# ============================================================================

resource "hcloud_ssh_key" "cluster" {
  name       = "${var.cluster_name}-key"
  public_key = var.ssh_public_key
}

# ============================================================================
# NETWORK
# ============================================================================

resource "hcloud_network" "cluster" {
  name     = "${var.cluster_name}-network"
  ip_range = var.network_cidr
}

resource "hcloud_network_subnet" "cluster" {
  network_id   = hcloud_network.cluster.id
  type         = "cloud"
  network_zone = "eu-central"
  ip_range     = var.subnet_cidr
}

# ============================================================================
# FIREWALL
# ============================================================================

resource "hcloud_firewall" "cluster" {
  name = "${var.cluster_name}-firewall"

  # SSH
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = var.allowed_ssh_ips
  }

  # HTTP
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # HTTPS
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # K3s API (restrict in production)
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "6443"
    source_ips = var.allowed_ssh_ips
  }

  # K3s internal - flannel VXLAN
  rule {
    direction  = "in"
    protocol   = "udp"
    port       = "8472"
    source_ips = [var.network_cidr]
  }

  # K3s internal - kubelet
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "10250"
    source_ips = [var.network_cidr]
  }
}

# ============================================================================
# K3S TOKEN (shared secret for cluster join)
# ============================================================================

resource "random_password" "k3s_token" {
  length  = 64
  special = false
}

# ============================================================================
# MASTER NODE
# ============================================================================

resource "hcloud_server" "master" {
  name        = "${var.cluster_name}-master"
  server_type = var.master_server_type
  location    = var.hetzner_location
  image       = "ubuntu-24.04"
  ssh_keys    = [hcloud_ssh_key.cluster.id]
  firewall_ids = [hcloud_firewall.cluster.id]

  network {
    network_id = hcloud_network.cluster.id
    ip         = cidrhost(var.subnet_cidr, 10) # 10.0.1.10
  }

  user_data = templatefile("${path.module}/templates/master-init.sh", {
    k3s_version       = var.k3s_version
    k3s_token         = random_password.k3s_token.result
    private_ip        = cidrhost(var.subnet_cidr, 10)
    cluster_name      = var.cluster_name
    traefik_enabled   = true
  })

  labels = {
    cluster = var.cluster_name
    role    = "master"
  }

  depends_on = [hcloud_network_subnet.cluster]
}

# ============================================================================
# WORKER NODES
# ============================================================================

resource "hcloud_server" "workers" {
  count       = var.worker_count
  name        = "${var.cluster_name}-worker-${count.index + 1}"
  server_type = var.worker_server_type
  location    = var.hetzner_location
  image       = "ubuntu-24.04"
  ssh_keys    = [hcloud_ssh_key.cluster.id]
  firewall_ids = [hcloud_firewall.cluster.id]

  network {
    network_id = hcloud_network.cluster.id
    ip         = cidrhost(var.subnet_cidr, 20 + count.index) # 10.0.1.20, 10.0.1.21, ...
  }

  user_data = templatefile("${path.module}/templates/worker-init.sh", {
    k3s_version  = var.k3s_version
    k3s_token    = random_password.k3s_token.result
    master_ip    = cidrhost(var.subnet_cidr, 10)
    cluster_name = var.cluster_name
  })

  labels = {
    cluster = var.cluster_name
    role    = "worker"
  }

  depends_on = [
    hcloud_server.master,
    hcloud_network_subnet.cluster
  ]
}

# ============================================================================
# LOAD BALANCER (for HA ingress)
# ============================================================================

resource "hcloud_load_balancer" "ingress" {
  name               = "${var.cluster_name}-lb"
  load_balancer_type = "lb11" # Smallest, ~$6/mo
  location           = var.hetzner_location
}

resource "hcloud_load_balancer_network" "ingress" {
  load_balancer_id = hcloud_load_balancer.ingress.id
  network_id       = hcloud_network.cluster.id
  ip               = cidrhost(var.subnet_cidr, 5) # 10.0.1.5
}

resource "hcloud_load_balancer_target" "master" {
  type             = "server"
  load_balancer_id = hcloud_load_balancer.ingress.id
  server_id        = hcloud_server.master.id
  use_private_ip   = true
}

resource "hcloud_load_balancer_target" "workers" {
  count            = var.worker_count
  type             = "server"
  load_balancer_id = hcloud_load_balancer.ingress.id
  server_id        = hcloud_server.workers[count.index].id
  use_private_ip   = true
}

# HTTP service
resource "hcloud_load_balancer_service" "http" {
  load_balancer_id = hcloud_load_balancer.ingress.id
  protocol         = "tcp"
  listen_port      = 80
  destination_port = 80

  health_check {
    protocol = "tcp"
    port     = 80
    interval = 10
    timeout  = 5
    retries  = 3
  }
}

# HTTPS service
resource "hcloud_load_balancer_service" "https" {
  load_balancer_id = hcloud_load_balancer.ingress.id
  protocol         = "tcp"
  listen_port      = 443
  destination_port = 443

  health_check {
    protocol = "tcp"
    port     = 443
    interval = 10
    timeout  = 5
    retries  = 3
  }
}

# ============================================================================
# DNS (Cloudflare)
# ============================================================================

data "cloudflare_zone" "main" {
  name = var.domain
}

# A record for the platform
resource "cloudflare_record" "platform" {
  zone_id = data.cloudflare_zone.main.id
  name    = "@"
  content = hcloud_load_balancer.ingress.ipv4
  type    = "A"
  ttl     = 300
  proxied = true # Enable Cloudflare CDN
}

# Wildcard for tenant subdomains
resource "cloudflare_record" "wildcard" {
  zone_id = data.cloudflare_zone.main.id
  name    = "*"
  content = hcloud_load_balancer.ingress.ipv4
  type    = "A"
  ttl     = 300
  proxied = true # Enable Cloudflare CDN + header injection
}

# API subdomain (non-proxied for direct access if needed)
resource "cloudflare_record" "api" {
  zone_id = data.cloudflare_zone.main.id
  name    = "api"
  content = hcloud_load_balancer.ingress.ipv4
  type    = "A"
  ttl     = 300
  proxied = true
}
