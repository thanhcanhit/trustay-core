import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

export interface AutoTitleJobData {
	sessionId: string;
	firstUserMessage: string;
}

export interface SummaryGenerationJobData {
	sessionId: string;
	oldMessagesCount: number;
}

@Injectable()
export class ChatSessionQueueService {
	private readonly logger = new Logger(ChatSessionQueueService.name);

	constructor(@InjectQueue('chat-session-queue') private chatSessionQueue: Queue) {}

	/**
	 * Queue job to generate auto-title for session
	 * Triggered when session has exactly 2 messages (1 user + 1 assistant)
	 * @param sessionId - Session ID
	 * @param firstUserMessage - First user message content
	 */
	async queueAutoTitle(sessionId: string, firstUserMessage: string): Promise<void> {
		try {
			const jobData: AutoTitleJobData = {
				sessionId,
				firstUserMessage,
			};
			await this.chatSessionQueue.add('generate-title', jobData, {
				priority: 5, // Lower priority (not urgent)
				delay: 1000, // Delay 1 second to avoid blocking response
			});
			this.logger.debug(`Queued auto-title job | sessionId=${sessionId}`);
		} catch (error) {
			this.logger.error(`Failed to queue auto-title job: ${sessionId}`, error);
		}
	}

	/**
	 * Queue job to generate rolling summary
	 * Triggered when messageCount > threshold (e.g., 10)
	 * @param sessionId - Session ID
	 * @param oldMessagesCount - Number of old messages to summarize
	 */
	async queueSummaryGeneration(sessionId: string, oldMessagesCount: number): Promise<void> {
		try {
			const jobData: SummaryGenerationJobData = {
				sessionId,
				oldMessagesCount,
			};
			await this.chatSessionQueue.add('generate-summary', jobData, {
				priority: 4, // Lower priority (background task)
				delay: 2000, // Delay 2 seconds to avoid blocking response
			});
			this.logger.debug(
				`Queued summary generation job | sessionId=${sessionId} | oldMessagesCount=${oldMessagesCount}`,
			);
		} catch (error) {
			this.logger.error(`Failed to queue summary generation job: ${sessionId}`, error);
		}
	}

	/**
	 * Get queue stats
	 */
	async getQueueStats() {
		try {
			const [waiting, active, completed, failed, delayed] = await Promise.all([
				this.chatSessionQueue.getWaitingCount(),
				this.chatSessionQueue.getActiveCount(),
				this.chatSessionQueue.getCompletedCount(),
				this.chatSessionQueue.getFailedCount(),
				this.chatSessionQueue.getDelayedCount(),
			]);

			return {
				waiting,
				active,
				completed,
				failed,
				delayed,
				total: waiting + active + completed + failed + delayed,
			};
		} catch (error) {
			this.logger.error('Failed to get queue stats', error);
			return {
				waiting: 0,
				active: 0,
				completed: 0,
				failed: 0,
				delayed: 0,
				total: 0,
			};
		}
	}
}
