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
			const reasonMatch = response.match(/REASON:\s*(.+?)(?=\n(?:SEVERITY|VIOLATIONS)|$)/s);

			// Fail-closed: Default to false if parsing fails
			// But also check if AI explicitly says "valid" or "invalid" in text
			const hasExplicitInvalid =
				response.toLowerCase().includes('invalid') ||
				response.toLowerCase().includes('không hợp lệ') ||
				response.toLowerCase().includes('không đúng');
			const hasExplicitValid =
				response.toLowerCase().includes('valid') ||
				response.toLowerCase().includes('hợp lệ') ||
				response.toLowerCase().includes('đúng');

			let isValid = false;
			if (isValidMatch) {
				isValid = isValidMatch[1].toLowerCase() === 'true';
			} else if (hasExplicitInvalid) {
				isValid = false;
			} else if (hasExplicitValid && !hasExplicitInvalid) {
				// MVP: If AI explicitly says valid but no IS_VALID field, allow it (relaxed for MVP)
				isValid = true;
			} else {
				// Fail-closed: Default to invalid if cannot determine
				isValid = false;
			}

			const reason = reasonMatch ? reasonMatch[1].trim() : undefined;

			// Parse violations if present
			const violationsMatch = response.match(/VIOLATIONS:\s*(.+?)(?=\n|$)/s);
			const violations = violationsMatch
				? violationsMatch[1]
						.split(',')
						.map((v) => v.trim())
						.filter((v) => v.length > 0)
				: undefined;

			// Parse severity if present
			const severityMatch = response.match(/SEVERITY:\s*(ERROR|WARN)/i);
			const severity = severityMatch
				? (severityMatch[1].toUpperCase() as 'ERROR' | 'WARN')
				: isValid
					? undefined
					: 'ERROR'; // Default to ERROR if invalid

			this.logger.debug(
				`Validation result: isValid=${isValid}, severity=${severity}${reason ? `, reason=${reason}` : ''}${violations ? `, violations=[${violations.length}]` : ''}`,
			);

			return {
				isValid,
				reason,
				violations,
				severity,
			};
		} catch (error) {
			this.logger.error('Result validator error:', error);
			// Fail-closed: Default to invalid if validation fails
			return {
				isValid: false,
				reason: 'Validation failed due to error',
				violations: ['Validator exception occurred'],
				severity: 'ERROR',
			};
		}
	}
}
