# Azure DevOps MCP Extension

This MCP extension connects to a running Azure DevOps MCP Docker container, providing integration with Azure DevOps for managing projects, work items, and repositories directly from Claude Desktop.

## Features

- List and manage Azure DevOps projects
- Create, read, update work items
- Repository operations
- CI/CD pipeline interactions
- Team and user management

## Prerequisites

1. **Running Docker Container**: The Azure DevOps MCP Docker container must be running
2. **Container Setup**: Container must be built and started with HTTPS support

## Before Installation

1. **Start the Docker container**:
   ```bash
   docker-compose up -d
   ```

2. **Verify the container is running**:
   ```bash
   curl -k https://localhost:3001/health
   ```

## Installation

1. Download the `azure-devops-mcp.mcpb` file
2. Double-click to install in Claude Desktop
3. The extension will connect to `https://localhost:3001/api/mcp`
4. Restart Claude Desktop if needed

## Configuration

The Azure DevOps organization is configured in the Docker container via the `AZURE_DEVOPS_ORG` environment variable. No additional configuration is needed in Claude Desktop.

## Usage

Once the container is running and the extension is installed, you can ask Claude to:
- "List my Azure DevOps projects"
- "Show work items for project X"
- "Create a new work item"
- "Show repository information"

## Troubleshooting

### Container Issues
- Ensure the Docker container is running: `docker-compose ps`
- Check container logs: `docker-compose logs`
- Restart if needed: `docker-compose restart`

### Connection Issues
- Verify HTTPS endpoint: `curl -k https://localhost:3001/health`
- Check port 3001 is available and not blocked by firewall

### Authentication Issues
- Ensure Azure CLI is authenticated in the container
- Check container environment variables include `AZURE_DEVOPS_ORG`

## Support

For issues and feature requests, please refer to the project repository.