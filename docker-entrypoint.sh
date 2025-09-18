#!/bin/bash

# Docker entrypoint script for Azure DevOps MCP REST Wrapper
# Handles Azure CLI authentication and starts the application

set -e

echo "🚀 Starting Azure DevOps MCP REST Wrapper..."
echo "📅 $(date)"
echo ""

# Run authentication check
echo "🔐 Checking Azure CLI authentication..."
/app/scripts/auth-check.sh

echo ""
echo "🔧 Starting MCP REST Wrapper application..."
echo "📍 Organization: ${AZURE_DEVOPS_ORG:-'Not set'}"
echo "🌐 Port: ${PORT:-3000}"
echo ""

# Start the application
exec "$@"