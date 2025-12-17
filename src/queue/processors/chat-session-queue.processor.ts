import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SummaryAgent } from '../../ai/agents/summary-agent';
import { ChatSessionService } from '../../ai/services/chat-session.service';
import { AutoTitleJobData, SummaryGenerationJobData } from '../services/chat-session-queue.service';

@Processor('chat-session-queue')
export class ChatSessionQueueProcessor {
	private readonly logger = new Logger(ChatSessionQueueProcessor.name);
	private readonly summaryAgent: SummaryAgent;

	constructor(private readonly chatSessionService: ChatSessionService) {
		this.summaryAgent = new SummaryAgent();
	}

	/**
	 * Process auto-title generation job
	 * Generates title from first user message
	 */
	@Process('generate-title')
	async processAutoTitle(job: Job<AutoTitleJobData>) {
		this.logger.debug(
			`Processing auto-title job | sessionId=${job.data.sessionId} (Attempt: ${job.attemptsMade + 1})`,
		);

		try {
			const { sessionId, firstUserMessage } = job.data;

			// Generate title using SummaryAgent
			const title = await this.summaryAgent.generateTitle(firstUserMessage);

			// Update session title
			await this.chatSessionService.updateSessionTitle(sessionId, title);

			this.logger.log(`✅ Auto-title generated | sessionId=${sessionId} | title="${title}"`);

			return { success: true, sessionId, title };
		} catch (error) {
			this.logger.error(
				`❌ Failed to generate auto-title: ${(error as Error).message}`,
				error.stack,
			);
			throw error; // Will trigger retry
		}
	}

	/**
	 * Process summary generation job
	 * Generates rolling summary from existing summary + old messages
	 */
	@Process('generate-summary')
	async processSummaryGeneration(job: Job<SummaryGenerationJobData>) {
		this.logger.debug(
			`Processing summary generation job | sessionId=${job.data.sessionId} (Attempt: ${job.attemptsMade + 1})`,
		);

		try {
			const { sessionId, oldMessagesCount } = job.data;

			// Get session to retrieve current summary
			const session = await this.chatSessionService.getSession(sessionId);
			if (!session) {
				throw new Error(`Session not found: ${sessionId}`);
			}

			// Get old messages that haven't been summarized
			const oldMessages = await this.chatSessionService.getOldMessages(sessionId, oldMessagesCount);

			if (oldMessages.length === 0) {
				this.logger.warn(`No old messages to summarize | sessionId=${sessionId}`);
				return { success: true, sessionId, skipped: true, reason: 'No old messages' };
			}

			// Convert to format expected by SummaryAgent
			const messagesForSummary = oldMessages.map((m) => ({
				role: m.role,
				content: m.content,
			}));

			// Generate rolling summary
			const newSummary = await this.summaryAgent.generateRollingSummary(
				session.summary || null,
				messagesForSummary,
			);

			// Update session summary
			await this.chatSessionService.updateSessionSummary(sessionId, newSummary);

			this.logger.log(
				`✅ Summary generated | sessionId=${sessionId} | summaryLength=${newSummary.length} | oldMessagesCount=${oldMessages.length}`,
			);

			return { success: true, sessionId, summaryLength: newSummary.length };
		} catch (error) {
			this.logger.error(`❌ Failed to generate summary: ${(error as Error).message}`, error.stack);
			throw error; // Will trigger retry
		}
	}
}
