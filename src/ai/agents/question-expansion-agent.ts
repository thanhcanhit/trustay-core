import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { AI_MODELS, AI_TEMPERATURE, MAX_OUTPUT_TOKENS } from '../config/agent.config';
import { buildQuestionExpansionPrompt } from '../prompts/question-expansion-agent.prompt';

/**
 * Question Expansion Agent
 * Expands short modification queries into full canonical questions
 * Example: "Tăng thêm 2 triệu" → "Tìm phòng Gò Vấp có xe hơi 5 triệu"
 */
export class QuestionExpansionAgent {
	private readonly logger = new Logger(QuestionExpansionAgent.name);

	// Configuration constants - using shared config

	/**
	 * Expand short question to full canonical question
	 * @param shortQuestion - Current user question (may be short)
	 * @param previousSql - Previous SQL query
	 * @param previousCanonicalQuestion - Previous canonical question (if available)
	 * @returns Expanded canonical question
	 */
	async expandQuestion(
		shortQuestion: string,
		previousSql: string,
		previousCanonicalQuestion?: string,
	): Promise<string> {
		try {
			const prompt = buildQuestionExpansionPrompt(
				shortQuestion,
				previousSql,
				previousCanonicalQuestion,
			);
			const startTime = Date.now();
			const { text } = await generateText({
				model: google(AI_MODELS.LIGHT),
				prompt,
				temperature: AI_TEMPERATURE.STANDARD,
				maxOutputTokens: MAX_OUTPUT_TOKENS.EXPANSION,
			});
			const duration = Date.now() - startTime;
			// Clean up canonical question
			let canonicalQuestion = text.trim();
			canonicalQuestion = canonicalQuestion.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
			canonicalQuestion = canonicalQuestion.replace(/[.!?]+$/, ''); // Remove trailing punctuation
			canonicalQuestion = canonicalQuestion.trim();
			this.logger.debug(
				`Expanded question | original="${shortQuestion.substring(0, 50)}..." | canonical="${canonicalQuestion.substring(0, 80)}..." | duration=${duration}ms`,
			);
			return canonicalQuestion || shortQuestion; // Fallback to original if expansion fails
		} catch (error) {
			this.logger.error(`Failed to expand question: ${(error as Error).message}`, error);
			// Fallback: return original question
			return shortQuestion;
		}
	}
}
