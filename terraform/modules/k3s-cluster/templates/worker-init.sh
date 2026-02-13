#!/bin/bash
set -euo pipefail

# K3s Worker Node Initialization Script
# This runs on first boot via cloud-init

exec > >(tee /var/log/k3s-init.log) 2>&1
echo "=== K3s Worker Init Started: $(date) ==="

# ============================================================================
# SYSTEM SETUP
# ============================================================================

# Update and install dependencies
apt-get update
apt-get install -y \
    curl \
    wget \
    jq \
    unzip \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    open-iscsi \
    nfs-common

# Enable required kernel modules
modprobe br_netfilter
modprobe overlay
echo "br_netfilter" >> /etc/modules-load.d/k8s.conf
echo "overlay" >> /etc/modules-load.d/k8s.conf

# Kernel parameters for K8s
cat <<EOF > /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward = 1
EOF
sysctl --system

# ============================================================================
# WAIT FOR MASTER
# ============================================================================

echo "Waiting for master node to be ready..."
MASTER_IP="${master_ip}"
MAX_RETRIES=60
RETRY_COUNT=0

while ! nc -z $MASTER_IP 6443 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "ERROR: Master node not reachable after $MAX_RETRIES attempts"
        exit 1
    fi
    echo "Waiting for master ($RETRY_COUNT/$MAX_RETRIES)..."
    sleep 10
done

echo "Master node is reachable!"

# ============================================================================
# K3S INSTALLATION (AGENT/WORKER)
# ============================================================================

# Install K3s agent (worker)
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="${k3s_version}" K3S_URL="https://${master_ip}:6443" K3S_TOKEN="${k3s_token}" sh -s - agent \
    --node-ip="$(hostname -I | awk '{print $2}')" \
    --flannel-iface=ens10

# Wait for node to register
echo "Waiting for worker to register with cluster..."
sleep 30

echo "=== K3s Worker Init Complete: $(date) ==="
