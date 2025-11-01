# Change Email API Documentation

Tài liệu API đổi email với xác thực OTP 2 bước.

## 📋 Tổng Quan

API cho phép người dùng đã đăng nhập thay đổi địa chỉ email với quy trình xác thực 2 bước:
1. **Request Change Email**: Gửi OTP đến email mới
2. **Confirm Change Email**: Xác thực OTP và cập nhật email

---

## 🔄 Flow Hoạt Động

```
┌─────────────┐
│   User      │
│ (Logged in) │
└──────┬──────┘
       │
       ├─ POST /users/request-change-email
       │  • newEmail: "new@example.com"
       │  • password: "current_password"
       │
       ▼
┌──────────────┐
│   System     │
│ 1. Verify    │
│    password  │
│ 2. Check     │
│    email     │
│    available │
│ 3. Generate  │
│    OTP       │
│ 4. Send to   │
│    new email │
└──────┬───────┘
       │
       │ ✉️ OTP: 123456
       │ (expires in 10 min)
       │
       ▼
┌──────────────┐
│  New Email   │
│  Inbox       │
└──────┬───────┘
       │
       │ User enters OTP
       │
       ├─ POST /users/confirm-change-email
       │  • newEmail: "new@example.com"
       │  • verificationCode: "123456"
       │
       ▼
┌──────────────┐
│   System     │
│ 1. Verify    │
│    OTP       │
│ 2. Update    │
│    email     │
│ 3. Send      │
│    notification
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Email        │
│ Changed! ✓   │
└──────────────┘
```

---

## 🔐 Endpoints

### Base URL
```
/api/users
```

### Authentication
Cả 2 endpoints đều yêu cầu JWT Bearer Token:
```
Authorization: Bearer <access_token>
```

---

## 1️⃣ Request Change Email

### `POST /users/request-change-email`

**Mô tả**: Bước 1 - Yêu cầu đổi email và nhận OTP tại email mới

**Request Body**:
```typescript
{
  newEmail: string;      // Email mới (phải hợp lệ)
  password: string;      // Password hiện tại
}
```

**Example Request**:
```bash
curl -X POST https://api.trustay.com/users/request-change-email \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "newEmail": "john.new@example.com",
    "password": "MySecurePass123!"
  }'
```

**Response Success (200)**:
```json
{
  "message": "Verification code sent to new email address",
  "newEmail": "john.new@example.com",
  "expiresInMinutes": 10
}
```

**Response Errors**:

#### 400 - Invalid Password
```json
{
  "statusCode": 400,
  "message": "Invalid password",
  "error": "Bad Request"
}
```

#### 400 - Same Email
```json
{
  "statusCode": 400,
  "message": "New email must be different from current email",
  "error": "Bad Request"
}
```

#### 404 - User Not Found
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

#### 409 - Email Already In Use
```json
{
  "statusCode": 409,
  "message": "Email is already in use",
  "error": "Conflict"
}
```

---

## 2️⃣ Confirm Change Email

### `POST /users/confirm-change-email`

**Mô tả**: Bước 2 - Xác thực OTP và hoàn tất việc đổi email

**Request Body**:
```typescript
{
  newEmail: string;          // Email mới (phải trùng với bước 1)
  verificationCode: string;  // OTP 6 chữ số
}
```

**Example Request**:
```bash
curl -X POST https://api.trustay.com/users/confirm-change-email \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "newEmail": "john.new@example.com",
    "verificationCode": "123456"
  }'
```

**Response Success (200)**:
```json
{
  "message": "Email changed successfully",
  "user": {
    "id": "user-abc-123",
    "email": "john.new@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isVerifiedEmail": true
  }
}
```

**Response Errors**:

#### 400 - Invalid Code
```json
{
  "statusCode": 400,
  "message": "Invalid verification code",
  "error": "Bad Request"
}
```

#### 400 - Expired Code
```json
{
  "statusCode": 400,
  "message": "Verification code has expired",
  "error": "Bad Request"
}
```

#### 400 - Max Attempts
```json
{
  "statusCode": 400,
  "message": "Maximum verification attempts exceeded",
  "error": "Bad Request"
}
```

#### 404 - User Not Found
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

#### 409 - Email Taken
```json
{
  "statusCode": 409,
  "message": "Email is already in use",
  "error": "Conflict"
}
```

---

## 🔒 Bảo Mật

### 1. Xác Thực Password
- Yêu cầu password hiện tại ở bước 1
- Password được hash bằng bcrypt
- Đảm bảo chỉ chủ tài khoản mới đổi được email

### 2. OTP Security
- **Độ dài**: 6 chữ số (100,000 - 999,999)
- **Hết hạn**: 10 phút
- **Max attempts**: 5 lần thử
- **One-time use**: Mỗi OTP chỉ dùng 1 lần

### 3. Email Validation
- Kiểm tra format email hợp lệ
- Email mới phải khác email hiện tại
- Email mới không bị trùng với user khác
- Kiểm tra lại availability trước khi update

### 4. Rate Limiting (Khuyến nghị)
- Giới hạn số lần request trong 1 khoảng thời gian
- Ví dụ: 3 lần/giờ hoặc 5 lần/ngày

### 5. Notification
- Tự động gửi thông báo khi email thay đổi
- Giúp phát hiện nếu có thay đổi trái phép

---

## 📱 Use Cases

### ✅ Use Case 1: Đổi Email Thành Công

**Scenario**: User muốn đổi từ `old@example.com` sang `new@example.com`

**Bước 1**: Request OTP
```http
POST /users/request-change-email
Authorization: Bearer <token>

{
  "newEmail": "new@example.com",
  "password": "MyPassword123!"
}
```

**Response**:
```json
{
  "message": "Verification code sent to new email address",
  "newEmail": "new@example.com",
  "expiresInMinutes": 10
}
```

**Bước 2**: User check email `new@example.com` và nhận OTP: `654321`

**Bước 3**: Confirm với OTP
```http
POST /users/confirm-change-email
Authorization: Bearer <token>

{
  "newEmail": "new@example.com",
  "verificationCode": "654321"
}
```

**Response**:
```json
{
  "message": "Email changed successfully",
  "user": {
    "id": "user-123",
    "email": "new@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isVerifiedEmail": true
  }
}
```

✅ **Kết quả**: Email đã được đổi thành công!

---

### ❌ Use Case 2: OTP Hết Hạn

**Scenario**: User nhập OTP sau 10 phút

```http
POST /users/confirm-change-email
Authorization: Bearer <token>

{
  "newEmail": "new@example.com",
  "verificationCode": "654321"
}
```

**Response** (400):
```json
{
  "statusCode": 400,
  "message": "Verification code has expired",
  "error": "Bad Request"
}
```

**Giải pháp**: User phải request OTP mới bằng cách gọi lại bước 1

---

### ❌ Use Case 3: Nhập Sai OTP

**Scenario**: User nhập sai OTP 5 lần liên tiếp

Lần thử 1-4: Mỗi lần sai, `attempts` tăng lên

Lần thử 5:
```http
POST /users/confirm-change-email
Authorization: Bearer <token>

{
  "newEmail": "new@example.com",
  "verificationCode": "999999"
}
```

**Response** (400):
```json
{
  "statusCode": 400,
  "message": "Maximum verification attempts exceeded",
  "error": "Bad Request"
}
```

**Giải pháp**: User phải request OTP mới

---

### ⚠️ Use Case 4: Email Bị Trùng

**Scenario**: Trong lúc chờ OTP, có user khác đăng ký email đó

```http
POST /users/confirm-change-email
Authorization: Bearer <token>

{
  "newEmail": "taken@example.com",
  "verificationCode": "123456"
}
```

**Response** (409):
```json
{
  "statusCode": 409,
  "message": "Email is already in use",
  "error": "Conflict"
}
```

**Giải pháp**: User phải chọn email khác

---

## 💻 Frontend Integration

### React/TypeScript Example

```typescript
import axios from 'axios';

const API_URL = 'https://api.trustay.com';
const getAuthHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('access_token')}`,
});

// Step 1: Request change email
export const requestChangeEmail = async (
  newEmail: string,
  password: string
) => {
  try {
    const response = await axios.post(
      `${API_URL}/users/request-change-email`,
      { newEmail, password },
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || 'Request failed');
    }
    throw error;
  }
};

// Step 2: Confirm change email
export const confirmChangeEmail = async (
  newEmail: string,
  verificationCode: string
) => {
  try {
    const response = await axios.post(
      `${API_URL}/users/confirm-change-email`,
      { newEmail, verificationCode },
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || 'Confirmation failed');
    }
    throw error;
  }
};

// Usage in component
const ChangeEmailForm = () => {
  const [step, setStep] = React.useState(1);
  const [newEmail, setNewEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleRequestOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await requestChangeEmail(newEmail, password);
      setStep(2);
      alert('OTP đã được gửi đến email mới!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await confirmChangeEmail(newEmail, otp);
      alert('Đổi email thành công!');
      console.log('Updated user:', result.user);
      // Update user info in app state
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {step === 1 ? (
        <div>
          <h2>Đổi Email - Bước 1</h2>
          <input
            type="email"
            placeholder="Email mới"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password hiện tại"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={handleRequestOtp} disabled={loading}>
            {loading ? 'Đang gửi...' : 'Gửi OTP'}
          </button>
        </div>
      ) : (
        <div>
          <h2>Đổi Email - Bước 2</h2>
          <p>OTP đã được gửi đến: {newEmail}</p>
          <input
            type="text"
            placeholder="Nhập mã OTP"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Đang xác nhận...' : 'Xác nhận'}
          </button>
          <button onClick={() => setStep(1)}>Quay lại</button>
        </div>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};
```

---

## 🧪 Testing

### Postman Collection

```json
{
  "info": {
    "name": "Change Email API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Request Change Email",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"newEmail\": \"newemail@example.com\",\n  \"password\": \"YourPassword123!\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/users/request-change-email",
          "host": ["{{base_url}}"],
          "path": ["users", "request-change-email"]
        }
      }
    },
    {
      "name": "2. Confirm Change Email",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"newEmail\": \"newemail@example.com\",\n  \"verificationCode\": \"123456\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/users/confirm-change-email",
          "host": ["{{base_url}}"],
          "path": ["users", "confirm-change-email"]
        }
      }
    }
  ]
}
```

### Manual Test Steps

1. **Login** và lấy access token
2. **Request OTP**: 
   - Call `POST /users/request-change-email`
   - Check console log để lấy OTP (development mode)
3. **Confirm OTP**:
   - Call `POST /users/confirm-change-email` với OTP
   - Verify email đã được update trong database
4. **Test Error Cases**:
   - ❌ Password sai
   - ❌ Email trùng current
   - ❌ Email đã có user khác
   - ❌ OTP sai
   - ❌ OTP hết hạn (đợi 10 phút)
   - ❌ Vượt quá 5 lần thử

---

## 📊 Database Schema

### Table: `verification_code`

```sql
CREATE TABLE verification_code (
  id            VARCHAR(36) PRIMARY KEY,
  email         VARCHAR(255),
  phone         VARCHAR(20),
  type          ENUM('email', 'phone'),
  code          VARCHAR(6),
  status        ENUM('pending', 'verified', 'expired', 'failed'),
  expires_at    TIMESTAMP,
  attempts      INT DEFAULT 0,
  max_attempts  INT DEFAULT 5,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 🚀 Deployment Notes

### Development
- OTP được log ra console
- `console.log("[DEV] Verification code for ${email}: ${code}")`

### Production
- **TODO**: Integrate email service (SendGrid, AWS SES, etc.)
- Replace console.log với email sending logic
- Configure email templates
- Setup SMTP or email API credentials

### Environment Variables
```env
# Email Service
EMAIL_SERVICE=sendgrid
EMAIL_FROM=noreply@trustay.com
SENDGRID_API_KEY=your_api_key

# OTP Settings
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5
```

---

## ❓ FAQ

**Q: OTP có thời gian hết hạn bao lâu?**  
A: 10 phút

**Q: Có thể thử OTP bao nhiêu lần?**  
A: Tối đa 5 lần

**Q: Nếu OTP hết hạn hoặc hết lượt thử thì sao?**  
A: Phải request OTP mới bằng cách gọi lại endpoint request-change-email

**Q: Có thể đổi về email cũ không?**  
A: Có, nhưng phải qua quy trình xác thực tương tự

**Q: Email mới có cần verify lại không?**  
A: Không, sau khi confirm OTP thành công, `isVerifiedEmail` tự động = true

**Q: Có bị logout sau khi đổi email không?**  
A: Không, JWT token vẫn còn hiệu lực

**Q: Có thể đổi email khi đang có hợp đồng thuê không?**  
A: Có, việc đổi email không ảnh hưởng đến rentals

---

## 📞 Support

Nếu có vấn đề, liên hệ:
- Email: support@trustay.com
- Documentation: https://docs.trustay.com
- GitHub Issues: https://github.com/trustay/api/issues
