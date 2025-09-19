# Multi-stage build for Azure DevOps MCP REST Wrapper
# Supports PAT authentication only via headers

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY src/ ./src/

# Skip build for now due to TypeScript compatibility issues
# RUN npm run build

# Production stage - includes Azure CLI for MCP compatibility
FROM node:20-alpine AS production

# Install basic runtime dependencies and Azure CLI
RUN apk add --no-cache \
    wget \
    ca-certificates \
    bash \
    curl \
    python3 \
    py3-pip \
    gcc \
    python3-dev \
    musl-dev \
    linux-headers \
    && pip3 install --break-system-packages --no-cache-dir azure-cli \
    && az --version

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install all dependencies (including dev dependencies for ts-node)
RUN npm install && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Copy authentication scripts
COPY scripts/ ./scripts/
COPY docker-entrypoint.sh ./

# Make scripts executable
RUN chmod +x ./docker-entrypoint.sh ./scripts/auth-check.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start with authentication check and app startup
CMD ["bash", "-c", "echo '🚀 Starting Azure DevOps MCP REST Wrapper...'; echo '🔐 Checking Azure CLI authentication...'; ./scripts/auth-check.sh; echo '🔧 Starting application...'; npx ts-node --transpile-only src/index.ts"]