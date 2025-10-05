# Redis Caching Implementation

## Overview
Redis caching đã được implement để tăng hiệu suất API bằng cách cache các data thường xuyên truy vấn.

## Architecture

### Core Components
- **[CacheConfigModule](../src/cache/cache.module.ts)**: Global module cấu hình Redis
- **[CacheService](../src/cache/services/cache.service.ts)**: Service wrapper cho cache operations với logging
- **[Cache Constants](../src/cache/constants.ts)**: Định nghĩa cache keys và TTL
- **[HTTP Cache Interceptor](../src/cache/interceptors/http-cache.interceptor.ts)**: Auto-caching cho HTTP endpoints

### Configuration
Redis config được đọc từ environment variables:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL=3600
LOG_LEVEL=debug  # để xem cache HIT/MISS logs
```

## Cached APIs

### 1. System Data (TTL: 24h)
Data ít thay đổi, cache lâu dài:

#### System Amenities
- **API**: `GET /api/reference/amenities[?category=basic|kitchen|...]`
- **Cache Key**: `system:amenities:simple[:category]`
- **Implementation**: [reference.service.ts:385](../src/api/reference/reference.service.ts#L385)

#### System Cost Types
- **API**: `GET /api/reference/cost-types[?category=utility|service|...]`
- **Cache Key**: `system:cost-types:simple[:category]`
- **Implementation**: [reference.service.ts:413](../src/api/reference/reference.service.ts#L413)

#### System Room Rules
- **API**: `GET /api/reference/rules[?category=smoking|pets|...]`
- **Cache Key**: `system:room-rules:simple[:category]`
- **Implementation**: [reference.service.ts:441](../src/api/reference/reference.service.ts#L441)

### 2. Location Data (TTL: 24h)
Static geographic data:

#### Provinces
- **API**: `GET /api/provinces`
- **Cache Key**: `location:provinces`
- **Implementation**: [province.service.ts:13](../src/api/provinces/province/province.service.ts#L13)

#### Districts by Province
- **API**: `GET /api/districts?provinceId={id}`
- **Cache Key**: `location:districts:province:{provinceId}`
- **Implementation**: [district.service.ts:13](../src/api/provinces/district/district.service.ts#L13)

#### Wards by District
- **API**: `GET /api/wards?districtId={id}`
- **Cache Key**: `location:wards:district:{districtId}`
- **Implementation**: [ward.service.ts:13](../src/api/provinces/ward/ward.service.ts#L13)

### 3. Listings Search (TTL: 3 min)
Anonymous user search results:

#### Room Listings
- **API**: `GET /api/listings/rooms?page=1&limit=20&...`
- **Cache Key**: `listing:search:{queryHash}`
- **Condition**: Chỉ cache cho anonymous users (no userId), page 1, limit 20
- **Implementation**: [listing.service.ts:428](../src/api/listing/listing.service.ts#L428)

## Cache TTL Strategy

| Data Type | TTL | Reason |
|-----------|-----|--------|
| System Data (Amenities, Rules, Cost Types) | 24h (86400s) | Rarely changes |
| Location Data (Province, District, Ward) | 24h (86400s) | Static data |
| Listing Search Results | 3min (180s) | Frequently updated |

## Usage Examples

### Using CacheService Directly
```typescript
import { CacheService } from '@/cache/services/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@/cache/constants';

// Get from cache
const data = await this.cacheService.get<MyType>('my-key');

// Set to cache
await this.cacheService.set('my-key', data, CACHE_TTL.MEDIUM);

// Wrap pattern (recommended)
const result = await this.cacheService.wrap(
  CACHE_KEYS.MY_DATA,
  async () => {
    return await this.prisma.myModel.findMany();
  },
  CACHE_TTL.SYSTEM_DATA
);
```

### Cache Decorators (for future use)
```typescript
import { CacheKey, CacheTTL } from '@/cache/decorators/cache-key.decorator';

@Get('my-endpoint')
@UseInterceptors(HttpCacheInterceptor)
@CacheKey('my-endpoint')
@CacheTTL(3600)
async myEndpoint() {
  return await this.service.getData();
}
```

## Monitoring Cache Performance

### Debug Logs
Set `LOG_LEVEL=debug` để xem cache operations:

```
[CacheService] Cache MISS: location:provinces
[CacheService] Cache WRAP executing function for: location:provinces
[CacheService] Cache SET: location:provinces (TTL: 86400s)
[CacheService] Cache HIT: location:provinces
```

### Cache Hit/Miss Indicators
- **Cache MISS**: Data không có trong cache → Query DB
- **Cache HIT**: Data lấy từ cache → Không query DB
- **Cache SET**: Lưu data vào cache với TTL

## Cache Invalidation

### Manual Invalidation
```typescript
// Delete specific key
await this.cacheService.del('my-key');

// Delete by pattern (requires Redis)
await this.cacheService.delPattern('system:amenities:*');

// Clear all cache
await this.cacheService.reset();
```

### Auto Invalidation
- TTL expires → Tự động xóa
- Data update → Cần manually invalidate cache key tương ứng

## Best Practices

1. **Always use constants**: Dùng `CACHE_KEYS` và `CACHE_TTL` từ [constants.ts](../src/cache/constants.ts)
2. **Wrap pattern**: Prefer `cacheService.wrap()` over get/set manually
3. **Key naming**: Format `{domain}:{resource}[:{filter}]` (e.g., `system:amenities:basic`)
4. **TTL selection**:
   - Static data → 24h
   - Frequently updated → 3-5 min
   - User-specific → 1-5 min
5. **Debug mode**: Dùng `LOG_LEVEL=debug` khi develop để verify caching

## Future Enhancements

### Planned Features
1. **Session Storage**: JWT refresh tokens, user sessions
2. **Rate Limiting**: API rate limits per user/IP
3. **Real-time**: User online status, typing indicators
4. **Analytics**: View counts, popular searches
5. **Pub/Sub**: Real-time notifications, chat messages
6. **Geo-spatial**: Nearby room search using Redis Geo

### Cache Warming
Implement cache warming strategy cho popular queries:
```typescript
async warmCache() {
  await this.provinceService.findAll(); // Pre-load provinces
  await this.referenceService.getAmenities(); // Pre-load amenities
}
```

## Troubleshooting

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping  # Should return PONG

# Check connection in logs
# Look for: "CacheModule dependencies initialized"
```

### Cache Not Working
1. Verify `REDIS_HOST` và `REDIS_PORT` trong `.env`
2. Check logs với `LOG_LEVEL=debug`
3. Ensure CacheConfigModule imported in AppModule
4. Verify CacheService injected in service constructor

### Performance Issues
- Monitor cache HIT ratio (should be >80% for static data)
- Adjust TTL based on data update frequency
- Consider cache warming for critical paths
