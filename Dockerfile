# Build stage
FROM node:lts-alpine3.17 AS build

# Install pnpm
RUN npm install -g pnpm

WORKDIR /usr/src/app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies 
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client and build
RUN pnpm prisma generate && \
    pnpm build

# Production stage  
FROM node:lts-alpine3.17 AS production

# Install curl for health check
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /usr/src/app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install production dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --prod && \
    pnpm prisma generate

# Copy built application from build stage
COPY --from=build --chown=nestjs:nodejs /usr/src/app/dist ./dist

# Copy scripts directory for database setup
COPY --chown=nestjs:nodejs scripts ./scripts

# Copy entrypoint script
COPY --chown=nestjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create logs and uploads directories with proper permissions
RUN mkdir -p logs uploads && \
    chown -R nestjs:nodejs logs uploads && \
    chmod 755 logs uploads

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]