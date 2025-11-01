import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { buildResultValidatorPrompt } from '../prompts/result-validator-agent.prompt';
import { RequestType, ResultValidationResponse } from '../types/chat.types';

/**
 * Agent 4: Result Validator Agent - Validates SQL results before persisting to knowledge store
 */
export class ResultValidatorAgent {
	private readonly logger = new Logger(ResultValidatorAgent.name);

	/**
	 * Validate SQL results against original request
	 * @param query - Original user query
	 * @param sql - Generated SQL query
	 * @param results - SQL execution results
	 * @param expectedType - Expected request type
	 * @param aiConfig - AI configuration
	 * @returns Validation result with isValid and reason
	 */
	async validateResult(
		query: string,
		sql: string,
		results: unknown,
		expectedType: RequestType,
		aiConfig: { model: string; temperature: number; maxTokens: number },
	): Promise<ResultValidationResponse> {
		const resultsCount = Array.isArray(results) ? results.length : results ? 1 : 0;
		const resultsPreview = JSON.stringify(results).substring(0, 1000);

		const validatorPrompt = buildResultValidatorPrompt({
			query,
			sql,
			resultsCount,
			resultsPreview,
			expectedType,
		});

		try {
			this.logger.debug(`Validating results for query: "${query}" (type: ${expectedType})`);
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: validatorPrompt,
				temperature: 0.2,
				maxOutputTokens: 300,
			});

			const response = text.trim();
			this.logger.debug(`Validator response: ${response.substring(0, 200)}...`);

			// Parse response to extract validation result
			const isValidMatch = response.match(/IS_VALID:\s*(true|false)/i);
			const reasonMatch = response.match(/REASON:\s*(.+)/s);

			const isValid =
				isValidMatch && isValidMatch[1].toLowerCase() === 'true'
					? true
					: isValidMatch && isValidMatch[1].toLowerCase() === 'false'
						? false
						: true; // Default to valid if parsing fails

			const reason = reasonMatch ? reasonMatch[1].trim() : undefined;

			this.logger.debug(
				`Validation result: isValid=${isValid}${reason ? `, reason=${reason}` : ''}`,
			);

			return {
				isValid,
				reason,
			};
		} catch (error) {
			this.logger.error('Result validator error:', error);
			// Default to valid if validation fails (don't block persistence)
			return {
				isValid: true,
				reason: 'Validation failed, defaulting to valid',
			};
		}
	}
}
