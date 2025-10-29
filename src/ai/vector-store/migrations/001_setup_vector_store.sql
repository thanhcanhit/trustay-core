-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ========================================
-- TABLE: AI Chunks (Schema + QA)
-- Unified table for schema chunks and Q&A with collection type
-- ========================================
CREATE TABLE IF NOT EXISTS ai_chunks (
	id BIGSERIAL PRIMARY KEY,
	tenant_id UUID NOT NULL,
	collection TEXT NOT NULL CHECK (collection IN ('schema', 'qa')),
	db_key TEXT NOT NULL,
	content TEXT NOT NULL,
	embedding VECTOR(768) NOT NULL, -- Adjust dimension based on your embedding model (text-embedding-004 uses 768)
	created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for filtering by tenant, collection, and db_key
CREATE INDEX IF NOT EXISTS ai_chunks_tenant_collection_db_key_idx 
ON ai_chunks(tenant_id, collection, db_key);

-- Vector similarity index using ivfflat (good for smaller datasets)
CREATE INDEX IF NOT EXISTS ai_chunks_vec_idx ON ai_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Alternative: Use HNSW for larger datasets (uncomment if needed)
-- CREATE INDEX IF NOT EXISTS ai_chunks_vec_idx ON ai_chunks 
-- USING hnsw (embedding vector_cosine_ops);

-- ========================================
-- TABLE: SQL QA (Canonical SQL Storage)
-- Stores canonical SQL queries with Q&A for reference
-- ========================================
CREATE TABLE IF NOT EXISTS sql_qa (
	id BIGSERIAL PRIMARY KEY,
	tenant_id UUID NOT NULL,
	db_key TEXT NOT NULL,
	question TEXT NOT NULL,
	sql_canonical TEXT NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for filtering by tenant and db_key
CREATE INDEX IF NOT EXISTS sql_qa_tenant_db_key_idx 
ON sql_qa(tenant_id, db_key);

-- Index for searching questions
CREATE INDEX IF NOT EXISTS sql_qa_question_idx 
ON sql_qa USING GIN (to_tsvector('english', question));

-- ========================================
-- FUNCTION: Match AI Chunks
-- Search for similar chunks with tenant and collection filtering
-- ========================================
CREATE OR REPLACE FUNCTION match_ai_chunks(
	p_tenant_id UUID,
	p_db_key TEXT,
	p_collection TEXT,
	p_emb VECTOR(768),
	p_top_k INT DEFAULT 8
)
RETURNS TABLE(content TEXT, score FLOAT4)
LANGUAGE SQL
STABLE
AS $$
	SELECT 
		ai_chunks.content,
		1 - (ai_chunks.embedding <=> p_emb) AS score
	FROM ai_chunks
	WHERE ai_chunks.tenant_id = p_tenant_id 
		AND ai_chunks.db_key = p_db_key
		AND ai_chunks.collection = p_collection
	ORDER BY ai_chunks.embedding <=> p_emb
	LIMIT p_top_k;
$$;

-- ========================================
-- FUNCTION: Match AI Chunks (any collection)
-- Search across all collections for a tenant/db_key
-- ========================================
CREATE OR REPLACE FUNCTION match_ai_chunks_any(
	p_tenant_id UUID,
	p_db_key TEXT,
	p_emb VECTOR(768),
	p_top_k INT DEFAULT 8
)
RETURNS TABLE(content TEXT, collection TEXT, score FLOAT4)
LANGUAGE SQL
STABLE
AS $$
	SELECT 
		ai_chunks.content,
		ai_chunks.collection,
		1 - (ai_chunks.embedding <=> p_emb) AS score
	FROM ai_chunks
	WHERE ai_chunks.tenant_id = p_tenant_id 
		AND ai_chunks.db_key = p_db_key
	ORDER BY ai_chunks.embedding <=> p_emb
	LIMIT p_top_k;
$$;

-- ========================================
-- TRIGGERS: Auto-update updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ai_chunks
CREATE TRIGGER update_ai_chunks_updated_at
	BEFORE UPDATE ON ai_chunks
	FOR EACH ROW
	EXECUTE FUNCTION update_updated_at_column();

-- Trigger for sql_qa
CREATE TRIGGER update_sql_qa_updated_at
	BEFORE UPDATE ON sql_qa
	FOR EACH ROW
	EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ROW LEVEL SECURITY (Optional)
-- ========================================
-- ALTER TABLE ai_chunks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sql_qa ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (uncomment and customize as needed)
-- CREATE POLICY "Enable read access for authenticated users" ON ai_chunks
-- FOR SELECT USING (auth.role() = 'authenticated');

-- CREATE POLICY "Enable insert for authenticated users" ON ai_chunks
-- FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- CREATE POLICY "Enable read access for authenticated users" ON sql_qa
-- FOR SELECT USING (auth.role() = 'authenticated');

-- CREATE POLICY "Enable insert for authenticated users" ON sql_qa
-- FOR INSERT WITH CHECK (auth.role() = 'authenticated');
