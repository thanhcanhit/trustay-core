#!/bin/sh
set -e

echo "Starting application deployment..."

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
exec node dist/main.js