#!/bin/bash

# Azure CLI Authentication Check Script
# Handles device code authentication with persistence

set -e

AZURE_CONFIG_DIR="/root/.azure"
LOG_PREFIX="[Azure Auth]"

echo "$LOG_PREFIX Checking Azure CLI authentication status..."

# Ensure Azure config directory exists
mkdir -p "$AZURE_CONFIG_DIR"

# Function to perform device code login
perform_device_login() {
    echo ""
    echo "============================================"
    echo "$LOG_PREFIX AZURE AUTHENTICATION REQUIRED"
    echo "============================================"
    echo ""
    echo "$LOG_PREFIX Starting Azure CLI device code authentication..."
    echo "$LOG_PREFIX This will display a URL and code for browser authentication."

    echo "$LOG_PREFIX AZURE_TENANT_ID: ${AZURE_TENANT_ID:-'NOT SET'}"
    echo "$LOG_PREFIX AZURE_DEVOPS_ORG: ${AZURE_DEVOPS_ORG:-'NOT SET'}"
    
    # Check if specific tenant ID is provided
    if [ -n "$AZURE_TENANT_ID" ]; then
        az login --tenant "$AZURE_TENANT_ID" --allow-no-subscriptions --use-device-code
    else
        echo "$LOG_PREFIX Using default tenant selection"
        az login --allow-no-subscriptions --use-device-code
    fi

    if [ $? -eq 0 ]; then
        echo ""
        echo "$LOG_PREFIX ✅ Authentication successful!"
        echo "$LOG_PREFIX User authenticated as: $(az account show --query user.name -o tsv 2>/dev/null || echo 'Unknown')"
        echo "$LOG_PREFIX Tenant: $(az account show --query tenantId -o tsv 2>/dev/null || echo 'Unknown')"
        echo ""
    else
        echo ""
        echo "$LOG_PREFIX ❌ Authentication failed!"
        exit 1
    fi
}

# Check if already authenticated
if az account show >/dev/null 2>&1; then
    current_tenant=$(az account show --query tenantId -o tsv 2>/dev/null || echo 'Unknown')
    echo "$LOG_PREFIX ✅ Already authenticated!"
    echo "$LOG_PREFIX User: $(az account show --query user.name -o tsv 2>/dev/null || echo 'Unknown')"
    echo "$LOG_PREFIX Current Tenant: $current_tenant"
    
    # Check if we need to switch to a specific tenant
    if [ -n "$AZURE_TENANT_ID" ] && [ "$current_tenant" != "$AZURE_TENANT_ID" ]; then
        echo "$LOG_PREFIX 🔄 Switching to required tenant: $AZURE_TENANT_ID"
        az login --tenant "$AZURE_TENANT_ID" --allow-no-subscriptions --use-device-code
        if [ $? -eq 0 ]; then
            echo "$LOG_PREFIX ✅ Successfully switched to tenant: $AZURE_TENANT_ID"
        else
            echo "$LOG_PREFIX ❌ Failed to switch tenant!"
            exit 1
        fi
    fi
    echo ""
else
    echo "$LOG_PREFIX ❌ Not authenticated, starting device code login..."
    perform_device_login
fi

echo "$LOG_PREFIX Authentication check complete."