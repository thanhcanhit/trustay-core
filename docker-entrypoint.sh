#!/bin/sh
set -e

echo "Starting application deployment..."

# Debug: Show current directory and contents
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la

# Debug: Check if dist directory exists
if [ -d "dist" ]; then
    echo "✅ dist directory exists"
    echo "dist directory contents:"
    ls -la dist/
else
    echo "❌ dist directory does not exist"
    exit 1
fi

# Debug: Check if dist/src directory exists
if [ -d "dist/src" ]; then
    echo "✅ dist/src directory exists"
    echo "dist/src directory contents:"
    ls -la dist/src/
else
    echo "❌ dist/src directory does not exist"
    exit 1
fi

# Debug: Check if main.js exists in the correct location
if [ -f "dist/src/main.js" ]; then
    echo "✅ dist/src/main.js exists"
else
    echo "❌ dist/src/main.js does not exist"
    exit 1
fi

# Run database migrations
echo "Running database migrations..."
if npx prisma migrate deploy; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migrations failed"
    exit 1
fi

# Run database seeding (optional)
if [ "$NODE_ENV" != "production" ] || [ "$RUN_SEED" = "true" ]; then
    echo "Running database seeding..."
    if npx prisma db seed; then
        echo "✅ Database seeding completed successfully"
    else
        echo "⚠️ Database seeding failed, but continuing..."
    fi
fi

# Start the application
echo "Starting NestJS application..."
exec node dist/src/main.js