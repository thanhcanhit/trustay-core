# Supabase Vector Store

Vector storage and similarity search module using Supabase + pgvector with AI SDK for embeddings.

## Features

- ✅ **Store documents** with automatic embedding generation
- ✅ **Similarity search** using cosine similarity
- ✅ **Metadata filtering** for advanced queries
- ✅ **Batch operations** for multiple documents
- ✅ **AI SDK integration** for embedding generation

## Setup

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js
```

### 2. Environment Variables

Add to your `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key  # Optional, for server-side operations
```

### 3. Database Setup

Run the SQL migration to set up pgvector extension and create the documents table:

```bash
# Execute the migration file in your Supabase SQL editor or via psql
psql -U postgres -d your_database -f src/ai/vector-store/migrations/001_setup_vector_store.sql
```

Or copy the content of `migrations/001_setup_vector_store.sql` and run it in Supabase SQL Editor.

### 4. Configure Embedding Dimension

**Important**: Update the vector dimension in the migration based on your embedding model:

- **Google `text-embedding-004`**: 768 dimensions
- **OpenAI `text-embedding-3-small`**: 1536 dimensions
- **OpenAI `text-embedding-3-large`**: 3072 dimensions

Update in migration:
```sql
embedding vector(768),  -- Change 768 to match your model
```

And in the function:
```sql
query_embedding vector(768)  -- Change 768 to match your model
```

### 5. Module Registration

Import `VectorStoreModule` in your AI module or app module:

```typescript
import { VectorStoreModule } from './vector-store/vector-store.module';

@Module({
  imports: [
    VectorStoreModule.forRoot({
      tableName: 'documents',  // Optional, defaults to 'documents'
      embeddingColumnName: 'embedding',  // Optional, defaults to 'embedding'
      contentColumnName: 'content',  // Optional, defaults to 'content'
      metadataColumnName: 'metadata',  // Optional, defaults to 'metadata'
    }),
    // ... other imports
  ],
})
export class AiModule {}
```

## Usage

### Inject Service

```typescript
import { SupabaseVectorStoreService } from './vector-store/supabase-vector-store.service';

@Injectable()
export class YourService {
  constructor(
    private readonly vectorStore: SupabaseVectorStoreService,
  ) {}
}
```

### Add Documents

```typescript
// Single document
const documentId = await this.vectorStore.addDocument({
  content: 'This is a sample document about AI and machine learning.',
  metadata: {
    category: 'technology',
    author: 'John Doe',
    tags: ['ai', 'ml'],
  },
});

// Multiple documents
const documentIds = await this.vectorStore.addDocuments([
  {
    content: 'First document content...',
    metadata: { category: 'tech' },
  },
  {
    content: 'Second document content...',
    metadata: { category: 'science' },
  },
]);
```

### Search Similar Documents

```typescript
// Basic search
const results = await this.vectorStore.similaritySearch(
  'What is machine learning?',
  {
    limit: 5,
    threshold: 0.7,  // Minimum similarity score
  },
);

// Search with metadata filter
const filteredResults = await this.vectorStore.similaritySearch(
  'AI technology',
  {
    limit: 10,
    threshold: 0.6,
    filter: {
      category: 'technology',
      tags: 'ai',
    },
    includeMetadata: true,
  },
);
```

### Delete Documents

```typescript
// Delete by IDs
await this.vectorStore.deleteDocuments(['uuid-1', 'uuid-2']);

// Delete by metadata filter
await this.vectorStore.deleteDocumentsByFilter({
  category: 'old',
});
```

### Update Document Metadata

```typescript
await this.vectorStore.updateDocumentMetadata('document-id', {
  category: 'updated',
  version: 2,
});
```

### Get Document by ID

```typescript
const document = await this.vectorStore.getDocument('document-id');
```

## API Reference

### Methods

#### `generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]>`
Generate embedding for a single text.

#### `generateEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<number[][]>`
Generate embeddings for multiple texts in batches.

#### `addDocument(document: DocumentWithEmbedding, options?: EmbeddingOptions): Promise<string>`
Add a single document with automatic embedding generation.

#### `addDocuments(documents: DocumentWithEmbedding[], options?: EmbeddingOptions): Promise<string[]>`
Add multiple documents with batch embedding generation.

#### `similaritySearch(query: string, options?: VectorSearchOptions): Promise<VectorSearchResult[]>`
Search for similar documents using vector similarity.

#### `similaritySearchWithSQL(query: string, options?: VectorSearchOptions): Promise<VectorSearchResult[]>`
Alternative search method using raw SQL (fallback if RPC function not available).

#### `deleteDocuments(ids: string[]): Promise<number>`
Delete documents by their IDs.

#### `deleteDocumentsByFilter(filter: DocumentMetadata): Promise<number>`
Delete documents matching metadata filter.

#### `getDocument(id: string): Promise<DocumentWithEmbedding | null>`
Retrieve a document by ID.

#### `updateDocumentMetadata(id: string, metadata: DocumentMetadata): Promise<DocumentWithEmbedding>`
Update document metadata.

## Performance Tips

1. **Index Type**: 
   - Use `hnsw` for large datasets (>100k documents) - faster but uses more memory
   - Use `ivfflat` for smaller datasets - slower but uses less memory

2. **Batch Size**: Adjust `batchSize` in embedding options for optimal performance (default: 10)

3. **Similarity Threshold**: Set appropriate threshold to filter low-quality matches

4. **Metadata Indexing**: The migration includes a GIN index on metadata for efficient filtering

## Troubleshooting

### Error: "Failed to search documents: function match_documents does not exist"
Run the migration SQL script to create the `match_documents` function, or use `similaritySearchWithSQL()` as a fallback.

### Error: "vector dimension mismatch"
Ensure the vector dimension in your migration matches your embedding model dimension.

### Slow search performance
- Ensure indexes are created: `\d documents` in psql to check
- Consider increasing HNSW parameters or switching to ivfflat for smaller datasets
- Monitor query performance with `EXPLAIN ANALYZE`

## References

- [Supabase Vector Database Docs](https://supabase.com/docs/guides/ai)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [AI SDK Embeddings](https://sdk.vercel.ai/docs/reference/ai-sdk-core/embed)



