# Elasticsearch Setup Guide

## 🚀 Quick Start

### 1. Start Elasticsearch & Kibana

```bash
# Start all services (Postgres, Redis, Elasticsearch, Kibana)
docker-compose up -d

# Or start only Elasticsearch services
docker-compose up -d trustay-elasticsearch trustay-kibana
```

**Access Points:**
- Elasticsearch: http://localhost:9200
- Kibana: http://localhost:5601

### 2. Import Data to Postgres + Elasticsearch (Recommended)

```bash
# Full setup (all data + Elasticsearch sync)
npm run db:setup

# Sample setup (100 rooms + Elasticsearch sync) - FASTER for testing
npm run db:setup-sample
```

**What happens:**
1. ✅ Import provinces, districts, wards
2. ✅ Import reference data (amenities, cost types, rules)
3. ✅ Import 10 default users
4. ✅ Import room data from crawled JSON
5. ✅ **Automatically sync all data to Elasticsearch**

### 3. Manual Elasticsearch Operations

```bash
# Sync all data to Elasticsearch (after db import)
npm run es:sync

# Reseed with fresh indices (drop + recreate)
npm run es:seed:reindex

# Seed only rooms index
npm run es:seed:rooms
```

---

## 📋 Import Workflow Options

### Option 1: Full Automated Setup (RECOMMENDED)
```bash
# This runs EVERYTHING including Elasticsearch sync
npm run db:setup
```

### Option 2: Sample Data Setup (FAST - for testing)
```bash
# Only 100 rooms + ES sync
npm run db:setup-sample
```

### Option 3: Manual Step-by-Step
```bash
# 1. Import data to Postgres
node scripts/index.js sequence basic  # Without room data
node scripts/index.js script crawl    # Add room data

# 2. Sync to Elasticsearch
npm run es:sync
```

### Option 4: Update Elasticsearch Only
```bash
# If you already have data in Postgres, just sync to ES
npm run es:seed:reindex
```

---

## 🔧 Configuration

### Environment Variables

Add to your `.env`:

```env
# Elasticsearch Configuration
ELASTICSEARCH_NODE="http://localhost:9200"
ELASTICSEARCH_USERNAME=""
ELASTICSEARCH_PASSWORD=""
ELASTICSEARCH_MAX_RETRIES=3
ELASTICSEARCH_REQUEST_TIMEOUT=30000
```

For Docker:
```env
ELASTICSEARCH_NODE="http://trustay-elasticsearch:9200"
```

---

## 📊 Architecture

### Data Flow

```
User Creates/Updates Room in Postgres
            ↓
    Prisma Middleware (intercepts)
            ↓
    Queue Sync Job (Redis/Bull)
            ↓
    Background Processor
            ↓
    Elasticsearch (indexed)
```

### Search Flow

```
User Search Request
        ↓
  ListingService
        ↓
Elasticsearch (fast search)
        ↓
Get matched IDs
        ↓
Prisma (hydrate full data for matched IDs only)
        ↓
Format & Return
```

---

## 🧪 Testing

### Check Elasticsearch Health

```bash
curl http://localhost:9200/_cluster/health
```

### Check Indices

```bash
# List all indices
curl http://localhost:9200/_cat/indices?v

# Check rooms index
curl http://localhost:9200/rooms/_count
```

### Test Search via Kibana

1. Open http://localhost:5601
2. Go to Dev Tools
3. Run queries:

```json
GET /rooms/_search
{
  "query": {
    "match": {
      "name": "phòng trọ"
    }
  }
}
```

---

## 🔄 Real-time Sync

Data is automatically synced to Elasticsearch when you:

- ✅ Create a new room → Auto-indexed
- ✅ Update a room → Auto-reindexed
- ✅ Delete a room → Auto-removed from ES
- ✅ Update building/pricing/amenities → Associated rooms reindexed

**No manual sync needed in normal operations!**

---

## 🐛 Troubleshooting

### Elasticsearch not starting

```bash
# Check logs
docker-compose logs trustay-elasticsearch

# Restart
docker-compose restart trustay-elasticsearch
```

### Connection refused

1. Check if Elasticsearch is running:
   ```bash
   curl http://localhost:9200
   ```

2. Check environment variable:
   ```bash
   echo $ELASTICSEARCH_NODE
   ```

### Index not found

```bash
# Recreate indices
npm run es:seed:reindex
```

### Search not working

1. Check if data is indexed:
   ```bash
   curl http://localhost:9200/rooms/_count
   ```

2. If count is 0, reseed:
   ```bash
   npm run es:sync
   ```

### Slow search after data import

```bash
# Refresh indices to make data searchable
curl -X POST "http://localhost:9200/_refresh"
```

---

## 📈 Performance Tips

### 1. Bulk Operations

For large imports, use:
```bash
npm run es:seed:reindex
```
This is faster than real-time sync.

### 2. Index Optimization

After bulk import:
```bash
curl -X POST "http://localhost:9200/rooms/_forcemerge?max_num_segments=1"
```

### 3. Monitor Queue

Check sync job queue status in Redis:
```bash
docker exec -it trustay-redis redis-cli
> LLEN bull:elasticsearch-sync-queue:wait
```

---

## 🔐 Production Considerations

### 1. Enable Security

Update `docker-compose.yml`:
```yaml
trustay-elasticsearch:
  environment:
    - xpack.security.enabled=true
    - ELASTIC_PASSWORD=your-secure-password
```

Update `.env`:
```env
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your-secure-password
```

### 2. Persistent Volume

Already configured in `docker-compose.yml`:
```yaml
volumes:
  elasticsearch_data:
    driver: local
```

### 3. Memory Settings

Adjust in `docker-compose.yml` based on your data size:
```yaml
environment:
  - "ES_JAVA_OPTS=-Xms1g -Xmx1g"  # Increase for more data
```

---

## 📚 Available Commands

| Command | Description |
|---------|-------------|
| `npm run db:setup` | Full import (Postgres + ES) |
| `npm run db:setup-sample` | Sample import (100 rooms + ES) |
| `npm run es:sync` | Sync all data to ES |
| `npm run es:seed:reindex` | Drop and recreate ES indices |
| `npm run es:seed:rooms` | Sync only rooms to ES |
| `node scripts/index.js script elasticsearch` | Run ES sync via main script |

---

## 🎯 Next Steps

1. ✅ Run `npm run db:setup-sample` for quick testing
2. ✅ Test search at `http://localhost:3000/api/listings`
3. ✅ Monitor queue at `http://localhost:3000/api/queue/stats`
4. ✅ Explore data in Kibana at `http://localhost:5601`

**Happy searching! 🚀**
