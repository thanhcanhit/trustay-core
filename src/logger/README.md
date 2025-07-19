# Logging System

## What it does

Centralized logging system with file rotation, structured JSON logs, and automatic HTTP/DB request logging using `winston` + `nestjs-winston`.

## Libraries

- `winston` - Logging library with transports & formatting
- `nestjs-winston` - NestJS integration for Winston

## Benefits

- ✅ **Structured Logs** - JSON format for easy parsing
- ✅ **Multiple Outputs** - Console (dev) + Files (prod)
- ✅ **Auto HTTP Logging** - Request/response tracking
- ✅ **File Rotation** - 5MB max, 5 files retained
- ✅ **Error Context** - Stack traces with metadata

## Usage

### In Services

```typescript
constructor(private logger: LoggerService) {}

// Basic logging
this.logger.log('User created successfully', 'UserService');
this.logger.error('Database error', error.stack, 'Database');
this.logger.warn('Rate limit exceeded', 'Security');

// Custom methods
this.logger.logError(error, 'UserService', { userId: 123 });
this.logger.logApiRequest('GET', '/users', 200, 45, 'user123');
```

### Automatic Logging

- **HTTP Requests** - Method, URL, status, duration, user ID
- **Database Queries** - SQL, parameters, execution time (dev only)
- **Errors** - Full stack traces with context
- **App Events** - Startup, shutdown, connections

## Log Levels

```
error -> warn -> info -> debug -> verbose
```

Set via `LOG_LEVEL` environment variable.

## File Structure

```
src/logger/
├── logger.service.ts    # Winston configuration
└── logger.module.ts     # Global module

src/common/
├── interceptors/logging.interceptor.ts  # HTTP logging
└── filters/all-exceptions.filter.ts     # Error logging

logs/
├── error.log      # Errors only
└── combined.log   # All logs
```

## Log Outputs

### Console (Development)

```
2024-01-15 10:30:45 [HTTP] info: API Request {"method":"GET","url":"/users","statusCode":200,"duration":"45ms"}
```

### Files (Production)

```json
{
	"level": "info",
	"message": "API Request",
	"timestamp": "2024-01-15 10:30:45",
	"context": "HTTP",
	"method": "GET",
	"url": "/users",
	"statusCode": 200,
	"duration": "45ms"
}
```

## Configuration

```env
NODE_ENV=development  # Console + file logging
LOG_LEVEL=debug      # Minimum log level
```

## Log Rotation

- **Max file size:** 5MB
- **Max files:** 5 (oldest deleted automatically)
- **Location:** `logs/` directory
