# NestJS Project Dependencies

## 🏗️ Core Framework
| Library | Purpose |
|---------|---------|
| `@nestjs/core` | NestJS core framework |
| `@nestjs/common` | Common decorators, pipes, guards |
| `@nestjs/platform-express` | Express platform adapter |
| `typescript` | TypeScript support |

## 🗄️ Database & ORM
| Library | Purpose |
|---------|---------|
| `@prisma/client` | Prisma ORM client |
| `prisma` | Database schema management |

## 🔧 Configuration & Environment
| Library | Purpose |
|---------|---------|
| `@nestjs/config` | Environment configuration |

## 📝 Logging
| Library | Purpose |
|---------|---------|
| `winston` | Logging library |
| `nestjs-winston` | Winston integration for NestJS |

## ✅ Validation & Transformation
| Library | Purpose |
|---------|---------|
| `class-validator` | DTO validation decorators |
| `class-transformer` | Object transformation |

## 🛡️ Security & Performance
| Library | Purpose |
|---------|---------|
| `@nestjs/throttler` | Rate limiting |
| `helmet` | Security headers |
| `compression` | Response compression |

## 📚 API Documentation
| Library | Purpose |
|---------|---------|
| `@nestjs/swagger` | OpenAPI/Swagger documentation |

## 🐳 Development & Database
| Library | Purpose |
|---------|---------|
| `docker` | PostgreSQL & Redis containers |
| `postgresql` | Primary database |
| `redis` | Caching & sessions |

## 🔨 Development Tools
| Library | Purpose |
|---------|---------|
| `@nestjs/cli` | NestJS CLI for scaffolding |
| `ts-node` | TypeScript execution |
| `nodemon` | Hot reload in development |

## 🧪 Code Quality
| Library | Purpose |
|---------|---------|
| `eslint` | Code linting |
| `prettier` | Code formatting |
| `@typescript-eslint/parser` | TypeScript ESLint support |

## 📦 Package.json Scripts
```json
{
  "start:dev": "nest start --watch",
  "build": "nest build",
  "start:prod": "node dist/main",
  "db:migrate": "npx prisma migrate dev",
  "db:generate": "npx prisma generate",
  "db:studio": "npx prisma studio",
  "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "format": "prettier --write \"src/**/*.ts\""
}
```

## 🚀 Quick Start
```bash
# Install dependencies
npm install

# Start database
docker-compose up -d

# Run migrations
npm run db:migrate

# Start development server
npm run start:dev
```

## 📋 Features Enabled
- ✅ **Auto-logging** - Winston logs all HTTP/DB/Errors
- ✅ **Auto-validation** - DTO validation on all endpoints
- ✅ **Auto-documentation** - Swagger UI at `/api/docs`
- ✅ **Rate limiting** - 10 requests per minute per IP
- ✅ **Security headers** - Helmet protection
- ✅ **Database ORM** - Prisma with PostgreSQL
- ✅ **Hot reload** - Development auto-restart
- ✅ **Code quality** - ESLint + Prettier

## 🔗 Important URLs
- **API**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/docs
- **Prisma Studio**: http://localhost:5555