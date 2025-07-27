# 🔐 Trustay Authentication System

Hệ thống xác thực JWT được xây dựng với NestJS, Passport và bcryptjs cho ứng dụng Trustay.

## 📋 Mục lục

- [Tổng quan](#tổng-quan)
- [Cài đặt](#cài-đặt)
- [Cấu hình](#cấu-hình)
- [API Endpoints](#api-endpoints)
- [Sử dụng Authentication](#sử-dụng-authentication)
- [Kiến trúc](#kiến-trúc)
- [Bảo mật](#bảo-mật)
- [Ví dụ](#ví-dụ)

## 🎯 Tổng quan

Hệ thống authentication của Trustay cung cấp:

- ✅ **Đăng ký người dùng** với mã hóa mật khẩu
- ✅ **Đăng nhập** với JWT token
- ✅ **Bảo vệ routes** với JWT Guard
- ✅ **Quản lý session** với token validation
- ✅ **Current user context** trong controllers
- ✅ **Role-based access** (tenant, landlord)

## 📦 Cài đặt

```bash
# Các dependencies đã được cài đặt
pnpm add @nestjs/passport @nestjs/jwt passport passport-jwt bcryptjs
pnpm add -D @types/passport-jwt
```

## ⚙️ Cấu hình

### Environment Variables

Thêm vào file `.env`:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-complex
JWT_EXPIRES_IN=1h

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/trustay_db"
```

### Module Configuration

Auth module đã được cấu hình tự động với:
- JWT strategy
- Passport integration  
- Prisma database connection
- ConfigService để đọc environment variables

## 🚀 API Endpoints

### Authentication Endpoints

#### 1. Đăng ký người dùng
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "Nguyễn",
  "lastName": "Văn A",
  "phone": "+84901234567",
  "gender": "male",
  "role": "tenant"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx123456789",
    "email": "user@example.com",
    "firstName": "Nguyễn",
    "lastName": "Văn A",
    "role": "tenant",
    ...
  },
  "token_type": "Bearer",
  "expires_in": 3600
}
```

#### 2. Đăng nhập
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### 3. Lấy thông tin user hiện tại
```http
GET /api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Protected User Endpoints

Tất cả endpoints dưới đây yêu cầu JWT token trong header:

```http
Authorization: Bearer <jwt_token>
```

#### Profile Management
- `GET /api/users/profile` - Lấy thông tin profile
- `PUT /api/users/profile` - Cập nhật profile

#### Address Management  
- `POST /api/users/addresses` - Tạo địa chỉ mới
- `PUT /api/users/addresses/:id` - Cập nhật địa chỉ
- `DELETE /api/users/addresses/:id` - Xóa địa chỉ

#### Verification
- `POST /api/users/verify-phone` - Xác thực số điện thoại
- `POST /api/users/verify-email` - Xác thực email
- `POST /api/users/verify-identity` - Xác thực danh tính

### Role System

Hệ thống có 2 loại người dùng chính:
- **tenant** - Người thuê trọ 
- **landlord** - Chủ nhà cho thuê

Role được yêu cầu bắt buộc khi đăng ký và quyết định quyền truy cập trong hệ thống.

## 🔧 Sử dụng Authentication

### 1. Trong Controllers

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('api/example')
@UseGuards(JwtAuthGuard) // Bảo vệ toàn bộ controller
export class ExampleController {
  
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    // user chứa thông tin từ JWT payload
    console.log('Current user ID:', user.id);
    console.log('Current user email:', user.email);
    console.log('Current user role:', user.role);
    
    return { message: `Hello ${user.firstName}!` };
  }
  
  @Post('data')
  async createData(
    @CurrentUser() user: any,
    @Body() createDataDto: CreateDataDto
  ) {
    // Tự động lấy user ID từ JWT token
    return this.exampleService.createData(user.id, createDataDto);
  }
}
```

### 2. Bảo vệ specific routes

```typescript
@Controller('api/example')
export class ExampleController {
  
  @Get('public')
  async publicEndpoint() {
    // Endpoint công khai, không cần auth
    return { message: 'This is public' };
  }
  
  @Get('private')
  @UseGuards(JwtAuthGuard) // Chỉ bảo vệ route này
  async privateEndpoint(@CurrentUser() user: any) {
    return { message: 'This is private', user: user.email };
  }
}
```

### 3. Frontend Integration

#### Đăng ký
```javascript
const register = async (userData) => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData)
  });
  
  const data = await response.json();
  
  if (response.ok) {
    // Lưu token vào localStorage hoặc cookie
    localStorage.setItem('access_token', data.access_token);
    return data.user;
  } else {
    throw new Error(data.message);
  }
};
```

#### Đăng nhập
```javascript
const login = async (email, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (response.ok) {
    localStorage.setItem('access_token', data.access_token);
    return data.user;
  } else {
    throw new Error(data.message);
  }
};
```

#### Gọi protected APIs
```javascript
const getProfile = async () => {
  const token = localStorage.getItem('access_token');
  
  const response = await fetch('/api/users/profile', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  });
  
  if (response.ok) {
    return await response.json();
  } else if (response.status === 401) {
    // Token hết hạn hoặc không hợp lệ
    localStorage.removeItem('access_token');
    // Redirect to login
  }
};
```

## 🏗️ Kiến trúc

### File Structure
```
src/auth/
├── decorators/
│   └── current-user.decorator.ts    # Decorator để lấy user hiện tại
├── dto/
│   ├── auth-response.dto.ts         # Response format cho auth
│   ├── login.dto.ts                 # Validation cho login
│   └── register.dto.ts              # Validation cho register
├── guards/
│   └── jwt-auth.guard.ts            # JWT authentication guard
├── strategies/
│   └── jwt.strategy.ts              # Passport JWT strategy
├── auth.controller.ts               # Auth endpoints
├── auth.module.ts                   # Auth module configuration
└── auth.service.ts                  # Auth business logic
```

### JWT Payload Structure
```typescript
interface JwtPayload {
  sub: string;    // User ID
  email: string;  // User email
  role: string;   // User role (tenant, landlord)
}
```

### User Object (từ @CurrentUser())
```typescript
interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'tenant' | 'landlord';
  isVerifiedEmail: boolean;
  isVerifiedPhone: boolean;
  isVerifiedIdentity: boolean;
  isVerifiedBank: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## 🛡️ Bảo mật

### Password Security
- **Hashing**: bcryptjs với salt rounds = 10
- **Validation**: Minimum 6 characters required
- **Storage**: Chỉ lưu password hash, không lưu plain text

### JWT Security
- **Secret**: Sử dụng environment variable cho JWT_SECRET
- **Expiration**: Default 1 hour, có thể cấu hình qua JWT_EXPIRES_IN
- **Validation**: Verify signature và expiration time
- **Stateless**: Không lưu session server-side

### API Security
- **Protected Routes**: Tất cả user endpoints yêu cầu valid JWT
- **User Context**: Tự động inject user info từ token
- **Error Handling**: Proper error responses cho unauthorized access

### Best Practices Implemented
- ✅ Environment-based configuration
- ✅ Proper error handling
- ✅ Input validation với class-validator
- ✅ Swagger documentation
- ✅ Separation of concerns (admin vs user routes)

## 📝 Ví dụ sử dụng

### 1. Đăng ký và đăng nhập flow

```typescript
// 1. Đăng ký
const newUser = {
  email: "tenant@example.com",
  password: "securepassword123",
  firstName: "Minh",
  lastName: "Nguyễn",
  phone: "+84901234567",
  role: "tenant"
};

const authResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newUser)
});

const { access_token, user } = await authResponse.json();

// 2. Sử dụng token để access protected endpoints
const profile = await fetch('/api/users/profile', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
```

### 2. Tạo protected controller

```typescript
@Controller('api/bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingsController {
  
  @Post()
  async createBooking(
    @CurrentUser() user: any,
    @Body() createBookingDto: CreateBookingDto
  ) {
    // Tự động có user.id từ JWT token
    return this.bookingsService.create(user.id, createBookingDto);
  }
  
  @Get('my-bookings')
  async getMyBookings(@CurrentUser() user: any) {
    // Chỉ lấy bookings của user hiện tại
    return this.bookingsService.findByUserId(user.id);
  }
}
```

### 3. Role-based access (Future enhancement)

```typescript
// Có thể mở rộng thêm role guard
@Controller('api/admin')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('landlord', 'admin')
export class AdminController {
  // Chỉ landlord hoặc admin mới access được
}
```

## 🔄 Next Steps

Để mở rộng hệ thống authentication:

1. **Role Guards**: Implement role-based access control
2. **Refresh Tokens**: Add token refresh mechanism
3. **Password Reset**: Email-based password reset flow
4. **2FA**: Two-factor authentication
5. **Social Login**: Google, Facebook OAuth integration
6. **Rate Limiting**: Prevent brute force attacks
7. **Session Management**: Track active sessions

## 🚨 Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Kiểm tra JWT token có trong header không
   - Verify token chưa expire
   - Đảm bảo JWT_SECRET đúng

2. **JWT malformed**
   - Token format phải là `Bearer <token>`
   - Kiểm tra token không bị truncate

3. **User not found**
   - User có thể đã bị xóa sau khi token được issue
   - Implement proper error handling

### Debug Tips

```typescript
// Thêm logging trong JWT strategy
async validate(payload: JwtPayload) {
  console.log('JWT Payload:', payload);
  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub }
  });
  console.log('Found user:', user?.email);
  return user;
}
```

---

**Được phát triển bởi Trustay Team** 🏠