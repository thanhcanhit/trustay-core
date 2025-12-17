import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { AI_TEMPERATURE, MAX_OUTPUT_TOKENS, PREVIEW_LENGTHS } from '../config/agent.config';
import { buildResultValidatorPrompt } from '../prompts/result-validator-agent.prompt';
import { RequestType, ResultValidationResponse, TokenUsage } from '../types/chat.types';

/**
 * Agent 4: Result Validator Agent - Validates SQL results before persisting to knowledge store
 */
export class ResultValidatorAgent {
	private readonly logger = new Logger(ResultValidatorAgent.name);

	// Configuration constants
	private static readonly RESULTS_PREVIEW_LENGTH = 1000;
	// Configuration constants - using shared config
	// Validation keywords
	private static readonly KEYWORD_INVALID_EN = 'invalid';
	private static readonly KEYWORD_INVALID_VI = 'không hợp lệ';
	private static readonly KEYWORD_INVALID_COMPLETE = 'sai hoàn toàn';
	private static readonly KEYWORD_INVALID_TYPE = 'sai loại dữ liệu';
	private static readonly KEYWORD_VALID_EN = 'valid';
	private static readonly KEYWORD_VALID_VI = 'hợp lệ';
	private static readonly KEYWORD_VALID_CORRECT = 'đúng';
	private static readonly KEYWORD_VALID_OK = 'ok';
	// Boolean strings
	private static readonly BOOLEAN_TRUE = 'true';
	private static readonly BOOLEAN_FALSE = 'false';
	// Severity strings
	private static readonly SEVERITY_ERROR = 'ERROR';
	private static readonly SEVERITY_WARN = 'WARN';
	// Delimiters
	private static readonly DELIMITER_VIOLATIONS = ',';
	// Error messages
	private static readonly ERROR_MESSAGE_VALIDATION_FAILED = 'Validation failed due to error';
	private static readonly ERROR_VIOLATION_EXCEPTION = 'Validator exception occurred';

	/**
	 * Validate SQL results against original request
	 * @param originalQuery - Original user query (short, context-dependent)
	 * @param canonicalQuestion - Expanded canonical question (full context, used for SQL generation)
	 * @param sql - Generated SQL query
	 * @param results - SQL execution results
	 * @param expectedType - Expected request type
	 * @param aiConfig - AI configuration
	 * @returns Validation result with isValid and reason
	 */
	async validateResult(
		originalQuery: string,
		canonicalQuestion: string,
		sql: string,
		results: unknown,
		expectedType: RequestType,
		aiConfig: { model: string; temperature: number; maxTokens: number },
	): Promise<ResultValidationResponse> {
		const resultsCount = Array.isArray(results) ? results.length : results ? 1 : 0;
		const resultsPreview = JSON.stringify(results).substring(
			0,
			ResultValidatorAgent.RESULTS_PREVIEW_LENGTH,
		);

		const validatorPrompt = buildResultValidatorPrompt({
			originalQuery,
			canonicalQuestion,
			sql,
			resultsCount,
			resultsPreview,
			expectedType,
		});

		try {
			this.logger.debug(
				`Validating results | originalQuery="${originalQuery}" | canonicalQuestion="${canonicalQuestion}"${canonicalQuestion !== originalQuery ? ' (EXPANDED)' : ' (SAME)'} | type: ${expectedType}`,
			);
			const { text, usage } = await generateText({
				model: google(aiConfig.model),
				prompt: validatorPrompt,
				temperature: AI_TEMPERATURE.PRECISE,
				maxOutputTokens: MAX_OUTPUT_TOKENS.VALIDATION,
			});
			const tokenUsage: TokenUsage | undefined = usage
				? {
						promptTokens: (usage as any).promptTokens || (usage as any).prompt || 0,
						completionTokens: (usage as any).completionTokens || (usage as any).completion || 0,
						totalTokens:
							(usage as any).totalTokens ||
							((usage as any).promptTokens || (usage as any).prompt || 0) +
								((usage as any).completionTokens || (usage as any).completion || 0),
					}
				: undefined;

			const validatorResponseText = text.trim();
			this.logger.debug(
				`Validator response: ${validatorResponseText.substring(0, PREVIEW_LENGTHS.LOG)}...`,
			);

			// Parse response to extract validation result
			const isValidMatch = validatorResponseText.match(
				new RegExp(
					`IS_VALID:\\s*(${ResultValidatorAgent.BOOLEAN_TRUE}|${ResultValidatorAgent.BOOLEAN_FALSE})`,
					'i',
				),
			);
			const reasonMatch = validatorResponseText.match(
				/REASON:\s*(.+?)(?=\n(?:SEVERITY|VIOLATIONS)|$)/s,
			);

			// Parse severity FIRST để có thể sử dụng trong logic
			const severityMatch = validatorResponseText.match(
				new RegExp(
					`SEVERITY:\\s*(${ResultValidatorAgent.SEVERITY_ERROR}|${ResultValidatorAgent.SEVERITY_WARN})`,
					'i',
				),
			);
			const parsedSeverity = severityMatch
				? (severityMatch[1].toUpperCase() as 'ERROR' | 'WARN')
				: undefined;

			// Balanced approach: ƯU TIÊN LƯU - chỉ reject khi có lỗi nghiêm trọng
			// Check if AI explicitly says "valid" or "invalid" in text
			const responseLower = validatorResponseText.toLowerCase();
			const hasExplicitInvalid =
				responseLower.includes(ResultValidatorAgent.KEYWORD_INVALID_EN) ||
				responseLower.includes(ResultValidatorAgent.KEYWORD_INVALID_VI) ||
				responseLower.includes(ResultValidatorAgent.KEYWORD_INVALID_COMPLETE) ||
				responseLower.includes(ResultValidatorAgent.KEYWORD_INVALID_TYPE);
			const hasExplicitValid =
				responseLower.includes(ResultValidatorAgent.KEYWORD_VALID_EN) ||
				responseLower.includes(ResultValidatorAgent.KEYWORD_VALID_VI) ||
				responseLower.includes(ResultValidatorAgent.KEYWORD_VALID_CORRECT) ||
				responseLower.includes(ResultValidatorAgent.KEYWORD_VALID_OK);

			// Default: ƯU TIÊN LƯU (isValid = true) trừ khi có lỗi nghiêm trọng
			let isValid = true; // Default to valid để ưu tiên lưu

			if (isValidMatch) {
				// Nếu AI trả về IS_VALID rõ ràng, dùng giá trị đó
				isValid = isValidMatch[1].toLowerCase() === ResultValidatorAgent.BOOLEAN_TRUE;
			} else if (parsedSeverity === ResultValidatorAgent.SEVERITY_ERROR) {
				// Nếu có ERROR severity → invalid
				isValid = false;
			} else if (hasExplicitInvalid && !hasExplicitValid) {
				// Nếu AI rõ ràng nói invalid và không có valid → invalid (nhưng chỉ khi không có severity WARN)
				if (parsedSeverity !== ResultValidatorAgent.SEVERITY_WARN) {
					isValid = false;
				}
			} else if (hasExplicitValid && !hasExplicitInvalid) {
				// Nếu AI nói valid → valid
				isValid = true;
			} else {
				// Default: Valid nếu không có ERROR severity rõ ràng
				// parsedSeverity có thể là undefined, 'WARN', hoặc 'ERROR'
				// Nhưng ở đây đã loại trừ 'ERROR' ở trên, nên chỉ còn undefined hoặc 'WARN'
				isValid = true; // Default to valid để ưu tiên lưu
				this.logger.debug(
					`Cannot parse IS_VALID field, defaulting to isValid=${isValid} (severity=${parsedSeverity || 'none'})`,
				);
			}

			const reason = reasonMatch ? reasonMatch[1].trim() : undefined;

			// Parse violations if present
			const violationsMatch = validatorResponseText.match(
				/VIOLATIONS:\s*(.+?)(?=\n(?:REASON|EVALUATION|$)|$)/s,
			);
			const violations = violationsMatch
				? violationsMatch[1]
						.split(ResultValidatorAgent.DELIMITER_VIOLATIONS)
						.map((v) => v.trim())
						.filter((v) => v.length > 0)
				: undefined;

			// Parse evaluation if present
			// Try to match EVALUATION: followed by content until next field or end
			let evaluationMatch = validatorResponseText.match(
				/EVALUATION:\s*(.+?)(?=\n(?:IS_VALID|SEVERITY|VIOLATIONS|REASON|$)|$)/s,
			);
			// Fallback: if no match, try to find EVALUATION: and take everything after it to the end
			if (!evaluationMatch) {
				const evaluationIndex = validatorResponseText.indexOf('EVALUATION:');
				if (evaluationIndex !== -1) {
					const evaluationText = validatorResponseText
						.substring(evaluationIndex + 'EVALUATION:'.length)
						.trim();
					if (evaluationText.length > 0) {
						evaluationMatch = [null, evaluationText];
					}
				}
			}
			const evaluation = evaluationMatch ? evaluationMatch[1].trim() : undefined;

			// Set severity: ERROR nếu invalid, WARN nếu có vấn đề nhỏ, undefined nếu OK
			const severity =
				parsedSeverity || (isValid ? undefined : ResultValidatorAgent.SEVERITY_ERROR);

			this.logger.debug(
				`Validation result: isValid=${isValid}, severity=${severity}${reason ? `, reason=${reason}` : ''}${violations ? `, violations=[${violations.length}]` : ''}${evaluation ? `, evaluation=${evaluation.substring(0, 100)}...` : ''}`,
			);

			return {
				isValid,
				reason,
				violations,
				severity,
				evaluation,
				tokenUsage,
				originalQuestion: originalQuery,
				canonicalQuestion: canonicalQuestion,
			};
		} catch (error) {
			this.logger.error('Result validator error:', error);
			// Fail-closed: Default to invalid if validation fails
			return {
				isValid: false,
				reason: ResultValidatorAgent.ERROR_MESSAGE_VALIDATION_FAILED,
				violations: [ResultValidatorAgent.ERROR_VIOLATION_EXCEPTION],
				severity: ResultValidatorAgent.SEVERITY_ERROR,
				tokenUsage: undefined,
				originalQuestion: originalQuery,
				canonicalQuestion: canonicalQuestion,
			};
		}
	}
}
