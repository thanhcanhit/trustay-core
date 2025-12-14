-- CreateTable
CREATE TABLE "pending_knowledge" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "sql" TEXT,
    "evaluation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "validator_data" JSONB,
    "session_id" TEXT,
    "user_id" TEXT,
    "processing_log_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_knowledge_status_idx" ON "pending_knowledge"("status");

-- CreateIndex
CREATE INDEX "pending_knowledge_created_at_idx" ON "pending_knowledge"("created_at");

-- CreateIndex
CREATE INDEX "pending_knowledge_user_id_idx" ON "pending_knowledge"("user_id");
