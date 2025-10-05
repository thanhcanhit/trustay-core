-- AlterTable
ALTER TABLE "error_logs" ADD COLUMN     "request_user_id" TEXT;

-- CreateIndex
CREATE INDEX "error_logs_request_user_id_idx" ON "error_logs"("request_user_id");
