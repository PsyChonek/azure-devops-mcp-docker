import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MCPClientManager } from './mcp-client';
import { extractAuthenticationMiddleware, validateAuthenticationMiddleware } from './auth-middleware';

// Load environment variables
dotenv.config();

class Server {
  private app: express.Application;
  private mcpClient: MCPClientManager;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);
    this.mcpClient = new MCPClientManager();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Add request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
      console.log('Headers:', req.headers);
      if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
      }
      next();
    });

    // CORS configuration
    this.app.use(cors({
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-API-Key',
        'X-MCP-Server-Url',
        'MCP-Server-Url',
        'X-MCP-Transport-Type',
        'MCP-Transport-Type'
      ]
    }));
    
    // Body parsing
    this.app.use(express.json());
    
    // Extract authentication context from headers
    this.app.use(extractAuthenticationMiddleware);
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // MCP Initialize endpoint
    this.app.post('/initialize', (req: Request, res: Response) => {
      res.json({
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'azure-devops-mcp-rest-wrapper',
          version: '1.0.0'
        }
      });
    });

    // MCP HTTP transport endpoint - Server-Sent Events for streaming
    this.app.get('/api/mcp', (req: Request, res: Response) => {
      console.log('SSE connection established');
      
      // Set SSE headers for streaming MCP protocol
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      // Don't send anything initially - wait for POST requests to trigger responses
      
      // Keep connection alive with periodic ping
      const pingInterval = setInterval(() => {
        if (!res.headersSent) {
          try {
            res.write(': ping\n\n');
          } catch (e) {
            clearInterval(pingInterval);
          }
        }
      }, 30000);

      // Store this response object for sending messages back to client
      // In a real implementation, you'd want a proper session management system
      (req as any).sseResponse = res;

      // Handle client disconnect
      req.on('close', () => {
        console.log('SSE connection closed');
        clearInterval(pingInterval);
      });

      req.on('aborted', () => {
        console.log('SSE connection aborted');
        clearInterval(pingInterval);
      });
    });

    // MCP JSON-RPC over HTTP endpoint - handles the actual MCP protocol messages
    this.app.post('/api/mcp', async (req: Request, res: Response) => {
      try {
        const { jsonrpc, method, params, id } = req.body;

        // Validate JSON-RPC format
        if (jsonrpc !== '2.0') {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32600,
              message: 'Invalid Request - jsonrpc must be 2.0'
            }
          });
        }

        switch (method) {
          case 'initialize':
            // For MCP HTTP transport, we need to get auth from request context
            // Since VS Code doesn't send auth headers by default, we'll create a default client
            try {
              // Try to initialize with environment variables if available
              const defaultAuthContext = {
                azureDevOpsOrg: process.env.AZURE_DEVOPS_ORG,
                mcpTransportType: 'stdio' as const
              };

              if (defaultAuthContext.azureDevOpsOrg) {
                await this.mcpClient.getOrCreateClient(defaultAuthContext);
              }

              res.json({
                jsonrpc: '2.0',
                id,
                result: {
                  protocolVersion: '2024-11-05',
                  capabilities: {
                    tools: {}
                  },
                  serverInfo: {
                    name: 'azure-devops-mcp-rest-wrapper',
                    version: '1.0.0'
                  }
                }
              });
            } catch (error: any) {
              res.json({
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32603,
                  message: `Initialization failed: ${error.message}`
                }
              });
            }
            break;

          case 'tools/list':
            try {
              // Get auth context from environment
              let authContext = req.authContext;

              if (!authContext?.azureDevOpsOrg) {
                // Fallback to environment variables
                authContext = {
                  azureDevOpsOrg: process.env.AZURE_DEVOPS_ORG,
                  mcpTransportType: 'stdio' as const
                };
              }

              if (!authContext?.azureDevOpsOrg) {
                return res.json({
                  jsonrpc: '2.0',
                  id,
                  error: {
                    code: -32603,
                    message: 'Missing Azure DevOps organization. Set AZURE_DEVOPS_ORG environment variable and ensure Azure CLI is authenticated (az login).'
                  }
                });
              }

              // Ensure client is available for this auth context
              await this.mcpClient.getOrCreateClient(authContext);
              
              if (!this.mcpClient.isReady(authContext)) {
                return res.json({
                  jsonrpc: '2.0',
                  id,
                  error: {
                    code: -32603,
                    message: 'MCP client not ready'
                  }
                });
              }
              
              const tools = this.mcpClient.getTools(authContext);
              res.json({
                jsonrpc: '2.0',
                id,
                result: {
                  tools: tools
                }
              });
            } catch (error: any) {
              res.json({
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32603,
                  message: error.message
                }
              });
            }
            break;

          case 'tools/call':
            try {
              // Get auth context from environment
              let authContext = req.authContext;

              if (!authContext?.azureDevOpsOrg) {
                // Fallback to environment variables
                authContext = {
                  azureDevOpsOrg: process.env.AZURE_DEVOPS_ORG,
                  mcpTransportType: 'stdio' as const
                };
              }

              if (!authContext?.azureDevOpsOrg) {
                return res.json({
                  jsonrpc: '2.0',
                  id,
                  error: {
                    code: -32603,
                    message: 'Missing Azure DevOps organization. Set AZURE_DEVOPS_ORG environment variable and ensure Azure CLI is authenticated (az login).'
                  }
                });
              }

              // Ensure client is available for this auth context
              await this.mcpClient.getOrCreateClient(authContext);
              
              if (!this.mcpClient.isReady(authContext)) {
                return res.json({
                  jsonrpc: '2.0',
                  id,
                  error: {
                    code: -32603,
                    message: 'MCP client not ready'
                  }
                });
              }

              const { name, arguments: args } = params;
              const tool = this.mcpClient.getTool(name, authContext);
              if (!tool) {
                return res.json({
                  jsonrpc: '2.0',
                  id,
                  error: {
                    code: -32602,
                    message: `Tool '${name}' not found`
                  }
                });
              }

              const result = await this.mcpClient.callTool(name, args || {}, authContext);
              res.json({
                jsonrpc: '2.0',
                id,
                result: {
                  content: result.content || [],
                  isError: result.isError || false
                }
              });
            } catch (error: any) {
              res.json({
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32603,
                  message: error.message
                }
              });
            }
            break;

          default:
            res.json({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Method '${method}' not found`
              }
            });
        }
      } catch (error: any) {
        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32700,
            message: 'Parse error'
          }
        });
      }
    });

    // Get tools count (do not print all tools as requested)
    this.app.get('/api/tools', async (req: Request, res: Response) => {
      try {
        const authContext = req.authContext;
        if (!authContext?.azureDevOpsOrg) {
          return res.status(401).json({
            error: 'Missing Azure DevOps organization. Set AZURE_DEVOPS_ORG environment variable and ensure Azure CLI is authenticated (az login)'
          });
        }

        // Ensure client is available for this auth context
        await this.mcpClient.getOrCreateClient(authContext);
        
        if (!this.mcpClient.isReady(authContext)) {
          return res.status(503).json({ error: 'MCP client not ready' });
        }
        
        const tools = this.mcpClient.getTools(authContext);
        res.json({ 
          toolsCount: tools.length,
          organization: authContext.azureDevOpsOrg,
          message: 'Use /api/tools/list to get full tools list' 
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get full tools list (separate endpoint)
    this.app.get('/api/tools/list', async (req: Request, res: Response) => {
      try {
        const authContext = req.authContext;
        if (!authContext?.azureDevOpsOrg) {
          return res.status(401).json({
            error: 'Missing Azure DevOps organization. Set AZURE_DEVOPS_ORG environment variable and ensure Azure CLI is authenticated (az login)'
          });
        }

        // Ensure client is available for this auth context
        await this.mcpClient.getOrCreateClient(authContext);
        
        if (!this.mcpClient.isReady(authContext)) {
          return res.status(503).json({ error: 'MCP client not ready' });
        }
        
        const tools = this.mcpClient.getTools(authContext);
        res.json({ 
          tools,
          organization: authContext.azureDevOpsOrg
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Call a tool
    this.app.post('/api/tools/:toolName/call', async (req: Request, res: Response) => {
      try {
        const authContext = req.authContext;
        if (!authContext?.azureDevOpsOrg) {
          return res.status(401).json({
            error: 'Missing Azure DevOps organization. Set AZURE_DEVOPS_ORG environment variable and ensure Azure CLI is authenticated (az login)'
          });
        }

        // Ensure client is available for this auth context
        await this.mcpClient.getOrCreateClient(authContext);
        
        if (!this.mcpClient.isReady(authContext)) {
          return res.status(503).json({ error: 'MCP client not ready' });
        }

        const { toolName } = req.params;
        const { arguments: args } = req.body;

        const tool = this.mcpClient.getTool(toolName, authContext);
        if (!tool) {
          return res.status(404).json({ error: `Tool '${toolName}' not found` });
        }

        const result = await this.mcpClient.callTool(toolName, args || {}, authContext);
        res.json({ 
          success: true, 
          data: result,
          organization: authContext.azureDevOpsOrg
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Batch tool execution
    this.app.post('/api/tools/batch', async (req: Request, res: Response) => {
      try {
        const authContext = req.authContext;
        if (!authContext?.azureDevOpsOrg) {
          return res.status(401).json({
            error: 'Missing Azure DevOps organization. Set AZURE_DEVOPS_ORG environment variable and ensure Azure CLI is authenticated (az login)'
          });
        }

        // Ensure client is available for this auth context
        await this.mcpClient.getOrCreateClient(authContext);
        
        if (!this.mcpClient.isReady(authContext)) {
          return res.status(503).json({ error: 'MCP client not ready' });
        }

        const { tools } = req.body;
        if (!Array.isArray(tools)) {
          return res.status(400).json({ error: 'Request body must contain a "tools" array' });
        }

        const results = [];
        for (const toolCall of tools) {
          try {
            const { name, arguments: args } = toolCall;
            const tool = this.mcpClient.getTool(name, authContext);
            
            if (!tool) {
              results.push({
                toolName: name,
                success: false,
                error: `Tool '${name}' not found`
              });
              continue;
            }

            const result = await this.mcpClient.callTool(name, args || {}, authContext);
            results.push({
              toolName: name,
              success: true,
              data: result
            });
          } catch (error: any) {
            results.push({
              toolName: toolCall.name,
              success: false,
              error: error.message
            });
          }
        }

        res.json({ 
          success: true,
          results,
          organization: authContext.azureDevOpsOrg
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // 404 handler - Express v5 compatible
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Route not found' });
    });
  }

  public async start(): Promise<void> {
    try {
      // Initialize MCP client manager (creates default client if env vars are available)
      await this.mcpClient.initialize();
      
      // Start periodic cleanup of unused clients (every 15 minutes)
      setInterval(() => {
        this.mcpClient.cleanupUnusedClients(30).catch(error => {
          console.error('Error during client cleanup:', error);
        });
      }, 15 * 60 * 1000);
      
      // Start server
      this.app.listen(this.port, () => {
        console.log(`🚀 Server started on port ${this.port}`);
        console.log(`📊 Health check: http://localhost:${this.port}/health`);
        console.log(`🔧 Tools: http://localhost:${this.port}/api/tools`);
        console.log(`🌐 MCP Endpoint: http://localhost:${this.port}/api/mcp`);
        console.log(`🔐 Authentication: Azure CLI (ensure 'az login' is completed)`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    await this.mcpClient.cleanup();
  }
}

export default Server;