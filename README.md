# Azure DevOps MCP REST Wrapper

A Docker container that provides a REST API for Azure DevOps operations using MCP (Model Context Protocol).

## Quick Start

1. **Set your organization**
```bash
echo "AZURE_DEVOPS_ORG=your-org-name" > .env
```

2. **Start the container**
```bash
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

## API Endpoints

- `GET /health` - Health check
- `GET /api/tools` - List available tools
- `POST /api/tools/{tool-name}/call` - Execute a tool
- `POST /api/mcp` - MCP endpoint for Claude Code / VS Code

## Requirements

- Docker & Docker Compose
- Azure DevOps organization access
- Azure account for authentication

That's it! The container handles everything else automatically.