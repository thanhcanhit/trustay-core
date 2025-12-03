-- CreateTable
CREATE TABLE "ai_processing_logs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT,
    "orchestrator_data" JSONB,
    "sql_generation_attempts" JSONB[],
    "validator_data" JSONB,
    "rag_context" JSONB,
    "token_usage" JSONB,
    "total_duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_processing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_processing_logs_status_idx" ON "ai_processing_logs"("status");

-- CreateIndex
CREATE INDEX "ai_processing_logs_created_at_idx" ON "ai_processing_logs"("created_at");
