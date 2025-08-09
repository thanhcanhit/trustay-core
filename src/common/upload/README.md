# Upload Service Documentation

## Overview

A comprehensive file upload service built with NestJS that provides secure image upload with automatic resizing, optimization, and efficient storage management.

## Features

- ✅ **Security**: File sanitization, MIME type validation, path traversal protection
- ✅ **Optimization**: Automatic image compression and multiple size generation
- ✅ **Flexibility**: Support for multiple formats (JPEG, PNG, WebP, GIF)
- ✅ **Scalability**: Memory-based processing with configurable limits
- ✅ **Clean API**: Simple endpoints with comprehensive error handling

## API Endpoints

### Upload Single Image
```http
POST /upload
Content-Type: multipart/form-data

FormData:
- file: (binary) - Image file to upload
- altText: (string, optional) - Alt text for the image
```

**Response:**
```json
{
  "imagePath": "/images/1754748056541-2a61d34d-0a28cc39707c05d3.jpg",
  "savedToDb": false,
  "imageId": null
}
```

### Upload Multiple Images
```http
POST /upload/bulk
Content-Type: multipart/form-data

FormData:
- files: (binary[]) - Array of image files (max 10)
- altTexts: (string[], optional) - Alt texts for the images
```

**Response:**
```json
{
  "results": [
    {
      "imagePath": "/images/1754748056541-2a61d34d-0a28cc39707c05d3.jpg",
      "savedToDb": false,
      "imageId": null
    }
  ],
  "total": 1
}
```

## File Structure

The service generates multiple optimized sizes for each uploaded image:

```
uploads/
├── 128x128/1754748056541-2a61d34d-0a28cc39707c05d3.jpg
├── 256x256/1754748056541-2a61d34d-0a28cc39707c05d3.jpg
├── 512x512/1754748056541-2a61d34d-0a28cc39707c05d3.jpg
├── 1024x1024/1754748056541-2a61d34d-0a28cc39707c05d3.jpg
└── 1920x1080/1754748056541-2a61d34d-0a28cc39707c05d3.jpg
```

## Frontend Usage

### Image Utility Functions

Use the provided utility functions for clean, type-safe image handling:

```typescript
import { getImageSrc, ImageSize } from '../utils/image.utils';

// Basic usage (default: 512x512)
const imageUrl = getImageSrc("/images/1754748056541-2a61d34d-0a28cc39707c05d3.jpg");
// Returns: "https://api.trustay.com/images/512x512/1754748056541-2a61d34d-0a28cc39707c05d3.jpg"

// With specific size
const thumbnailUrl = getImageSrc("/images/1754748056541-2a61d34d-0a28cc39707c05d3.jpg", ImageSize.THUMBNAIL);
// Returns: "https://api.trustay.com/images/128x128/1754748056541-2a61d34d-0a28cc39707c05d3.jpg"

// With custom base URL
const cdnUrl = getImageSrc("/images/1754748056541-2a61d34d-0a28cc39707c05d3.jpg", ImageSize.HD, "https://cdn.trustay.com");
```

### Available Image Sizes

```typescript
enum ImageSize {
  THUMBNAIL = '128x128',    // Thumbnails, avatars
  SMALL = '256x256',        // Small previews  
  MEDIUM = '512x512',       // Medium previews (default)
  LARGE = '1024x1024',      // Large previews
  HD = '1920x1080'          // Full HD display
}
```

### Manual Usage (if not using utilities)

**Backend Response:**
```
/images/1754748056541-2a61d34d-0a28cc39707c05d3.jpg
```

**Manual Frontend Usage:**
```javascript
const imagePath = "/images/1754748056541-2a61d34d-0a28cc39707c05d3.jpg";
const baseUrl = "https://api.trustay.com";

// Different sizes
const thumbnail = `${baseUrl}/images/128x128${imagePath.substring(8)}`;
const medium = `${baseUrl}/images/512x512${imagePath.substring(8)}`;
const hd = `${baseUrl}/images/1920x1080${imagePath.substring(8)}`;
```

## Available Sizes

| Size | Dimensions | Use Case |
|------|------------|----------|
| 128x128 | 128×128px | Thumbnails, avatars |
| 256x256 | 256×256px | Small previews |
| 512x512 | 512×512px | Medium previews |
| 1024x1024 | 1024×1024px | Large previews |
| 1920x1080 | 1920×1080px | Full HD display |

## File Naming Convention

Files are automatically renamed using a secure pattern:
```
{timestamp}-{hash}-{random}.{ext}
Example: 1754748056541-2a61d34d-0a28cc39707c05d3.jpg
```

This ensures:
- ✅ **Uniqueness**: No file conflicts
- ✅ **Security**: No path traversal attacks
- ✅ **Traceability**: Timestamp for debugging

## Image Optimization

### Automatic Processing
- **Auto-rotation**: Based on EXIF data
- **Format-specific optimization**:
  - **JPEG**: Progressive encoding, mozjpeg compression
  - **PNG**: High compression level, progressive
  - **WebP**: Balanced quality and size

### Quality Settings
- **Original**: 90% quality
- **Resized**: 85% quality
- **No upscaling**: Small images aren't enlarged

## Security Features

### File Validation
```typescript
// MIME type checking
if (!file.mimetype.startsWith('image/')) {
  throw new BadRequestException('File must be an image');
}

// Size limits
const maxSize = 10 * 1024 * 1024; // 10MB
if (file.size > maxSize) {
  throw new BadRequestException('File size must be less than 10MB');
}
```

### Filename Sanitization
- Removes dangerous characters: `/\\:*?"<>|`
- Normalizes Unicode characters
- Removes path separators
- Limits filename length
- Adds secure random components

### Allowed Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- GIF (.gif)

## Error Handling

The service provides clear HTTP error responses:

| Error | Status | Description |
|-------|--------|-------------|
| No file uploaded | 400 | Request missing file |
| File must be an image | 400 | Invalid MIME type |
| File size must be less than 10MB | 400 | File too large |
| Maximum 10 files allowed | 400 | Too many files in bulk upload |

## Service Methods (Internal Use)

For use by other controllers:

```typescript
// Delete image by room image ID
await uploadService.deleteImage(imageId: string): Promise<boolean>

// Delete user avatar
await uploadService.deleteUserAvatar(userId: string): Promise<boolean>

// Delete by file path
await uploadService.deleteFileByPath(imagePath: string): Promise<boolean>

// Update room image order
await uploadService.updateRoomImageOrder(roomId: string, orders: Array<{id: string, sortOrder: number}>): Promise<void>

// Set primary room image
await uploadService.setPrimaryRoomImage(roomId: string, imageId: string): Promise<void>

// Get image URL with optional size
uploadService.getImageUrl(imagePath: string, size?: string): string
```

## Configuration

Environment variables:

```env
# Upload directory (default: ./uploads/images)
UPLOAD_DIR=./uploads/images

# Base URL for serving files (default: http://localhost:3000)
BASE_URL=https://api.trustay.com
```

## Dependencies

```json
{
  "sharp": "^0.34.3",
  "multer": "^2.0.2",
  "@types/multer": "^2.0.0"
}
```

## Module Setup

```typescript
import { UploadModule } from './common/upload/upload.module';

@Module({
  imports: [UploadModule],
  // ...
})
export class AppModule {}
```

## Usage Examples

### React/Next.js Frontend

```typescript
import { getImageSrc, getImageSrcSet, ImageSize } from '../utils/image.utils';

const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('altText', 'Room photo');

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  return result.imagePath; // "/images/123456-abc-def.jpg"
};

// Simple image component
const SimpleImage = ({ imagePath, alt }: { imagePath: string; alt: string }) => {
  return (
    <img 
      src={getImageSrc(imagePath)} // Default: 512x512
      alt={alt}
      loading="lazy"
    />
  );
};

// Responsive image component
const ResponsiveImage = ({ imagePath, alt }: { imagePath: string; alt: string }) => {
  const srcSet = getImageSrcSet(imagePath);
  
  return (
    <picture>
      <source 
        srcSet={getImageSrc(imagePath, ImageSize.HD)}
        media="(min-width: 1024px)" 
      />
      <source 
        srcSet={getImageSrc(imagePath, ImageSize.LARGE)}
        media="(min-width: 768px)" 
      />
      <img 
        src={getImageSrc(imagePath, ImageSize.MEDIUM)}
        srcSet={srcSet}
        sizes="(max-width: 768px) 256px, (max-width: 1024px) 512px, 1024px"
        alt={alt}
        loading="lazy"
      />
    </picture>
  );
};

// Avatar component
const Avatar = ({ imagePath, size = 40 }: { imagePath: string; size?: number }) => {
  return (
    <img 
      src={getImageSrc(imagePath, ImageSize.THUMBNAIL)}
      alt="User avatar"
      width={size}
      height={size}
      className="rounded-full"
    />
  );
};
```

### Room Controller Integration

```typescript
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly uploadService: UploadService,
  ) {}

  @Post(':roomId/images')
  async addRoomImage(
    @Param('roomId') roomId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('altText') altText?: string,
  ) {
    // Upload file
    const uploadResult = await this.uploadService.uploadImage(file, { altText });
    
    // Save to database
    const roomImage = await this.prisma.roomImage.create({
      data: {
        roomId,
        imageUrl: uploadResult.imagePath,
        altText: altText || 'Room image',
        sortOrder: 0,
      },
    });

    return roomImage;
  }

  @Delete(':roomId/images/:imageId')
  async deleteRoomImage(@Param('imageId') imageId: string) {
    const success = await this.uploadService.deleteImage(imageId);
    
    if (!success) {
      throw new NotFoundException('Image not found');
    }
    
    return { message: 'Image deleted successfully' };
  }
}
```

## Best Practices

1. **Always validate files** on both frontend and backend
2. **Use appropriate image sizes** based on use case
3. **Implement progressive loading** with multiple sizes
4. **Set proper alt text** for accessibility
5. **Handle errors gracefully** with user-friendly messages
6. **Clean up unused files** periodically (implement cleanup job)

## Performance Notes

- **Memory usage**: Files are processed in memory - monitor for large uploads
- **Concurrent uploads**: Service handles multiple uploads efficiently
- **Disk space**: Each upload creates 5 different sizes
- **CDN recommendation**: Consider using CDN for production file serving

## Troubleshooting

### Common Issues

1. **Directory permissions**: Ensure upload directory is writable
2. **Disk space**: Monitor available disk space for image storage
3. **Memory limits**: Adjust Node.js memory limits for large images
4. **Sharp installation**: Ensure Sharp library is properly installed

### Debug Logging

Enable debug logging to troubleshoot upload issues:

```typescript
// In upload.service.ts
console.log('Upload directory:', this.uploadDir);
console.log('Processing file:', fileName);
console.log('File size:', file.size);
```