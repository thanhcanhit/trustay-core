import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Service để quản lý AI Processing Logs
 * Lưu lại toàn bộ quá trình xử lý AI pipeline để audit và debugging
 */
@Injectable()
export class AiProcessingLogService {
	private readonly logger = new Logger(AiProcessingLogService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Sanitize data to remove Functions and non-serializable values
	 * Loại bỏ Functions, undefined, và các giá trị không thể serialize
	 */
	private sanitizeForDatabase(value: unknown, path: string = 'root'): unknown {
		if (value === null || value === undefined) {
			return null;
		}
		// Loại bỏ Functions
		if (typeof value === 'function') {
			this.logger.warn(
				`Found Function object at path: ${path}. Replacing with '[Function]' placeholder.`,
			);
			return '[Function]';
		}
		// Xử lý Date objects
		if (value instanceof Date) {
			return value.toISOString();
		}
		// Xử lý BigInt (should already be handled by serializeBigInt, but just in case)
		if (typeof value === 'bigint') {
			return Number(value);
		}
		// Xử lý Error objects
		if (value instanceof Error) {
			return {
				name: value.name,
				message: value.message,
				stack: value.stack,
			};
		}
		// Xử lý Symbol (không thể serialize)
		if (typeof value === 'symbol') {
			return String(value);
		}
		// Xử lý Arrays
		if (Array.isArray(value)) {
			return value.map((item, index) => this.sanitizeForDatabase(item, `${path}[${index}]`));
		}
		// Xử lý Objects
		if (typeof value === 'object') {
			const sanitized: Record<string, unknown> = {};
			for (const [key, val] of Object.entries(value)) {
				// Skip undefined values
				if (val === undefined) {
					continue;
				}
				// Skip Functions
				if (typeof val === 'function') {
					this.logger.warn(
						`Found Function object at path: ${path}.${key}. Replacing with '[Function]' placeholder.`,
					);
					sanitized[key] = '[Function]';
					continue;
				}
				// Recursively sanitize nested objects
				sanitized[key] = this.sanitizeForDatabase(val, `${path}.${key}`);
			}
			return sanitized;
		}
		// Return primitive values as-is
		return value;
	}

	/**
	 * Save AI processing log to database for audit and debugging
	 * Mỗi câu hỏi chỉ lưu 1 bản ghi duy nhất, được append data ở từng bước
	 */
	async saveProcessingLog(input: {
		question: string; // Original question (may be short)
		canonicalQuestion?: string; // Expanded canonical question (if different from question)
		response?: string;
		orchestratorData?: any;
		sqlGenerationAttempts?: any[];
		validatorData?: any;
		responseGeneratorData?: any;
		ragContext?: any;
		stepsLog?: string;
		tokenUsage?: any;
		totalDuration?: number;
		status?: string;
		error?: string;
	}): Promise<string | null> {
		try {
			// Merge responseGeneratorData vào validatorData để đơn giản
			const validatorDataWithResponseGen = input.validatorData
				? { ...input.validatorData, responseGenerator: input.responseGeneratorData }
				: input.responseGeneratorData
					? { responseGenerator: input.responseGeneratorData }
					: undefined;

			// Nếu có canonical question, dùng làm question chính và lưu original vào validatorData
			const finalQuestion = input.canonicalQuestion || input.question;
			const finalValidatorData =
				input.canonicalQuestion && input.canonicalQuestion !== input.question
					? {
							...(validatorDataWithResponseGen || {}),
							originalQuestion: input.question, // Lưu original question ngắn gọn
							canonicalQuestion: input.canonicalQuestion, // Lưu canonical question đầy đủ
						}
					: validatorDataWithResponseGen;

			// Sanitize tất cả dữ liệu trước khi lưu vào database để loại bỏ Functions và non-serializable values
			const sanitizedData = {
				question: finalQuestion, // Dùng canonical question nếu có
				response: input.response,
				orchestratorData: this.sanitizeForDatabase(input.orchestratorData),
				sqlGenerationAttempts: this.sanitizeForDatabase(input.sqlGenerationAttempts || []),
				validatorData: this.sanitizeForDatabase(finalValidatorData),
				ragContext: this.sanitizeForDatabase(input.ragContext),
				stepsLog: input.stepsLog,
				tokenUsage: this.sanitizeForDatabase(input.tokenUsage),
				totalDuration: input.totalDuration,
				status: input.status || 'completed',
				error: input.error,
			};

			const log = await (this.prisma as any).aiProcessingLog.create({
				data: sanitizedData,
			});
			this.logger.debug(
				`Saved processing log | id=${log.id} | question="${finalQuestion.substring(0, 50)}..." | duration=${input.totalDuration || 'N/A'}ms`,
			);
			return log.id;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			this.logger.error(
				`❌ Failed to save processing log | question="${input.question?.substring(0, 50) || 'N/A'}..." | error=${errorMessage}`,
				errorStack,
			);
			// Log thêm thông tin để debug
			this.logger.debug(
				`Processing log data: status=${input.status || 'N/A'} | hasResponse=${!!input.response} | hasStepsLog=${!!input.stepsLog} | hasOrchestratorData=${!!input.orchestratorData}`,
			);
			return null;
		}
	}

	/**
	 * Find processing logs by status
	 * @param status - Status (completed, failed, partial)
	 * @param limit - Limit số lượng kết quả
	 * @returns Array of processing logs
	 */
	async findByStatus(status: string, limit: number = 50) {
		try {
			return await (this.prisma as any).aiProcessingLog.findMany({
				where: { status },
				orderBy: { createdAt: 'desc' },
				take: limit,
			});
		} catch (error) {
			this.logger.error(`Failed to find processing logs by status: ${status}`, error);
			return [];
		}
	}

	/**
	 * Find processing log by ID
	 * @param id - Log ID
	 * @returns Processing log or null
	 */
	async findById(id: string) {
		try {
			return await (this.prisma as any).aiProcessingLog.findUnique({
				where: { id },
			});
		} catch (error) {
			this.logger.error(`Failed to find processing log by id: ${id}`, error);
			return null;
		}
	}

	/**
	 * Get statistics về processing logs
	 * @param filters - Optional filters (status)
	 * @returns Statistics object
	 */
	async getStatistics(filters?: { status?: string }) {
		try {
			const where: any = {};
			if (filters?.status) {
				where.status = filters.status;
			}

			const [total, completed, failed, partial] = await Promise.all([
				(this.prisma as any).aiProcessingLog.count({ where }),
				(this.prisma as any).aiProcessingLog.count({ where: { ...where, status: 'completed' } }),
				(this.prisma as any).aiProcessingLog.count({ where: { ...where, status: 'failed' } }),
				(this.prisma as any).aiProcessingLog.count({ where: { ...where, status: 'partial' } }),
			]);

			// Get average duration
			const avgDurationResult = await (this.prisma as any).aiProcessingLog.aggregate({
				where: { ...where, totalDuration: { not: null } },
				_avg: { totalDuration: true },
			});

			// Get total token usage
			const tokenUsageResult = await (this.prisma as any).aiProcessingLog.findMany({
				where: { ...where, tokenUsage: { not: null } },
				select: { tokenUsage: true },
			});

			let totalTokens = 0;
			for (const log of tokenUsageResult) {
				if (log.tokenUsage?.totalTokens) {
					totalTokens += log.tokenUsage.totalTokens;
				}
			}

			return {
				total,
				completed,
				failed,
				partial,
				averageDuration: avgDurationResult._avg.totalDuration || 0,
				totalTokens,
			};
		} catch (error) {
			this.logger.error('Failed to get processing log statistics', error);
			return {
				total: 0,
				completed: 0,
				failed: 0,
				partial: 0,
				averageDuration: 0,
				totalTokens: 0,
			};
		}
	}

	/**
	 * Find processing logs with pagination, search, and filters
	 * @param params - Query parameters
	 * @returns Paginated list of processing logs
	 */
	async findMany(params: {
		search?: string;
		status?: string;
		limit?: number;
		offset?: number;
	}): Promise<{ items: any[]; total: number; limit: number; offset: number }> {
		try {
			const limit = params.limit || 20;
			const offset = params.offset || 0;

			const where: any = {};

			if (params.status) {
				where.status = params.status;
			}

			if (params.search) {
				where.question = {
					contains: params.search,
					mode: 'insensitive',
				} as any;
			}

			const [items, total] = await Promise.all([
				(this.prisma as any).aiProcessingLog.findMany({
					where,
					orderBy: { createdAt: 'desc' },
					take: limit,
					skip: offset,
					// Trả full data để FE có đủ thông tin debug/hiển thị
					select: {
						id: true,
						question: true,
						response: true,
						orchestratorData: true,
						sqlGenerationAttempts: true,
						validatorData: true,
						ragContext: true,
						stepsLog: true,
						tokenUsage: true,
						totalDuration: true,
						status: true,
						error: true,
						createdAt: true,
					},
				}),
				(this.prisma as any).aiProcessingLog.count({ where }),
			]);

			return {
				items: items || [],
				total: total || 0,
				limit,
				offset,
			};
		} catch (error) {
			this.logger.error('Failed to find processing logs', error);
			return {
				items: [],
				total: 0,
				limit: params.limit || 20,
				offset: params.offset || 0,
			};
		}
	}
}
