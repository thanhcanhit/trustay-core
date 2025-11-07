-- Update ai_chunks collection check constraint to include 'business' and 'docs'
-- This migration fixes the constraint violation when inserting chunks with collection='business' or 'docs'

-- Drop the existing constraint
ALTER TABLE ai_chunks DROP CONSTRAINT IF EXISTS ai_chunks_collection_check;

-- Add the updated constraint with all valid collection types
ALTER TABLE ai_chunks ADD CONSTRAINT ai_chunks_collection_check 
CHECK (collection IN ('schema', 'qa', 'business', 'docs'));

