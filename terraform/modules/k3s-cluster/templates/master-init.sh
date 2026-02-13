#!/bin/bash
set -euo pipefail

# K3s Master Node Initialization Script
# This runs on first boot via cloud-init

exec > >(tee /var/log/k3s-init.log) 2>&1
echo "=== K3s Master Init Started: $(date) ==="

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
# K3S INSTALLATION
# ============================================================================

# Install K3s server (master)
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="${k3s_version}" sh -s - server \
    --token="${k3s_token}" \
    --node-ip="${private_ip}" \
    --advertise-address="${private_ip}" \
    --tls-san="${private_ip}" \
    --tls-san="$(curl -s http://169.254.169.254/hetzner/v1/metadata/public-ipv4)" \
    --flannel-iface=ens10 \
    --disable=servicelb \
    --write-kubeconfig-mode=644 \
    %{ if traefik_enabled }
    --disable=traefik \
    %{ endif }
    --cluster-cidr=10.42.0.0/16 \
    --service-cidr=10.43.0.0/16

# Wait for K3s to be ready
echo "Waiting for K3s to be ready..."
until kubectl get nodes 2>/dev/null; do
    sleep 5
done

echo "K3s master node ready!"

# ============================================================================
# INSTALL HELM
# ============================================================================

curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# ============================================================================
# INSTALL TRAEFIK (via Helm for more control)
# ============================================================================

%{ if traefik_enabled }
# Add Traefik Helm repo
helm repo add traefik https://traefik.github.io/charts
helm repo update

# Create Traefik namespace
kubectl create namespace traefik-system || true

# Install Traefik with custom config
cat <<'TRAEFIK_VALUES' > /tmp/traefik-values.yaml
deployment:
  replicas: 2

ingressRoute:
  dashboard:
    enabled: false  # Disable public dashboard

ports:
  web:
    port: 80
    expose: true
    exposedPort: 80
  websecure:
    port: 443
    expose: true
    exposedPort: 443
    tls:
      enabled: true

service:
  type: ClusterIP  # We use Hetzner LB in front

# Enable access logs
logs:
  access:
    enabled: true

# Prometheus metrics
metrics:
  prometheus:
    entryPoint: metrics

# Additional arguments
additionalArguments:
  - "--api.insecure=false"
  - "--entrypoints.web.http.redirections.entryPoint.to=websecure"
  - "--entrypoints.web.http.redirections.entryPoint.scheme=https"
  - "--providers.kubernetescrd.allowCrossNamespace=true"

# Resource limits
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "256Mi"
TRAEFIK_VALUES

helm upgrade --install traefik traefik/traefik \
    --namespace traefik-system \
    --values /tmp/traefik-values.yaml \
    --wait

echo "Traefik installed!"
%{ endif }

# ============================================================================
# INSTALL CERT-MANAGER
# ============================================================================

# Add Jetstack Helm repo
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install cert-manager
kubectl create namespace cert-manager || true

helm upgrade --install cert-manager jetstack/cert-manager \
    --namespace cert-manager \
    --set installCRDs=true \
    --wait

# Create ClusterIssuer for Let's Encrypt
cat <<'ISSUER' | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@${cluster_name}.dev
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
    - http01:
        ingress:
          class: traefik
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: admin@${cluster_name}.dev
    privateKeySecretRef:
      name: letsencrypt-staging-account-key
    solvers:
    - http01:
        ingress:
          class: traefik
ISSUER

echo "cert-manager installed!"

# ============================================================================
# INSTALL KEDA (for scale-to-zero)
# ============================================================================

helm repo add kedacore https://kedacore.github.io/charts
helm repo update

kubectl create namespace keda || true

helm upgrade --install keda kedacore/keda \
    --namespace keda \
    --wait

echo "KEDA installed!"

# ============================================================================
# INSTALL SEALED SECRETS (for secure secret management)
# ============================================================================

helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm repo update

kubectl create namespace sealed-secrets || true

helm upgrade --install sealed-secrets sealed-secrets/sealed-secrets \
    --namespace sealed-secrets \
    --wait

echo "Sealed Secrets installed!"

# ============================================================================
# CREATE PLATFORM NAMESPACE
# ============================================================================

kubectl create namespace agent-forge-platform || true
kubectl create namespace tenants || true

# Label namespaces
kubectl label namespace agent-forge-platform app.kubernetes.io/part-of=agent-forge
kubectl label namespace tenants app.kubernetes.io/part-of=agent-forge

# ============================================================================
# SAVE KUBECONFIG
# ============================================================================

# Copy kubeconfig to a location for easy retrieval
mkdir -p /root/.kube
cp /etc/rancher/k3s/k3s.yaml /root/.kube/config

# Create a version with the public IP for external access
PUBLIC_IP=$(curl -s http://169.254.169.254/hetzner/v1/metadata/public-ipv4)
sed "s/127.0.0.1/$PUBLIC_IP/g" /etc/rancher/k3s/k3s.yaml > /root/kubeconfig-external.yaml

echo "=== K3s Master Init Complete: $(date) ==="
echo "Kubeconfig available at: /root/kubeconfig-external.yaml"
