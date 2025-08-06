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

# Debug: Check if main.js exists in the correct location
if [ -f "dist/main.js" ]; then
    echo "✅ dist/main.js exists"
else
    echo "❌ dist/main.js does not exist"
    exit 1
fi

# Run database migrations
echo "Running database migrations..."

# Check if we should force baseline resolution
if [ "$FORCE_MIGRATION_BASELINE" = "true" ]; then
    echo "🔧 FORCE_MIGRATION_BASELINE is set - attempting to resolve migrations as applied..."
    
    # Get the migration name from the migrations directory
    MIGRATION_NAME=$(ls -1 prisma/migrations/ | grep -v migration_lock.toml | head -1)
    
    if [ -n "$MIGRATION_NAME" ]; then
        echo "📝 Marking migration '$MIGRATION_NAME' as applied..."
        npx prisma migrate resolve --applied "$MIGRATION_NAME" || echo "⚠️ Migration resolve failed, continuing..."
    fi
fi

if npx prisma migrate deploy; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migrations failed, checking if it's a baseline issue..."
    
    # Check if the error is P3005 (database not empty)
    if npx prisma migrate deploy 2>&1 | grep -q "P3005"; then
        echo "🔧 Detected P3005 error - attempting to resolve by marking migrations as applied..."
        
        # Get the migration name from the migrations directory
        MIGRATION_NAME=$(ls -1 prisma/migrations/ | grep -v migration_lock.toml | head -1)
        
        if [ -n "$MIGRATION_NAME" ]; then
            echo "📝 Marking migration '$MIGRATION_NAME' as applied..."
            if npx prisma migrate resolve --applied "$MIGRATION_NAME"; then
                echo "✅ Migration marked as applied successfully"
                
                # Try to run migrate deploy again
                echo "🔄 Retrying database migrations..."
                if npx prisma migrate deploy; then
                    echo "✅ Database migrations completed successfully after baseline"
                else
                    echo "❌ Database migrations still failed after baseline attempt"
                    exit 1
                fi
            else
                echo "❌ Failed to mark migration as applied"
                exit 1
            fi
        else
            echo "❌ No migration found to mark as applied"
            exit 1
        fi
    else
        echo "❌ Database migrations failed with non-baseline error"
        exit 1
    fi
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