# 🚀 Elasticsearch Quick Start (4 Steps)

## Step 1: Build Application

```bash
npm run build
```

⚠️ **Important**: Build is required before running Elasticsearch scripts.

## Step 2: Start Services

```bash
docker-compose up -d
```

Wait ~30 seconds for Elasticsearch to start.

## Step 3: Import Data

**For testing (FAST - 100 rooms):**
```bash
npm run db:setup-sample
```

**For production (ALL rooms):**
```bash
npm run db:setup
```

## Step 4: Verify

Check Elasticsearch:
```bash
curl http://localhost:9200/rooms/_count
```

Expected output:
```json
{
  "count": 100  // or more depending on your data
}
```

---

## ✅ That's it! Your search is now 10-100x faster!

### Test the API:

```bash
# Search rooms
curl "http://localhost:3000/api/listings?search=phòng trọ"

# Geo search (near location)
curl "http://localhost:3000/api/listings?latitude=10.762622&longitude=106.660172&radius=5"

# Filter by price
curl "http://localhost:3000/api/listings?minPrice=1000000&maxPrice=3000000"
```

---

## 🔄 If You Need to Resync

```bash
npm run es:sync
```

---

## 🐛 Troubleshooting

**Elasticsearch not responding?**
```bash
docker-compose restart trustay-elasticsearch
# Wait 30s then retry
```

**"Cannot find module" error?**
```bash
npm run build
```

**No results in search?**
```bash
npm run es:seed:reindex
```

---

## 📖 Full Documentation

See [ELASTICSEARCH_SETUP.md](./ELASTICSEARCH_SETUP.md) for detailed guide.
