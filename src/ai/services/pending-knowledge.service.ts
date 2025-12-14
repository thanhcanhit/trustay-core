import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ResultValidationResponse } from '../types/chat.types';

/**
 * Service để quản lý Pending Knowledge
 * Lưu Q&A đã được AI validate vào bảng pending, chờ admin approve trước khi lưu vào vector DB
 */
@Injectable()
export class PendingKnowledgeService {
	private readonly logger = new Logger(PendingKnowledgeService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly knowledge: KnowledgeService,
	) {}

	/**
	 * Save Q&A to pending knowledge table
	 * @param params - Pending knowledge data
	 * @returns Created pending knowledge record
	 */
	async savePendingKnowledge(params: {
		question: string;
		sql?: string;
		evaluation?: string;
		validatorData?: ResultValidationResponse;
		sessionId?: string;
		userId?: string;
		processingLogId?: string;
	}): Promise<{
		id: string;
		question: string;
		sql?: string;
		status: string;
		createdAt: Date;
	}> {
		try {
			const pendingKnowledge = await (this.prisma as any).pendingKnowledge.create({
				data: {
					question: params.question,
					sql: params.sql,
					evaluation: params.evaluation,
					status: 'pending',
					validatorData: params.validatorData
						? {
								isValid: params.validatorData.isValid,
								reason: params.validatorData.reason,
								violations: params.validatorData.violations,
								severity: params.validatorData.severity,
								evaluation: params.validatorData.evaluation,
								tokenUsage: params.validatorData.tokenUsage,
							}
						: undefined,
					sessionId: params.sessionId,
					userId: params.userId,
					processingLogId: params.processingLogId,
				},
			});

			this.logger.debug(
				`Saved pending knowledge | id=${pendingKnowledge.id} | question="${params.question.substring(0, 50)}..."`,
			);

			return {
				id: pendingKnowledge.id,
				question: pendingKnowledge.question,
				sql: pendingKnowledge.sql,
				status: pendingKnowledge.status,
				createdAt: pendingKnowledge.createdAt,
			};
		} catch (error) {
			this.logger.error('Failed to save pending knowledge', error);
			throw error;
		}
	}

	/**
	 * Approve pending knowledge and save to vector DB
	 * @param id - Pending knowledge ID
	 * @param approvedBy - User ID of admin who approved
	 * @returns Result with chunkId and sqlQAId from vector DB
	 */
	async approvePendingKnowledge(
		id: string,
		approvedBy: string,
	): Promise<{
		success: boolean;
		pendingKnowledgeId: string;
		chunkId?: number;
		sqlQAId?: number;
	}> {
		try {
			// Get pending knowledge
			const pending = await (this.prisma as any).pendingKnowledge.findUnique({
				where: { id },
			});

			if (!pending) {
				throw new Error(`Pending knowledge with id ${id} not found`);
			}

			if (pending.status !== 'pending') {
				throw new Error(
					`Pending knowledge with id ${id} is already ${pending.status}, cannot approve`,
				);
			}

			// Validate SQL is not null
			if (!pending.sql) {
				throw new Error(`Cannot approve pending knowledge ${id}: SQL is required but missing`);
			}

			// Save to vector DB via KnowledgeService (cannot use transaction with vector store)
			// If this fails, status remains 'pending' (OK)
			let vectorResult: { chunkId: number; sqlQAId: number };
			try {
				vectorResult = await this.knowledge.saveQAInteraction({
					question: pending.question,
					sql: pending.sql,
					sessionId: pending.sessionId || undefined,
					userId: pending.userId || undefined,
					context: {
						approvedFrom: id,
						approvedBy,
						originalValidatorData: pending.validatorData,
					},
				});
			} catch (vectorError) {
				this.logger.error(
					`Failed to save to vector DB for pending knowledge ${id}, status remains pending`,
					vectorError,
				);
				throw new Error(
					`Failed to save to vector DB: ${vectorError instanceof Error ? vectorError.message : String(vectorError)}`,
				);
			}

			// Update status to approved (only if vector DB save succeeded)
			// Use transaction to ensure atomicity of status update
			const result = await (this.prisma as any).$transaction(async (tx) => {
				// Double-check status is still pending (prevent race condition)
				const currentPending = await tx.pendingKnowledge.findUnique({
					where: { id },
				});
				if (!currentPending) {
					throw new Error(`Pending knowledge with id ${id} not found`);
				}
				if (currentPending.status !== 'pending') {
					throw new Error(
						`Pending knowledge with id ${id} is already ${currentPending.status}, cannot approve`,
					);
				}

				// Update status to approved
				await tx.pendingKnowledge.update({
					where: { id },
					data: {
						status: 'approved',
						approvedAt: new Date(),
						approvedBy,
					},
				});

				return vectorResult;
			});

			this.logger.log(
				`Approved pending knowledge | id=${id} | chunkId=${result.chunkId} | sqlQAId=${result.sqlQAId}`,
			);

			return {
				success: true,
				pendingKnowledgeId: id,
				chunkId: result.chunkId,
				sqlQAId: result.sqlQAId,
			};
		} catch (error) {
			this.logger.error(`Failed to approve pending knowledge id=${id}`, error);
			throw error;
		}
	}

	/**
	 * Reject pending knowledge
	 * @param id - Pending knowledge ID
	 * @param rejectedBy - User ID of admin who rejected
	 * @param reason - Rejection reason
	 * @returns Updated pending knowledge record
	 */
	async rejectPendingKnowledge(
		id: string,
		rejectedBy: string,
		reason: string,
	): Promise<{
		success: boolean;
		pendingKnowledgeId: string;
		status: string;
	}> {
		try {
			const pending = await (this.prisma as any).pendingKnowledge.findUnique({
				where: { id },
			});

			if (!pending) {
				throw new Error(`Pending knowledge with id ${id} not found`);
			}

			if (pending.status !== 'pending') {
				throw new Error(
					`Pending knowledge with id ${id} is already ${pending.status}, cannot reject`,
				);
			}

			await (this.prisma as any).pendingKnowledge.update({
				where: { id },
				data: {
					status: 'rejected',
					rejectedAt: new Date(),
					rejectedBy,
					rejectionReason: reason,
				},
			});

			this.logger.log(
				`Rejected pending knowledge | id=${id} | reason="${reason.substring(0, 50)}..."`,
			);

			return {
				success: true,
				pendingKnowledgeId: id,
				status: 'rejected',
			};
		} catch (error) {
			this.logger.error(`Failed to reject pending knowledge id=${id}`, error);
			throw error;
		}
	}

	/**
	 * Find pending knowledge by ID
	 * @param id - Pending knowledge ID
	 * @returns Pending knowledge record or null
	 */
	async findById(id: string): Promise<any | null> {
		try {
			return await (this.prisma as any).pendingKnowledge.findUnique({
				where: { id },
			});
		} catch (error) {
			this.logger.error(`Failed to find pending knowledge by id: ${id}`, error);
			return null;
		}
	}

	/**
	 * Find pending knowledge with pagination, search, and filters
	 * @param params - Query parameters
	 * @returns Paginated list of pending knowledge
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
				(this.prisma as any).pendingKnowledge.findMany({
					where,
					orderBy: { createdAt: 'desc' },
					take: limit,
					skip: offset,
				}),
				(this.prisma as any).pendingKnowledge.count({ where }),
			]);

			return {
				items: items || [],
				total: total || 0,
				limit,
				offset,
			};
		} catch (error) {
			this.logger.error('Failed to find pending knowledge', error);
			return {
				items: [],
				total: 0,
				limit: params.limit || 20,
				offset: params.offset || 0,
			};
		}
	}
}
