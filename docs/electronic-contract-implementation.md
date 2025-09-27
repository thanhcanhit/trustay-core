# Electronic Contract Implementation

## Overview

This implementation provides a comprehensive electronic signature system for rental contracts that complies with Vietnamese law, specifically:

- **Luật Giao dịch điện tử số 51/2023/QH15** (Electronic Transaction Law 2023)
- **Nghị định 91/2023/NĐ-CP** (Decree 91/2023/NĐ-CP)
- **Bộ luật Dân sự 2015** (Civil Code 2015)
- **Luật Nhà ở 2014** (Housing Law 2014)

## Database Schema

### Core Models

#### 1. Contract Model
```prisma
model Contract {
  id                String          @id @default(uuid())
  contractCode      String          @unique @map("contract_code")
  rentalId          String?         @unique @map("rental_id")
  landlordId        String          @map("landlord_id")
  tenantId          String          @map("tenant_id") 
  roomInstanceId    String          @map("room_instance_id")
  contractType      ContractType    @default(monthly_rental)
  status            ContractStatus  @default(draft)
  contractData      Json            @map("contract_data")
  startDate         DateTime        @map("start_date") @db.Date
  endDate           DateTime?       @map("end_date") @db.Date
  pdfUrl            String?         @map("pdf_url")
  pdfHash           String?         @map("pdf_hash")
  pdfSize           Int?            @map("pdf_size")
  signedAt          DateTime?       @map("signed_at")
  activatedAt       DateTime?       @map("activated_at")
  terminatedAt      DateTime?       @map("terminated_at")
  legalMetadata     Json            @map("legal_metadata")
  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @updatedAt @map("updated_at")
  
  // Relations
  rental            Rental?         @relation(fields: [rentalId], references: [id])
  landlord          User            @relation("LandlordContracts", fields: [landlordId], references: [id])
  tenant            User            @relation("TenantContracts", fields: [tenantId], references: [id])
  roomInstance      RoomInstance    @relation(fields: [roomInstanceId], references: [id])
  signatures        ContractSignature[]
  auditLogs         ContractAuditLog[]
}
```

#### 2. ContractSignature Model
```prisma
model ContractSignature {
  id                String          @id @default(uuid())
  contractId        String          @map("contract_id")
  signerId          String          @map("signer_id")
  signerRole        SignerRole      @map("signer_role")
  signatureImage    String          @map("signature_image") // Base64 PNG
  signatureHash     String          @map("signature_hash") // SHA-256
  authenticationMethod String       @map("authentication_method")
  authenticationData Json           @map("authentication_data")
  signatureMetadata Json            @map("signature_metadata")
  isValid           Boolean         @default(true) @map("is_valid")
  signedAt          DateTime        @map("signed_at")
  createdAt         DateTime        @default(now()) @map("created_at")
  
  // Relations
  contract          Contract        @relation(fields: [contractId], references: [id], onDelete: Cascade)
  signer            User            @relation(fields: [signerId], references: [id])
}
```

#### 3. ContractAuditLog Model
```prisma
model ContractAuditLog {
  id                String          @id @default(uuid())
  contractId        String          @map("contract_id")
  userId            String?         @map("user_id")
  action            String          // created, viewed, signed, modified, terminated
  actionDetails     Json            @map("action_details")
  ipAddress         String          @map("ip_address")
  userAgent         String          @map("user_agent")
  sessionId         String?         @map("session_id")
  timestamp         DateTime        @default(now())
  
  // Relations
  contract          Contract        @relation(fields: [contractId], references: [id], onDelete: Cascade)
  user              User?           @relation(fields: [userId], references: [id])
}
```

### Enums

```prisma
enum ContractType {
  monthly_rental    // Thuê theo tháng
  yearly_rental     // Thuê theo năm  
  daily_rental      // Thuê theo ngày
}

enum ContractStatus {
  draft             // Nháp
  pending_signature // Chờ ký
  partially_signed  // Đã ký 1 phần
  fully_signed      // Đã ký đầy đủ
  active            // Đang hiệu lực
  expired           // Hết hạn
  terminated        // Chấm dứt
}

enum SignerRole {
  landlord          // Bên A - Cho thuê
  tenant            // Bên B - Thuê
  witness           // Người làm chứng
}
```

## TypeScript Interfaces

### Legal Metadata Structure

```typescript
interface LegalMetadata {
  creationContext: {
    createdBy: string
    createdAt: string
    createdFrom: {
      ip: string
      location: string
      device: string
    }
  }
  retention: {
    requiredYears: 10 // Điều 119 BLDS
    retainUntil: string
    archiveStatus: 'active' | 'archived'
  }
  legalReferences: {
    civilCode: "Bộ luật Dân sự 2015"
    eTransactionLaw: "Luật Giao dịch điện tử số 51/2023/QH15"
    decree: "Nghị định 91/2023/NĐ-CP"
    housingLaw: "Luật Nhà ở 2014"
  }
  legalValidation: {
    hasRequiredElements: boolean
    signaturesComplete: boolean
    witnessVerified: boolean
    notarized: boolean
  }
}
```

### Signature Metadata Structure

```typescript
interface SignatureMetadata {
  signer: {
    fullName: string
    idNumber: string // CCCD/CMND
    idIssuedDate: string
    idIssuedPlace: string
    dateOfBirth: string
    permanentAddress: string
    currentAddress: string
    phone: string
    email?: string
  }
  authentication: {
    method: 'SMS_OTP'
    phone: string
    otpSentAt: string
    otpVerifiedAt: string
    otpAttempts: number
    verificationCode: string
  }
  signingContext: {
    timestamp: string
    timezone: 'Asia/Ho_Chi_Minh'
    location: {
      latitude?: number
      longitude?: number
      address: string
      country: 'Việt Nam'
    }
    device: {
      type: 'mobile' | 'desktop' | 'tablet'
      os: string
      browser: string
      screenResolution: string
      fingerprint: string
    }
    network: {
      ip: string
      ipv6?: string
      isp?: string
      connectionType?: string
    }
  }
  canvas: {
    dimensions: { width: number; height: number }
    strokeCount: number
    drawingTime: number
    pressure?: number[]
    speed?: number[]
  }
  integrity: {
    signatureHash: string
    contractHash: string
    previousSignatureHash?: string
    blockchainTx?: string
  }
  evidence: {
    smsLogId?: string
    emailLogId?: string
    videoRecordingId?: string
    witnessSignatureId?: string
  }
}
```

## Services

### ContractValidatorService

Validates electronic contracts according to Vietnamese Law:

```typescript
@Injectable()
export class ContractValidatorService {
  // Validate legal requirements according to Civil Code Article 117
  validateLegalRequirements(contractData: ContractData): ValidationResult
  
  // Validate electronic signature according to Electronic Transaction Law
  validateElectronicSignature(signature: SignatureMetadata): boolean
  
  // Validate metadata according to Decree 91/2023/NĐ-CP
  validateMetadata(metadata: SignatureMetadata): string[]
}
```

### ContractSigningService

Handles electronic signature process:

```typescript
@Injectable()
export class ContractSigningService {
  // Create signing session with SMS OTP
  async createSigningSession(
    contractId: string, 
    userId: string,
    phoneNumber: string
  ): Promise<SigningSession>
  
  // Verify OTP and sign contract
  async signContract(
    sessionId: string,
    otp: string,
    canvasData: string,
    userInfo: any,
    requestContext: any
  ): Promise<SignatureResult>
}
```

## Legal Compliance Features

### 1. Authentication Requirements (Điều 22-24 Luật GD điện tử)
- SMS OTP verification
- Phone number validation
- Session management
- Risk assessment

### 2. Integrity Protection (Điều 18)
- SHA-256 hash of signature
- Contract content hash
- Chain of custody
- Non-repudiation

### 3. Audit Trail (Điều 20)
- Complete activity logging
- IP address tracking
- Device fingerprinting
- Timestamp verification

### 4. Legal Metadata (Nghị định 91/2023)
- Signer identification
- Authentication details
- Signing context
- Evidence collection

## Usage Example

### 1. Create Contract
```typescript
const contract = await contractService.create({
  landlordId: 'landlord_123',
  tenantId: 'tenant_123',
  roomInstanceId: 'room_123',
  contractType: 'monthly_rental',
  contractData: {
    title: 'Hợp đồng thuê phòng',
    parties: { /* ... */ },
    financial: { /* ... */ },
    duration: { /* ... */ }
  }
});
```

### 2. Create Signing Session
```typescript
const session = await signingService.createSigningSession(
  contract.id,
  user.id,
  user.phone
);
```

### 3. Sign Contract
```typescript
const result = await signingService.signContract(
  session.sessionId,
  otp,
  canvasSignatureData,
  userInfo,
  requestContext
);
```

## Security Features

### 1. Data Protection
- Encrypted signature storage
- Secure session management
- Hash-based integrity
- Audit trail protection

### 2. Legal Compliance
- Vietnamese law compliance
- 10-year retention (Điều 119 BLDS)
- Complete metadata capture
- Non-repudiation support

### 3. Authentication
- SMS OTP verification
- Device fingerprinting
- Risk assessment
- Session validation

## Database Migration

To apply the schema changes:

```bash
# Generate migration
npx prisma migrate dev --name add-electronic-contracts

# Apply migration
npx prisma migrate deploy
```

## Testing

The implementation includes comprehensive validation:

```typescript
// Test legal compliance
const validation = await validator.validateLegalRequirements(contractData);
expect(validation.isValid).toBe(true);
expect(validation.legalCompliance.hasCapacity).toBe(true);

// Test signature validation
const isValid = await validator.validateElectronicSignature(signature);
expect(isValid).toBe(true);
```

## Future Enhancements

1. **Blockchain Integration**: Store contract hashes on blockchain
2. **Digital Certificates**: PKI-based authentication
3. **Video Recording**: Optional video evidence
4. **Witness Support**: Third-party witness signatures
5. **Notarization**: Integration with notary services

## Legal References

- **Luật Giao dịch điện tử số 51/2023/QH15**: Electronic Transaction Law
- **Nghị định 91/2023/NĐ-CP**: Decree on Electronic Transactions
- **Bộ luật Dân sự 2015**: Civil Code 2015
- **Luật Nhà ở 2014**: Housing Law 2014
- **Nghị định 99/2011/NĐ-CP**: Decree on Electronic Signatures

This implementation ensures full compliance with Vietnamese law while providing a modern, secure, and user-friendly electronic signature system for rental contracts.

## PDF Export Feature

### Overview

The PDF export feature allows generating professional rental contract documents in Vietnamese format, compliant with legal requirements. The system supports:

- **Vietnamese Contract Template**: Standard format following Vietnamese legal document standards
- **Signature Integration**: Canvas signatures embedded in PDF documents
- **Secure Storage**: Encrypted PDF storage with 10-year retention
- **Integrity Verification**: SHA-256 hash verification for document integrity
- **Audit Trail**: Complete tracking of PDF generation and access

### API Endpoints

#### Generate Contract PDF
```
POST /contracts/:contractId/pdf
```

**Request Body:**
```typescript
{
  "includeSignatures": true,
  "options": {
    "format": "A4",
    "printBackground": true
  }
}
```

**Response:**
```typescript
{
  "success": true,
  "pdfUrl": "https://...",
  "hash": "abc123...",
  "size": 1024000,
  "downloadUrl": "https://...",
  "expiresAt": "2025-01-01T00:00:00Z"
}
```

#### Download Contract PDF
```
GET /contracts/:contractId/pdf
```

Returns the PDF file as attachment with proper headers.

#### Get Contract Preview
```
GET /contracts/:contractId/pdf/preview
```

Returns a PNG thumbnail of the contract first page.

#### Verify PDF Integrity
```
GET /contracts/:contractId/pdf/verify
```

**Response:**
```typescript
{
  "valid": true,
  "hash": "abc123...",
  "lastVerified": "2025-01-01T00:00:00Z"
}
```

### Implementation Details

#### 1. HTML Template Generator
```typescript
// Usage
import { generateContractHTML } from './templates/contract-template';

const html = generateContractHTML({
  contractNumber: 'HD-2025-000001',
  parties: { landlord: {...}, tenant: {...} },
  room: {...},
  financial: {...},
  duration: {...},
  terms: {...},
  createdAt: new Date(),
  verificationCode: 'ABC12345'
});
```

#### 2. PDF Generation Service
```typescript
// Usage
import { PDFGenerationService } from './services/pdf-generation.service';

const pdfService = new PDFGenerationService();
const result = await pdfService.generateContractPDF(contractData, {
  format: 'A4',
  printBackground: true
});
```

#### 3. PDF Storage Service
```typescript
// Usage
import { PDFStorageService } from './services/pdf-storage.service';

const storageService = new PDFStorageService();
const stored = await storageService.storePDF(pdfResult, contractNumber, {
  encrypt: true,
  generateSignedUrl: true,
  signedUrlExpiry: 168 // 7 days
});
```

#### 4. Data Transformation
```typescript
// Usage
import { transformToPDFContract } from './utils/contract-data-transformer.util';

const pdfData = transformToPDFContract(databaseContract);
```

### Features

#### Vietnamese Legal Compliance
- **Header Format**: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" standard header
- **Contract Structure**: Traditional Vietnamese contract layout
- **Legal References**: Proper citation of relevant laws
- **Signature Sections**: Compliant signature blocks for both parties
- **Footer Information**: Electronic signature verification details

#### Security Features
- **Hash Verification**: SHA-256 integrity protection
- **Encrypted Storage**: AES-256-CBC encryption for stored PDFs
- **Access Control**: Permission-based PDF access
- **Audit Logging**: Complete access and generation tracking
- **Signed URLs**: Time-limited secure access URLs

#### Template Features
- **Responsive Design**: Optimized for A4 printing
- **Professional Styling**: Clean, business-appropriate layout
- **Multi-language Support**: Vietnamese with proper formatting
- **Currency Formatting**: Vietnamese Dong (VND) formatting
- **Date Formatting**: Vietnamese date format (DD/MM/YYYY)

### Configuration

#### Environment Variables
```bash
# PDF Storage
PDF_STORAGE_PATH=./uploads/contracts
PDF_ENCRYPTION_KEY=your-encryption-key

# AWS S3 (Optional)
S3_BUCKET=your-bucket-name
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

#### PDF Generation Options
```typescript
interface PDFGenerationOptions {
  format?: 'A4' | 'A3' | 'Letter';
  margin?: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  printBackground?: boolean;
  displayHeaderFooter?: boolean;
}
```

### Error Handling

The system includes comprehensive error handling:

- **Contract Not Found**: Returns 404 with appropriate message
- **Permission Denied**: Returns 403 for unauthorized access
- **PDF Generation Failure**: Returns 500 with error details
- **Storage Failure**: Automatic retry with fallback options
- **Integrity Verification**: Fails safely with detailed error messages

### Performance Optimization

- **Browser Pooling**: Reuses Puppeteer browser instances
- **Caching**: PDF results cached for repeated requests
- **Compression**: Optimized PDF size without quality loss
- **Background Processing**: Async PDF generation for large documents
- **Memory Management**: Automatic cleanup of resources

### Monitoring and Analytics

- **Generation Metrics**: Track PDF generation success/failure rates
- **Performance Monitoring**: Monitor generation time and file sizes
- **Access Patterns**: Track PDF download and verification patterns
- **Error Analytics**: Detailed error logging and analysis
- **Storage Analytics**: Monitor storage usage and retention

This PDF export system provides a robust, legally compliant solution for generating rental contract documents in Vietnam.
