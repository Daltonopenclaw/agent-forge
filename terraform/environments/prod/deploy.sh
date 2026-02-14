#!/bin/bash
# MyIntell Platform - Terraform Deploy Script
# Loads secrets from 1Password and runs terraform

set -e

# Get 1Password session
export OP_SESSION_my=$(/root/.config/op/get-session.sh)

# Load secrets from 1Password
export TF_VAR_hetzner_token=$(op item get "Hetzner - myintell-platform" --fields label=credential --reveal)
export TF_VAR_cloudflare_api_token=$(op item get "Cloudflare - myintell.ai" --fields label=credential --reveal)

# Generate deterministic secrets (or load from 1Password if stored)
export TF_VAR_postgres_password=$(echo "myintell-postgres-$(hostname)" | sha256sum | head -c 32)
export TF_VAR_jwt_secret=$(echo "myintell-jwt-$(hostname)" | sha256sum | head -c 64)

echo "=== MyIntell Platform Deployment ==="
echo "Cluster: myintell"
echo "Location: ash (Ashburn, VA)"
echo "Domain: myintell.ai"
echo "Hetzner token: ${TF_VAR_hetzner_token:0:8}..."
echo "Cloudflare token: ${TF_VAR_cloudflare_api_token:0:8}..."
echo ""

# Run terraform command
terraform "$@"
