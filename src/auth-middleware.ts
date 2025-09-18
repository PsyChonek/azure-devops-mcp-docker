import { Request, Response, NextFunction } from 'express';

export interface AuthenticationContext {
  azureDevOpsOrg?: string;
  // HTTP transport configuration
  mcpServerUrl?: string;
  mcpTransportType?: 'stdio' | 'http';
}

// Extend Express Request interface to include authentication context
declare global {
  namespace Express {
    interface Request {
      authContext?: AuthenticationContext;
    }
  }
}

/**
 * Middleware to extract Azure DevOps configuration from environment
 * Uses Azure CLI for authentication
 */
export function extractAuthenticationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authContext: AuthenticationContext = {};

  // Get organization from environment variable
  authContext.azureDevOpsOrg = process.env.AZURE_DEVOPS_ORG;

  // Extract MCP server configuration from headers (optional for HTTP transport)
  authContext.mcpServerUrl =
    req.headers['x-mcp-server-url'] as string ||
    req.headers['mcp-server-url'] as string;

  authContext.mcpTransportType =
    (req.headers['x-mcp-transport-type'] as 'stdio' | 'http') ||
    (req.headers['mcp-transport-type'] as 'stdio' | 'http') ||
    'stdio'; // default to stdio

  // Attach to request for use in routes
  req.authContext = authContext;

  next();
}

/**
 * Middleware to validate that required configuration is present
 * Validates organization is configured (authentication handled by Azure CLI)
 */
export function validateAuthenticationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authContext = req.authContext;

  if (!authContext?.azureDevOpsOrg) {
    res.status(401).json({
      error: {
        message: 'Missing Azure DevOps organization. Set AZURE_DEVOPS_ORG environment variable and ensure Azure CLI is authenticated (az login)',
        statusCode: 401,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // For HTTP transport, validate that URL is provided
  if (authContext.mcpTransportType === 'http' && !authContext.mcpServerUrl) {
    res.status(400).json({
      error: {
        message: 'MCP server URL is required when using HTTP transport. Provide header: X-MCP-Server-Url',
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  next();
}

/**
 * Generate a cache key for the authentication context
 * Used to cache MCP client instances based on configuration
 */
export function generateAuthCacheKey(authContext: AuthenticationContext): string {
  const parts = [
    authContext.azureDevOpsOrg || '',
    authContext.mcpTransportType || 'stdio',
    authContext.mcpServerUrl || ''
  ];

  return parts.join('|');
}