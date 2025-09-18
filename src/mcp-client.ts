import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AuthenticationContext, generateAuthCacheKey } from './auth-middleware';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: any;
}

interface MCPClientInstance {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport;
  tools: MCPTool[];
  isInitialized: boolean;
  lastUsed: Date;
}

export class MCPClientManager {
  private clients: Map<string, MCPClientInstance> = new Map();

  constructor() {
    // No default authentication manager needed
  }

  /**
   * Initialize - no default client since we only support header auth
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing Azure DevOps MCP client manager...');
    console.log('⚠️ Authentication via Azure CLI - ensure "az login" is completed');
  }

  /**
   * Get or create an MCP client for the given authentication context
   */
  async getOrCreateClient(authContext: AuthenticationContext): Promise<MCPClientInstance> {
    if (!authContext.azureDevOpsOrg) {
      throw new Error('Missing required Azure DevOps organization');
    }

    const cacheKey = generateAuthCacheKey(authContext);
    
    // Check if we already have a client for this auth context
    let clientInstance = this.clients.get(cacheKey);
    if (clientInstance && clientInstance.isInitialized) {
      clientInstance.lastUsed = new Date();
      return clientInstance;
    }

    // Create new client based on transport type
    if (authContext.mcpTransportType === 'http') {
      return await this.createHttpClient(authContext, cacheKey);
    } else {
      return await this.createStdioClient(authContext, cacheKey);
    }
  }

  private async createHttpClient(authContext: AuthenticationContext, cacheKey: string): Promise<MCPClientInstance> {
    if (!authContext.mcpServerUrl) {
      throw new Error('MCP server URL is required for HTTP transport');
    }

    console.log(`🌐 Creating HTTP MCP client for ${authContext.azureDevOpsOrg} -> ${authContext.mcpServerUrl}`);

    // Create HTTP transport
    const transport = new StreamableHTTPClientTransport(new URL(authContext.mcpServerUrl), {
      requestInit: {
        headers: {
          'X-Azure-DevOps-Org': authContext.azureDevOpsOrg!,
        }
      }
    });

    // Create client
    const client = new Client(
      {
        name: 'azure-devops-mcp-rest-wrapper',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    try {
      // Connect to the MCP server
      await client.connect(transport);
      console.log(`✅ Connected to HTTP MCP server at ${authContext.mcpServerUrl} for ${authContext.azureDevOpsOrg}`);

      // Wait for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Load tools
      const tools = await this.loadToolsForClient(client);

      // Create client instance
      const clientInstance = {
        client,
        transport,
        tools,
        isInitialized: true,
        lastUsed: new Date()
      };

      // Cache the client
      this.clients.set(cacheKey, clientInstance);
      
      console.log(`🎯 HTTP client for ${authContext.azureDevOpsOrg} loaded with ${tools.length} tools`);
      
      return clientInstance;
    } catch (error) {
      console.error(`Failed to initialize HTTP MCP client for ${authContext.azureDevOpsOrg}:`, error);
      // Clean up on failure
      try {
        await client.close();
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private async createStdioClient(authContext: AuthenticationContext, cacheKey: string): Promise<MCPClientInstance> {
    console.log(`🔧 Creating STDIO MCP client for organization: ${authContext.azureDevOpsOrg}`);
    
    // Build command arguments
    const args = ['-y', '-p', '@azure-devops/mcp', 'mcp-server-azuredevops', authContext.azureDevOpsOrg!];
    
    // Add domains if specified
    const domains = process.env.MCP_DOMAINS?.split(',').map((d: string) => d.trim()).filter(Boolean);
    if (domains && domains.length > 0) {
      args.push('-d', ...domains);
    }

    console.log(`📦 Starting MCP server with command: npx ${args.join(' ')}`);

    // Create environment with authentication context
    const environment: any = {
      ...process.env,
      // Suppress npm notices and warnings
      NPM_CONFIG_UPDATE_NOTIFIER: 'false',
      NPM_CONFIG_FUND: 'false',
      NPM_CONFIG_AUDIT: 'false'
    };

    // Azure authentication - support both CLI and PAT
    // Add PAT token to environment if available for fallback
    if (authContext.azureDevOpsOrg && process.env.AZURE_DEVOPS_TOKEN) {
      environment.AZURE_DEVOPS_TOKEN = process.env.AZURE_DEVOPS_TOKEN;
      environment.AZURE_DEVOPS_ORG = authContext.azureDevOpsOrg;
      console.log('🔑 Using PAT token authentication for MCP server');
    } else {
      console.log('🔑 Using Azure CLI authentication for MCP server');
    }

    // Create transport
    const transport = new StdioClientTransport({
      command: 'npx',
      args: args,
      env: environment
    });

    // Create client
    const client = new Client(
      {
        name: 'azure-devops-mcp-rest-wrapper',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    try {
      // Connect to the MCP server
      await client.connect(transport);
      console.log(`✅ Connected to STDIO MCP server for ${authContext.azureDevOpsOrg}`);

      // Wait for process to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Load tools
      const tools = await this.loadToolsForClient(client);

      // Create client instance
      const clientInstance = {
        client,
        transport,
        tools,
        isInitialized: true,
        lastUsed: new Date()
      };

      // Cache the client
      this.clients.set(cacheKey, clientInstance);
      
      console.log(`🎯 STDIO client for ${authContext.azureDevOpsOrg} loaded with ${tools.length} tools`);
      
      return clientInstance;
    } catch (error) {
      console.error(`Failed to initialize STDIO MCP client for ${authContext.azureDevOpsOrg}:`, error);
      // Clean up on failure
      try {
        await client.close();
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private async loadToolsForClient(client: Client): Promise<MCPTool[]> {
    try {
      console.log('📋 Requesting tools list from MCP server...');
      
      // Load tools using the latest SDK API
      const toolsResponse = await client.listTools();
      
      console.log('📋 Raw tools response:', JSON.stringify(toolsResponse, null, 2));
      const tools = toolsResponse.tools || [];
      console.log(`📋 Parsed ${tools.length} tools`);
      return tools;
    } catch (error) {
      console.error('Failed to load tools:', error);
      throw error;
    }
  }

  async callTool(name: string, arguments_: any, authContext?: AuthenticationContext): Promise<any> {
    let clientInstance: MCPClientInstance;
    
    if (authContext) {
      // Use specific authentication context
      clientInstance = await this.getOrCreateClient(authContext);
    } else {
      throw new Error('Authentication context is required - ensure AZURE_DEVOPS_ORG environment variable is set and Azure CLI is authenticated');
    }

    try {
      const response = await clientInstance.client.callTool({
        name,
        arguments: arguments_ || {}
      });

      return response;
    } catch (error) {
      throw error;
    }
  }

  getTools(authContext?: AuthenticationContext): MCPTool[] {
    if (authContext) {
      const cacheKey = generateAuthCacheKey(authContext);
      const clientInstance = this.clients.get(cacheKey);
      return clientInstance?.tools || [];
    }
    
    return [];
  }

  getTool(name: string, authContext?: AuthenticationContext): MCPTool | undefined {
    const tools = this.getTools(authContext);
    return tools.find(tool => tool.name === name);
  }

  isReady(authContext?: AuthenticationContext): boolean {
    if (authContext) {
      const cacheKey = generateAuthCacheKey(authContext);
      const clientInstance = this.clients.get(cacheKey);
      return clientInstance?.isInitialized || false;
    }
    
    return false;
  }

  async cleanup(): Promise<void> {
    try {
      // Clean up all cached clients
      for (const [key, clientInstance] of this.clients.entries()) {
        try {
          await clientInstance.client.close();
        } catch (error) {
          console.log(`Cleanup error for client ${key}:`, error);
        }
      }

      this.clients.clear();
      
      console.log('✅ All MCP clients cleaned up');
    } catch (error) {
      console.log('Cleanup completed with minor errors (expected)');
    }
  }

  /**
   * Clean up unused clients to free resources
   * Clients not used for more than the specified time will be removed
   */
  async cleanupUnusedClients(maxAgeMinutes: number = 30): Promise<void> {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const keysToRemove: string[] = [];

    for (const [key, clientInstance] of this.clients.entries()) {
      if (clientInstance.lastUsed < cutoffTime) {
        keysToRemove.push(key);
        try {
          await clientInstance.client.close();
        } catch (error) {
          console.log(`Error closing unused client ${key}:`, error);
        }
      }
    }

    for (const key of keysToRemove) {
      this.clients.delete(key);
    }

    if (keysToRemove.length > 0) {
      console.log(`🗑️ Cleaned up ${keysToRemove.length} unused MCP clients`);
    }
  }
}