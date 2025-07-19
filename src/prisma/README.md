# Prisma Database

## What it does

Type-safe database ORM with automatic migrations, query generation, and connection management using `prisma` + `@prisma/client`.

## Libraries

- `prisma` - Database toolkit & migration engine
- `@prisma/client` - Type-safe database client

## Benefits

- ✅ **Type Safety** - Auto-generated types from schema
- ✅ **Auto-complete** - IntelliSense for queries
- ✅ **Migrations** - Version-controlled schema changes
- ✅ **Connection Pool** - Automatic connection management
- ✅ **Query Logging** - SQL logging in development

## Usage

### In Services

```typescript
constructor(private prisma: PrismaService) {}

// CRUD operations
const user = await this.prisma.user.create({
  data: { email: 'user@example.com', name: 'John' }
});

const users = await this.prisma.user.findMany({
  where: { active: true },
  include: { posts: true }
});

await this.prisma.user.update({
  where: { id: userId },
  data: { name: 'Updated Name' }
});
```

### Common Commands

```bash
# Generate client after schema changes
npm run db:generate

# Create & run migration
npm run db:migrate

# View database in browser
npm run db:studio

# Reset database
npx prisma migrate reset
```

## File Structure

```
prisma/
├── schema.prisma      # Database schema
└── migrations/        # Migration history

src/prisma/
├── prisma.service.ts  # Connection service
└── prisma.module.ts   # Global module
```

## Schema Example

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]

  @@map("users")
}

model Post {
  id       String @id @default(cuid())
  title    String
  content  String?
  authorId String
  author   User   @relation(fields: [authorId], references: [id])

  @@map("posts")
}
```

## Configuration

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"
```

## Features

- **Auto Connection** - Connects on app start, disconnects on shutdown
- **Query Logging** - SQL queries logged in development mode
- **Error Handling** - Database errors caught and logged
- **Type Generation** - Types auto-generated from schema

## Package.json Scripts

```json
{
	"db:migrate": "npx prisma migrate dev",
	"db:generate": "npx prisma generate",
	"db:studio": "npx prisma studio",
	"db:seed": "ts-node prisma/seed.ts"
}
```
