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
	 * Xử lý an toàn với Prisma objects (Decimal, etc.)
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
		// Xử lý Date objects - kiểm tra an toàn với constructor
		try {
			if (value instanceof Date) {
				return value.toISOString();
			}
		} catch {
			// Nếu instanceof fail (có thể do Prisma object), thử toString
			if (
				value &&
				typeof value === 'object' &&
				'toISOString' in value &&
				typeof (value as any).toISOString === 'function'
			) {
				return (value as any).toISOString();
			}
		}
		// Xử lý BigInt (should already be handled by serializeBigInt, but just in case)
		if (typeof value === 'bigint') {
			return Number(value);
		}
		// Xử lý Error objects - kiểm tra an toàn
		try {
			if (value instanceof Error) {
				return {
					name: value.name,
					message: value.message,
					stack: value.stack,
				};
			}
		} catch {
			// Nếu instanceof fail, thử kiểm tra properties
			if (value && typeof value === 'object' && 'message' in value && 'name' in value) {
				return {
					name: String((value as any).name),
					message: String((value as any).message),
					stack: (value as any).stack ? String((value as any).stack) : undefined,
				};
			}
		}
		// Xử lý Symbol (không thể serialize)
		if (typeof value === 'symbol') {
			return String(value);
		}
		// Xử lý Prisma Decimal và các object đặc biệt khác
		if (value && typeof value === 'object') {
			// Kiểm tra nếu là Prisma Decimal hoặc có method toString/toNumber
			if ('toNumber' in value && typeof (value as any).toNumber === 'function') {
				try {
					return (value as any).toNumber();
				} catch {
					return String(value);
				}
			}
			// Kiểm tra nếu có method toString đặc biệt
			if ('toString' in value && typeof (value as any).toString === 'function') {
				try {
					const str = (value as any).toString();
					// Nếu toString trả về số, thử convert
					const num = Number(str);
					if (!Number.isNaN(num) && str.trim() !== '') {
						return num;
					}
				} catch {
					// Ignore
				}
			}
		}
		// Xử lý Arrays
		if (Array.isArray(value)) {
			return value.map((item, index) => this.sanitizeForDatabase(item, `${path}[${index}]`));
		}
		// Xử lý Objects - kiểm tra an toàn với Object.entries
		if (typeof value === 'object' && value !== null) {
			try {
				const sanitized: Record<string, unknown> = {};
				// Sử dụng Object.keys thay vì Object.entries để tránh lỗi với Prisma objects
				for (const key of Object.keys(value)) {
					const val = (value as Record<string, unknown>)[key];
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
			} catch (error) {
				// Nếu không thể iterate, thử convert sang string
				const errorMessage = error instanceof Error ? error.message : String(error);
				this.logger.warn(
					`Failed to sanitize object at path: ${path}. Converting to string. Error: ${errorMessage}`,
				);
				return String(value);
			}
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
			const log = await (this.prisma as any).aiProcessingLog.findUnique({
				where: { id },
			});
			if (!log) {
				return null;
			}
			// Sanitize để loại bỏ Prisma objects và non-serializable values
			// Sau đó serialize thành plain object để tránh lỗi class-transformer
			try {
				const sanitized = {
					id: log.id,
					question: log.question,
					response: log.response,
					orchestratorData: this.sanitizeForDatabase(log.orchestratorData, 'orchestratorData'),
					sqlGenerationAttempts: this.sanitizeForDatabase(
						log.sqlGenerationAttempts,
						'sqlGenerationAttempts',
					),
					validatorData: this.sanitizeForDatabase(log.validatorData, 'validatorData'),
					ragContext: this.sanitizeForDatabase(log.ragContext, 'ragContext'),
					stepsLog: log.stepsLog,
					tokenUsage: this.sanitizeForDatabase(log.tokenUsage, 'tokenUsage'),
					totalDuration: log.totalDuration,
					status: log.status,
					error: log.error,
					createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt,
				};
				// Serialize thành plain object để tránh lỗi class-transformer
				// JSON.parse(JSON.stringify()) sẽ convert tất cả thành plain objects
				return JSON.parse(JSON.stringify(sanitized));
			} catch (e) {
				this.logger.warn(
					`Failed to sanitize log ${id}: ${(e as Error).message}. Returning basic fields only.`,
				);
				// Fallback: chỉ trả về các field cơ bản
				return {
					id: log.id,
					question: log.question,
					response: log.response,
					status: log.status,
					createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt,
				};
			}
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

			// Sanitize items để loại bỏ Prisma objects và non-serializable values
			// Sau đó serialize thành plain objects để tránh lỗi class-transformer
			const sanitizedItems = (items || []).map((item: any) => {
				try {
					const sanitized = {
						id: item.id,
						question: item.question,
						response: item.response,
						orchestratorData: this.sanitizeForDatabase(
							item.orchestratorData,
							'items.orchestratorData',
						),
						sqlGenerationAttempts: this.sanitizeForDatabase(
							item.sqlGenerationAttempts,
							'items.sqlGenerationAttempts',
						),
						validatorData: this.sanitizeForDatabase(item.validatorData, 'items.validatorData'),
						ragContext: this.sanitizeForDatabase(item.ragContext, 'items.ragContext'),
						stepsLog: item.stepsLog,
						tokenUsage: this.sanitizeForDatabase(item.tokenUsage, 'items.tokenUsage'),
						totalDuration: item.totalDuration,
						status: item.status,
						error: item.error,
						createdAt:
							item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
					};
					// Serialize thành plain object để tránh lỗi class-transformer
					// JSON.parse(JSON.stringify()) sẽ convert tất cả thành plain objects
					return JSON.parse(JSON.stringify(sanitized));
				} catch (e) {
					this.logger.warn(
						`Failed to sanitize log item ${item.id}: ${(e as Error).message}. Returning basic fields only.`,
					);
					// Fallback: chỉ trả về các field cơ bản
					return {
						id: item.id,
						question: item.question,
						response: item.response,
						status: item.status,
						createdAt:
							item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
					};
				}
			});

			return {
				items: sanitizedItems,
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
