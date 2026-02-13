# K3s Cluster Module - Variables
# Provisions a K3s cluster on Hetzner Cloud

variable "cluster_name" {
  description = "Name of the K3s cluster"
  type        = string
  default     = "agent-forge"
}

variable "hetzner_location" {
  description = "Hetzner datacenter location"
  type        = string
  default     = "ash" # Falkenstein, Germany (cheapest)
}

variable "master_server_type" {
  description = "Hetzner server type for master node"
  type        = string
  default     = "cx22" # 2 vCPU, 4GB RAM, ~$4.50/mo
}

variable "worker_server_type" {
  description = "Hetzner server type for worker nodes"
  type        = string
  default     = "cx32" # 4 vCPU, 8GB RAM, ~$9/mo
}

variable "worker_count" {
  description = "Number of worker nodes"
  type        = number
  default     = 2
}

variable "ssh_public_key" {
  description = "SSH public key for node access"
  type        = string
}

variable "k3s_version" {
  description = "K3s version to install"
  type        = string
  default     = "v1.31.4+k3s1"
}

variable "network_cidr" {
  description = "CIDR for the private network"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "CIDR for the subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "allowed_ssh_ips" {
  description = "IPs allowed to SSH (CIDR notation)"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Restrict in production!
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token for DNS management"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Base domain for the platform"
  type        = string
  default     = "agentforge.dev"
}
