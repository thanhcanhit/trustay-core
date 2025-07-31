# Build stage
FROM node:lts-alpine3.17 AS build

# Install OpenSSL and pnpm
RUN apk add --no-cache openssl && \
    npm install -g pnpm

WORKDIR /usr/src/app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build the application
RUN pnpm build

# Production stage  
FROM node:lts-alpine3.17 AS production

# Install OpenSSL and pnpm
RUN apk add --no-cache openssl && \
    npm install -g pnpm

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /usr/src/app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install all dependencies for seed command
RUN pnpm install --frozen-lockfile && pnpm store prune

# Generate Prisma client in production
RUN pnpm prisma generate

# Copy built application from build stage
COPY --from=build --chown=nestjs:nodejs /usr/src/app/dist ./dist

# Copy scripts and data files needed for database operations
COPY --from=build --chown=nestjs:nodejs /usr/src/app/scripts ./scripts
COPY --from=build --chown=nestjs:nodejs /usr/src/app/data ./data
COPY --from=build --chown=nestjs:nodejs /usr/src/app/prisma/seed.ts ./prisma/seed.ts

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R nestjs:nodejs logs

# Copy entrypoint script
COPY --chown=nestjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]