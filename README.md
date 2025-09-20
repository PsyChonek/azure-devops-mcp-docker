# Azure DevOps MCP REST Wrapper

A Docker container that provides a REST API for Azure DevOps operations using MCP (Model Context Protocol).

## Quick Start

1. **Set your organization and tenant**

```bash
# Create .env file with your Azure DevOps organization and tenant ID
cat > .env << EOF
AZURE_DEVOPS_ORG=your-org-name
AZURE_TENANT_ID=your-tenant-id
EOF
```

2. **Build and start the container**

```bash
# Always rebuild to avoid cached issues
docker-compose build --no-cache
docker-compose up -d
```

3. **Authenticate when prompted**

```bash
# Watch logs for authentication prompt
docker-compose logs -f azure-devops-mcp

# Go to https://microsoft.com/devicelogin
# Enter the code shown in logs
# Sign in with your Azure account
```

## Features

- 🔐 **Automatic Azure CLI authentication** with device code
- 🏢 **Multi-tenant support** with automatic tenant switching
- 💾 **Persistent credentials** across container restarts
- 🛠️ **70+ Azure DevOps tools** available via REST API
- 📦 **Docker-ready** with simple docker-compose setup

## Connect to Claude Code / VS Code

Add this to your MCP settings:

```json
"devops-mcp-local": {
    "url": "http://localhost:3000/api/mcp"
}
```

### Alternative: Running Locally

```bash
npm install
npm run dev
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/tools` - List available tools
- `POST /api/tools/{tool-name}/call` - Execute a tool
- `POST /api/mcp` - MCP endpoint for Claude Code / VS Code

## Configuration

### Environment Variables

- `AZURE_DEVOPS_ORG` - Your Azure DevOps organization name (required)
- `AZURE_TENANT_ID` - Your Azure AD tenant ID (optional, but recommended for multi-tenant scenarios)

### Finding Your Tenant ID

**Azure Portal**: DevOps -> Profile picture -> Switch directory

## HTTPS

- Install openssl
- Use `npm run generate-certs` to create self-signed certs

## Requirements

- Docker & Docker Compose
- Azure DevOps organization access
- Azure account for authentication

That's it! The container handles everything else automatically.

## FAQ

### az login doesn't work with MCP in IDE

Az login only works inside the Docker container. We don't have a solution yet. Run locally instead:

```bash
npm run dev
```

### Container not picking up code changes

If your code changes aren't reflected, rebuild the container completely:

```bash
# Stop and remove existing container
docker-compose down

# Rebuild without cache to ensure fresh build
docker-compose build --no-cache

# Start fresh container
docker-compose up -d
```

### For development: live reload

For active development, you can rebuild and restart quickly:

```bash
# Quick rebuild and restart
docker-compose down && docker-compose build && docker-compose up -d
```

### Claude Desktop config

Require proxy, dont support local mcp server.

```json
    "azure-devops-mcp": {
      "command": "node",
      "args": [".../azure-devops-mcp-docker/claude/proxy.js"]
    }
```
