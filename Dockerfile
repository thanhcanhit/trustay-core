# Build stage
FROM node:lts-alpine3.17 AS build

# Set environment variables to reduce npm/pnpm cache
ENV NODE_ENV=development
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install OpenSSL and pnpm
RUN apk add --no-cache openssl && \
    npm install -g pnpm

WORKDIR /usr/src/app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies with production flag to reduce size
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build the application and verify the output
RUN npm run build && \
    ls -la dist/ && \
    test -f dist/main.js

# Clean up unnecessary files to reduce image size
RUN rm -rf node_modules/.cache && \
    rm -rf node_modules/.pnpm-store && \
    find node_modules -name "*.d.ts" -delete && \
    find node_modules -name "*.map" -delete

# Production stage  
FROM node:lts-alpine3.17 AS production

# Set environment variables
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

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

# Install only production dependencies to reduce size
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

# Generate Prisma client in production
RUN pnpm prisma generate

# Copy built application and necessary files from build stage
COPY --from=build --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /usr/src/app/scripts ./scripts
COPY --from=build --chown=nestjs:nodejs /usr/src/app/data ./data
COPY --from=build --chown=nestjs:nodejs /usr/src/app/prisma/seed.ts ./prisma/seed.ts
COPY --from=build --chown=nestjs:nodejs /usr/src/app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=nestjs:nodejs /usr/src/app/node_modules/.prisma ./node_modules/.prisma

# Verify the main.js file exists
RUN ls -la dist/ && test -f dist/main.js

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