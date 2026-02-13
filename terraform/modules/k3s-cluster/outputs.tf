# K3s Cluster Module - Outputs

output "cluster_name" {
  description = "Name of the K3s cluster"
  value       = var.cluster_name
}

output "master_public_ip" {
  description = "Public IP of the master node"
  value       = hcloud_server.master.ipv4_address
}

output "master_private_ip" {
  description = "Private IP of the master node"
  value       = cidrhost(var.subnet_cidr, 10)
}

output "worker_public_ips" {
  description = "Public IPs of worker nodes"
  value       = hcloud_server.workers[*].ipv4_address
}

output "worker_private_ips" {
  description = "Private IPs of worker nodes"
  value       = [for i in range(var.worker_count) : cidrhost(var.subnet_cidr, 20 + i)]
}

output "load_balancer_ip" {
  description = "Public IP of the load balancer (ingress)"
  value       = hcloud_load_balancer.ingress.ipv4
}

output "network_id" {
  description = "Hetzner network ID"
  value       = hcloud_network.cluster.id
}

output "subnet_id" {
  description = "Hetzner subnet ID"
  value       = hcloud_network_subnet.cluster.id
}

output "k3s_token" {
  description = "K3s cluster join token"
  value       = random_password.k3s_token.result
  sensitive   = true
}

output "kubeconfig_command" {
  description = "Command to get kubeconfig from master"
  value       = "ssh root@${hcloud_server.master.ipv4_address} cat /root/kubeconfig-external.yaml > ~/.kube/agent-forge.yaml"
}

output "cloudflare_zone_id" {
  description = "Cloudflare zone ID for DNS"
  value       = data.cloudflare_zone.main.id
}

output "domain" {
  description = "Base domain for the platform"
  value       = var.domain
}

output "platform_url" {
  description = "URL for the platform"
  value       = "https://${var.domain}"
}

output "wildcard_url_pattern" {
  description = "Pattern for tenant URLs"
  value       = "https://*.${var.domain}"
}
