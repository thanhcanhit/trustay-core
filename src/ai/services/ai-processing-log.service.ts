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
	 * Save AI processing log to database for audit and debugging
	 * Mỗi câu hỏi chỉ lưu 1 bản ghi duy nhất, được append data ở từng bước
	 */
	async saveProcessingLog(input: {
		question: string;
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
	}): Promise<void> {
		try {
			// Merge responseGeneratorData vào validatorData để đơn giản
			const validatorDataWithResponseGen = input.validatorData
				? { ...input.validatorData, responseGenerator: input.responseGeneratorData }
				: input.responseGeneratorData
					? { responseGenerator: input.responseGeneratorData }
					: undefined;

			await (this.prisma as any).aiProcessingLog.create({
				data: {
					question: input.question,
					response: input.response,
					orchestratorData: input.orchestratorData,
					sqlGenerationAttempts: input.sqlGenerationAttempts || [],
					validatorData: validatorDataWithResponseGen,
					ragContext: input.ragContext,
					stepsLog: input.stepsLog,
					tokenUsage: input.tokenUsage,
					totalDuration: input.totalDuration,
					status: input.status || 'completed',
					error: input.error,
				},
			});
			this.logger.debug(`Saved processing log | duration=${input.totalDuration || 'N/A'}ms`);
		} catch (error) {
			this.logger.warn('Failed to save processing log', error);
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
