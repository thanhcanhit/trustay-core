import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { AI_MODELS, AI_TEMPERATURE, MAX_OUTPUT_TOKENS } from '../config/agent.config';
import {
	buildRollingSummaryPrompt,
	buildTitleGenerationPrompt,
} from '../prompts/summary-agent.prompt';

/**
 * Summary Agent - Tách riêng để xử lý tóm tắt và tạo tiêu đề
 * Sử dụng model nhỏ/rẻ để tối ưu chi phí
 */
export class SummaryAgent {
	private readonly logger = new Logger(SummaryAgent.name);

	// Configuration constants
	private static readonly TITLE_MAX_WORDS = 15; // Increased from 7 to allow more context
	private static readonly TITLE_MAX_CHARS = 100; // Max characters as fallback
	private static readonly SUMMARY_MAX_WORDS = 200;

	/**
	 * Generate title from first user message
	 * @param firstUserMessage - First user message in conversation
	 * @returns Generated title (5-7 words)
	 */
	async generateTitle(firstUserMessage: string): Promise<string> {
		try {
			const prompt = buildTitleGenerationPrompt(firstUserMessage);
			const startTime = Date.now();
			const { text } = await generateText({
				model: google(AI_MODELS.LIGHT),
				prompt,
				temperature: AI_TEMPERATURE.STANDARD,
				maxOutputTokens: MAX_OUTPUT_TOKENS.SUMMARY,
			});
			const duration = Date.now() - startTime;
			// Clean up title: remove quotes, extra whitespace, trailing punctuation
			let title = text.trim();
			title = title.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
			title = title.replace(/[.!?]+$/, ''); // Remove trailing punctuation
			title = title.trim();
			// Limit to max words, but ensure title is meaningful and complete
			const words = title.split(/\s+/);
			if (words.length > SummaryAgent.TITLE_MAX_WORDS) {
				// Cut at max words, but check if we're cutting at an incomplete phrase
				let cutTitle = words.slice(0, SummaryAgent.TITLE_MAX_WORDS).join(' ');
				// Remove incomplete phrases at the end (common Vietnamese particles/prepositions)
				const incompleteEndings = [
					'của',
					'và',
					'hoặc',
					'với',
					'cho',
					'từ',
					'đến',
					'trong',
					'ngoài',
					'theo',
					'về',
				];
				const lastWord = words[SummaryAgent.TITLE_MAX_WORDS - 1]?.toLowerCase();
				if (lastWord && incompleteEndings.includes(lastWord)) {
					// Remove the incomplete ending word
					cutTitle = words.slice(0, SummaryAgent.TITLE_MAX_WORDS - 1).join(' ');
				}
				title = cutTitle;
			}
			// Also check character limit as fallback
			if (title.length > SummaryAgent.TITLE_MAX_CHARS) {
				// Cut at character limit, but try to cut at word boundary
				const truncated = title.substring(0, SummaryAgent.TITLE_MAX_CHARS);
				const lastSpaceIndex = truncated.lastIndexOf(' ');
				if (lastSpaceIndex > SummaryAgent.TITLE_MAX_CHARS * 0.7) {
					// Only cut at word boundary if we're not losing too much
					title = truncated.substring(0, lastSpaceIndex);
				} else {
					title = truncated;
				}
			}
			this.logger.debug(
				`Generated title | title="${title}" | duration=${duration}ms | original="${firstUserMessage.substring(0, 50)}..."`,
			);
			return title || 'New Chat'; // Fallback
		} catch (error) {
			this.logger.error(`Failed to generate title: ${(error as Error).message}`, error);
			// Fallback: extract first few words from message, but ensure meaningful
			const words = firstUserMessage.trim().split(/\s+/).slice(0, SummaryAgent.TITLE_MAX_WORDS);
			let fallbackTitle = words.join(' ');
			// Remove incomplete endings in fallback too
			const incompleteEndings = [
				'của',
				'và',
				'hoặc',
				'với',
				'cho',
				'từ',
				'đến',
				'trong',
				'ngoài',
				'theo',
				'về',
			];
			const lastWord = words[words.length - 1]?.toLowerCase();
			if (lastWord && incompleteEndings.includes(lastWord) && words.length > 1) {
				fallbackTitle = words.slice(0, words.length - 1).join(' ');
			}
			return fallbackTitle || 'New Chat';
		}
	}

	/**
	 * Generate rolling summary from existing summary + old messages
	 * @param existingSummary - Current summary (null if none exists)
	 * @param oldMessages - Old messages that haven't been summarized yet
	 * @returns Generated summary
	 */
	async generateRollingSummary(
		existingSummary: string | null,
		oldMessages: Array<{ role: string; content: string }>,
	): Promise<string> {
		try {
			if (!oldMessages || oldMessages.length === 0) {
				return existingSummary || '';
			}
			const prompt = buildRollingSummaryPrompt(existingSummary, oldMessages);
			const startTime = Date.now();
			const { text } = await generateText({
				model: google(AI_MODELS.LIGHT),
				prompt,
				temperature: AI_TEMPERATURE.STANDARD,
				maxOutputTokens: MAX_OUTPUT_TOKENS.SUMMARY * 2, // Summary needs more tokens
			});
			const duration = Date.now() - startTime;
			// Clean up summary
			let summary = text.trim();
			summary = summary.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
			summary = summary.trim();
			// Limit to max words
			const words = summary.split(/\s+/);
			if (words.length > SummaryAgent.SUMMARY_MAX_WORDS) {
				summary = words.slice(0, SummaryAgent.SUMMARY_MAX_WORDS).join(' ');
			}
			this.logger.debug(
				`Generated rolling summary | length=${summary.length} | duration=${duration}ms | oldMessagesCount=${oldMessages.length}`,
			);
			return summary;
		} catch (error) {
			this.logger.error(`Failed to generate rolling summary: ${(error as Error).message}`, error);
			// Fallback: return existing summary or empty string
			return existingSummary || '';
		}
	}
}
