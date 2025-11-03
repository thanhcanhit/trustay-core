# Roommate Invite Flow - Frontend Implementation

Tài liệu hướng dẫn implement flow mời người ở ghép cho frontend.

## Tổng quan

Flow này cho phép:
1. **Người A** (có rental) tạo invite link và chia sẻ
2. **Người B** (nhận link) chấp nhận invite và tạo application tự động
3. Sử dụng lại flow application hiện tại (approve → confirm → tạo rental)

## Flow Diagram

```
┌─────────────┐
│  Người A    │
│ (có rental) │
└──────┬──────┘
       │
       │ 1. Generate Invite Link
       │ POST /roommate-applications/generate-invite-link
       │
       ▼
┌─────────────────────┐
│  Nhận invite link   │
│  {FRONTEND_URL}/    │
│  invite?token=xxx   │
└──────┬──────────────┘
       │
       │ Share link với Người B
       │
       ▼
┌─────────────┐
│  Người B    │
│ (nhận link) │
└──────┬──────┘
       │
       │ 2. Accept Invite
       │ POST /roommate-applications/accept-invite
       │
       ▼
┌─────────────────────┐
│ Application created │
│ (auto-created post) │
└──────┬──────────────┘
       │
       │ 3. Existing Flow
       │ Tenant approve → Landlord approve → Applicant confirm
       │
       ▼
┌─────────────┐
│ Rental created│
└─────────────┘
```

## API Endpoints

### 1. Generate Invite Link

**Endpoint:** `POST /api/roommate-applications/generate-invite-link`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response:**
```typescript
{
  inviteLink: string;              // Full URL: {FRONTEND_URL}/invite?token=xxx
  token: string;                   // JWT token
  rentalId: string;                // ID của rental hiện tại
  roommateSeekingPostId?: string; // ID của post (nếu có)
  expiresAt: string;               // ISO date string
}
```

**Error Cases:**
- `400`: User chưa có phòng thuê active
- `401`: Chưa xác thực

### 2. Accept Invite

**Endpoint:** `POST /api/roommate-applications/accept-invite`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Body:**
```typescript
{
  token: string;                    // Token từ invite link
  fullName: string;                  // Bắt buộc
  phoneNumber: string;               // Bắt buộc
  moveInDate: string;                // ISO date string, bắt buộc
  occupation?: string;              // Tùy chọn
  intendedStayMonths?: number;      // Tùy chọn
  applicationMessage?: string;      // Tùy chọn
  isUrgent?: boolean;               // Tùy chọn
}
```

**Response:**
```typescript
{
  id: string;
  roommateSeekingPostId: string;
  applicantId: string;
  fullName: string;
  occupation?: string;
  phoneNumber: string;
  moveInDate: string;
  intendedStayMonths?: number;
  applicationMessage?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'awaiting_confirmation' | 'cancelled' | 'expired';
  // ... other fields
}
```

**Error Cases:**
- `400`: Dữ liệu không hợp lệ, đã có application, đã có rental khác
- `401`: Token không hợp lệ hoặc chưa xác thực
- `404`: Không tìm thấy rental

## Frontend Implementation

### Step 1: Generate Invite Link (Người A)

```typescript
// services/roommateApplication.service.ts
import { apiClient } from './apiClient';

export interface GenerateInviteLinkResponse {
  inviteLink: string;
  token: string;
  rentalId: string;
  roommateSeekingPostId?: string;
  expiresAt: string;
}

export async function generateInviteLink(): Promise<GenerateInviteLinkResponse> {
  const response = await apiClient.post<GenerateInviteLinkResponse>(
    '/roommate-applications/generate-invite-link'
  );
  return response.data;
}
```

**Component Example:**

```tsx
// components/RoommateInvite/GenerateInviteLink.tsx
import React, { useState } from 'react';
import { generateInviteLink } from '@/services/roommateApplication.service';
import { Button } from '@/components/ui/Button';
import { CopyIcon, ShareIcon } from '@/components/icons';

export const GenerateInviteLink: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [inviteData, setInviteData] = useState<GenerateInviteLinkResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateLink = async () => {
    try {
      setLoading(true);
      const data = await generateInviteLink();
      setInviteData(data);
    } catch (error) {
      console.error('Failed to generate invite link:', error);
      // Show error toast
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (inviteData?.inviteLink) {
      await navigator.clipboard.writeText(inviteData.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (inviteData?.inviteLink && navigator.share) {
      try {
        await navigator.share({
          title: 'Mời bạn ở ghép',
          text: 'Mời bạn cùng ở ghép với tôi',
          url: inviteData.inviteLink,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  return (
    <div className="invite-link-container">
      <h2>Tạo Link Mời</h2>
      
      {!inviteData ? (
        <Button onClick={handleGenerateLink} loading={loading}>
          Tạo Link Mời
        </Button>
      ) : (
        <div className="invite-link-result">
          <div className="link-info">
            <p className="label">Link mời:</p>
            <div className="link-display">
              <code>{inviteData.inviteLink}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyLink}
                icon={CopyIcon}
              >
                {copied ? 'Đã copy!' : 'Copy'}
              </Button>
            </div>
            
            <p className="expires">
              Link hết hạn: {new Date(inviteData.expiresAt).toLocaleString('vi-VN')}
            </p>
          </div>

          <div className="actions">
            <Button onClick={handleShare} icon={ShareIcon}>
              Chia sẻ
            </Button>
            <Button variant="outline" onClick={() => setInviteData(null)}>
              Tạo link mới
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
```

### Step 2: Accept Invite Page (Người B)

**Route:** `/invite?token={token}`

```tsx
// pages/invite/[token].tsx hoặc pages/invite.tsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import { acceptInvite } from '@/services/roommateApplication.service';
import { AcceptInviteForm } from '@/components/RoommateInvite/AcceptInviteForm';

export default function InvitePage() {
  const router = useRouter();
  const { token } = router.query;
  const [decodedToken, setDecodedToken] = useState<any>(null);

  // Decode token để preview thông tin (optional)
  useEffect(() => {
    if (token && typeof token === 'string') {
      try {
        // Note: JWT decode không cần verify, chỉ để preview
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        setDecodedToken(JSON.parse(jsonPayload));
      } catch (error) {
        console.error('Invalid token format:', error);
      }
    }
  }, [token]);

  if (!token || typeof token !== 'string') {
    return (
      <div className="error-container">
        <h2>Link không hợp lệ</h2>
        <p>Link mời không chứa token hoặc đã hết hạn.</p>
      </div>
    );
  }

  return (
    <div className="invite-page">
      <div className="container">
        <h1>Chấp nhận lời mời ở ghép</h1>
        
        {decodedToken && (
          <div className="invite-preview">
            <p>Bạn đang được mời vào một phòng trọ</p>
            {/* Có thể fetch thêm thông tin room từ rentalId */}
          </div>
        )}

        <AcceptInviteForm token={token} />
      </div>
    </div>
  );
}
```

**Accept Invite Form Component:**

```tsx
// components/RoommateInvite/AcceptInviteForm.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation } from '@tanstack/react-query';
import { acceptInvite, AcceptInviteDto } from '@/services/roommateApplication.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Textarea } from '@/components/ui/Textarea';

interface AcceptInviteFormProps {
  token: string;
}

export const AcceptInviteForm: React.FC<AcceptInviteFormProps> = ({ token }) => {
  const router = useRouter();
  const [formData, setFormData] = useState<AcceptInviteDto>({
    token,
    fullName: '',
    phoneNumber: '',
    moveInDate: '',
    occupation: '',
    intendedStayMonths: undefined,
    applicationMessage: '',
    isUrgent: false,
  });

  const mutation = useMutation({
    mutationFn: (data: AcceptInviteDto) => acceptInvite(data),
    onSuccess: (application) => {
      // Redirect to application detail page
      router.push(`/roommate-applications/${application.id}`);
      // Show success toast
    },
    onError: (error: any) => {
      // Show error toast
      console.error('Failed to accept invite:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (field: keyof AcceptInviteDto, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="accept-invite-form">
      <div className="form-group">
        <label htmlFor="fullName">
          Họ và tên <span className="required">*</span>
        </label>
        <Input
          id="fullName"
          value={formData.fullName}
          onChange={(e) => handleChange('fullName', e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="phoneNumber">
          Số điện thoại <span className="required">*</span>
        </label>
        <Input
          id="phoneNumber"
          type="tel"
          value={formData.phoneNumber}
          onChange={(e) => handleChange('phoneNumber', e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="moveInDate">
          Ngày dự định chuyển vào <span className="required">*</span>
        </label>
        <DatePicker
          id="moveInDate"
          value={formData.moveInDate}
          onChange={(date) => handleChange('moveInDate', date)}
          minDate={new Date()}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="occupation">Nghề nghiệp</label>
        <Input
          id="occupation"
          value={formData.occupation}
          onChange={(e) => handleChange('occupation', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="intendedStayMonths">Số tháng dự định ở</label>
        <Input
          id="intendedStayMonths"
          type="number"
          min={1}
          value={formData.intendedStayMonths || ''}
          onChange={(e) =>
            handleChange('intendedStayMonths', e.target.value ? parseInt(e.target.value) : undefined)
          }
        />
      </div>

      <div className="form-group">
        <label htmlFor="applicationMessage">Lời nhắn</label>
        <Textarea
          id="applicationMessage"
          value={formData.applicationMessage}
          onChange={(e) => handleChange('applicationMessage', e.target.value)}
          rows={4}
        />
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.isUrgent}
            onChange={(e) => handleChange('isUrgent', e.target.checked)}
          />
          Đánh dấu khẩn cấp
        </label>
      </div>

      <div className="form-actions">
        <Button
          type="submit"
          loading={mutation.isPending}
          disabled={!formData.fullName || !formData.phoneNumber || !formData.moveInDate}
        >
          Chấp nhận lời mời
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Hủy
        </Button>
      </div>
    </form>
  );
};
```

### Service Implementation

```typescript
// services/roommateApplication.service.ts
import { apiClient } from './apiClient';

export interface AcceptInviteDto {
  token: string;
  fullName: string;
  phoneNumber: string;
  moveInDate: string;
  occupation?: string;
  intendedStayMonths?: number;
  applicationMessage?: string;
  isUrgent?: boolean;
}

export interface RoommateApplicationResponse {
  id: string;
  roommateSeekingPostId: string;
  applicantId: string;
  fullName: string;
  occupation?: string;
  phoneNumber: string;
  moveInDate: string;
  intendedStayMonths?: number;
  applicationMessage?: string;
  status: string;
  // ... other fields
}

export async function acceptInvite(
  data: AcceptInviteDto
): Promise<RoommateApplicationResponse> {
  const response = await apiClient.post<RoommateApplicationResponse>(
    '/roommate-applications/accept-invite',
    data
  );
  return response.data;
}

export async function generateInviteLink(): Promise<GenerateInviteLinkResponse> {
  const response = await apiClient.post<GenerateInviteLinkResponse>(
    '/roommate-applications/generate-invite-link'
  );
  return response.data;
}
```

## Error Handling

```typescript
// utils/errorHandler.ts
export function handleInviteError(error: any) {
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message || 'Có lỗi xảy ra';

    switch (status) {
      case 400:
        return {
          type: 'validation',
          message: message || 'Dữ liệu không hợp lệ',
        };
      case 401:
        return {
          type: 'auth',
          message: 'Token không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu link mới.',
        };
      case 404:
        return {
          type: 'not-found',
          message: 'Không tìm thấy thông tin phòng',
        };
      default:
        return {
          type: 'error',
          message: 'Có lỗi xảy ra, vui lòng thử lại sau',
        };
    }
  }

  return {
    type: 'error',
    message: 'Lỗi kết nối, vui lòng kiểm tra mạng',
  };
}
```

## State Management (React Query Example)

```typescript
// hooks/useRoommateInvite.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateInviteLink, acceptInvite } from '@/services/roommateApplication.service';

export function useGenerateInviteLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateInviteLink,
    onSuccess: () => {
      // Invalidate applications list if needed
      queryClient.invalidateQueries({ queryKey: ['roommate-applications'] });
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptInvite,
    onSuccess: (application) => {
      // Invalidate applications list
      queryClient.invalidateQueries({ queryKey: ['roommate-applications'] });
      // Set new application in cache
      queryClient.setQueryData(
        ['roommate-application', application.id],
        application
      );
    },
  });
}
```

## Testing Checklist

- [ ] Generate invite link successfully
- [ ] Copy invite link to clipboard
- [ ] Share invite link (native share API)
- [ ] Navigate to invite page with valid token
- [ ] Show error for invalid/expired token
- [ ] Submit accept invite form with valid data
- [ ] Handle validation errors
- [ ] Handle network errors
- [ ] Redirect after successful accept
- [ ] Show loading states appropriately

## Security Considerations

1. **Token Validation**: Frontend nên validate token format trước khi submit
2. **Expiry Check**: Có thể decode token để check expiry (client-side validation)
3. **HTTPS Only**: Chỉ gửi token qua HTTPS
4. **Token in URL**: Consider using POST với token in body thay vì query param (safer)

## Next Steps

Sau khi accept invite thành công, application sẽ đi qua flow hiện tại:
1. Tenant approve/reject
2. Landlord approve (nếu platform room)
3. Applicant confirm
4. Rental được tạo tự động

Frontend có thể reuse các components hiện có cho flow này.

