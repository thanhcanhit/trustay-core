# Configuration Management

## What it does
Centralized, type-safe configuration management with environment validation using `@nestjs/config` + `joi`.

## Libraries
- `@nestjs/config` - NestJS configuration module
- `joi` - Schema validation for environment variables

## Benefits
- ✅ **Type Safety** - Auto-complete & compile-time checks
- ✅ **Early Validation** - App crashes on startup if config is invalid
- ✅ **Centralized** - All config in one place
- ✅ **Environment Support** - Dev/staging/production configs

## Usage

### Environment Variables (.env)
```env
DATABASE_URL="postgresql://user:pass@host:5432/db"
JWT_SECRET=your-32-character-secret-key
PORT=3000
NODE_ENV=development
```

### In Services
```typescript
constructor(private configService: AppConfigService) {}

// Type-safe access
const port = this.configService.port;           // number
const isDev = this.configService.isDevelopment; // boolean
const dbUrl = this.configService.databaseUrl;   // string
```

### Adding New Config
1. Add to `src/config/configuration.ts`
2. Add validation to `src/config/validation.ts`
3. Add getter to `src/config/config.service.ts`

## File Structure
```
src/config/
├── configuration.ts    # Config schema
├── validation.ts       # Joi validation
├── config.service.ts   # Type-safe getters
└── config.module.ts    # Module setup
```

## Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Minimum 32 characters

## Optional Environment Variables
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (default: development)
- `REDIS_HOST`, `REDIS_PORT` - Redis connection
- `EMAIL_FROM`, `EMAIL_API_KEY` - Email service