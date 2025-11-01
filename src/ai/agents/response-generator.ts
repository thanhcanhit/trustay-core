import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import {
	buildFinalResponsePrompt,
	buildFriendlyResponsePrompt,
	getNoResultsMessage,
	getSuccessMessage,
} from '../prompts/response-generator.prompt';
import { ChatSession, SqlGenerationResult } from '../types/chat.types';
import {
	inferColumns,
	isListLike,
	normalizeRows,
	selectImportantColumns,
	toListItems,
	tryBuildChart,
} from '../utils/data-utils';

/**
 * Response Generator - Generates human-friendly responses from SQL results with structured data
 */
export class ResponseGenerator {
	private readonly logger = new Logger(ResponseGenerator.name);

	/**
	 * Generate final response combining conversational context with SQL results
	 * Format: message text ---END LIST: [] TABLE: {} CHART: {}
	 * @param conversationalMessage - Message from orchestrator agent
	 * @param sqlResult - SQL execution result
	 * @param session - Chat session for context
	 * @param aiConfig - AI configuration
	 * @param desiredMode - Desired output mode (LIST/TABLE/CHART)
	 * @returns Final combined response with ---END delimiter and structured data
	 */
	async generateFinalResponse(
		conversationalMessage: string,
		sqlResult: SqlGenerationResult,
		session: ChatSession,
		aiConfig: { model: string; temperature: number; maxTokens: number },
		desiredMode?: 'LIST' | 'TABLE' | 'CHART',
	): Promise<string> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-3)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');

		// Build structured data payload
		const structuredData = this.buildStructuredData(sqlResult.results, desiredMode);

		const finalPrompt = buildFinalResponsePrompt({
			recentMessages,
			conversationalMessage,
			count: sqlResult.count,
			dataPreview: JSON.stringify(sqlResult.results).substring(0, 800),
			structuredData,
		});

		try {
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: finalPrompt,
				temperature: 0.3,
				maxOutputTokens: 500,
			});
			const responseText = text.trim();

			// Ensure ---END format is present, if not, append it
			if (!responseText.includes('---END')) {
				this.logger.warn('AI response missing ---END delimiter, appending structured data');
				return `${responseText}\n---END\n${this.formatStructuredDataString(structuredData)}`;
			}

			return responseText;
		} catch (error) {
			this.logger.warn('Failed to generate final response, using fallback', error);
			const messageText =
				sqlResult.count === 0 ? getNoResultsMessage() : getSuccessMessage(sqlResult.count);
			return `${messageText}\n---END\n${this.formatStructuredDataString(structuredData)}`;
		}
	}

	/**
	 * Build structured data from SQL results
	 * @param results - SQL query results
	 * @param desiredMode - Desired output mode
	 * @returns Structured data object with LIST/TABLE/CHART
	 */
	private buildStructuredData(
		results: unknown,
		desiredMode?: 'LIST' | 'TABLE' | 'CHART',
	): { list: any[] | null; table: any | null; chart: any | null } {
		if (!Array.isArray(results) || results.length === 0 || typeof results[0] !== 'object') {
			return { list: null, table: null, chart: null };
		}

		const rows = results as ReadonlyArray<Record<string, unknown>>;

		// Prefer LIST mode
		if (desiredMode === 'LIST' || isListLike(rows)) {
			const items = toListItems(rows).slice(0, 50);
			return {
				list: items,
				table: null,
				chart: null,
			};
		}

		// Try CHART for aggregate/statistics-like data
		if (desiredMode === 'CHART') {
			const chartData = tryBuildChart(rows);
			if (chartData) {
				return {
					list: null,
					table: null,
					chart: {
						mimeType: 'image/png',
						url: chartData.url,
						width: chartData.width,
						height: chartData.height,
						alt: 'Chart (Top 10)',
					},
				};
			}
		}

		// Fallback to TABLE
		const inferred = inferColumns(rows);
		const columns = selectImportantColumns(inferred, rows);
		const normalized = normalizeRows(rows, columns).slice(0, 50);
		return {
			list: null,
			table: {
				columns,
				rows: normalized,
				previewLimit: 50,
			},
			chart: null,
		};
	}

	/**
	 * Format structured data as string for appending after ---END
	 * @param structuredData - Structured data object
	 * @returns Formatted string
	 */
	private formatStructuredDataString(structuredData: {
		list: any[] | null;
		table: any | null;
		chart: any | null;
	}): string {
		const parts: string[] = [];
		if (structuredData.list !== null) {
			parts.push(`LIST: ${JSON.stringify(structuredData.list)}`);
		} else {
			parts.push('LIST: null');
		}
		if (structuredData.table !== null) {
			parts.push(`TABLE: ${JSON.stringify(structuredData.table)}`);
		} else {
			parts.push('TABLE: null');
		}
		if (structuredData.chart !== null) {
			parts.push(`CHART: ${JSON.stringify(structuredData.chart)}`);
		} else {
			parts.push('CHART: null');
		}
		return parts.join('\n');
	}

	/**
	 * Generate friendly response from SQL results
	 * @param query - Original user query
	 * @param sqlResult - SQL execution result
	 * @param session - Chat session for context
	 * @param aiConfig - AI configuration
	 * @returns Human-friendly response
	 */
	async generateFriendlyResponse(
		query: string,
		sqlResult: SqlGenerationResult,
		session: ChatSession,
		aiConfig: { model: string; temperature: number; maxTokens: number },
	): Promise<string> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-3)
			.map((m) => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`)
			.join('\n');
		const responsePrompt = buildFriendlyResponsePrompt({
			recentMessages,
			query,
			count: sqlResult.count,
			dataPreview: JSON.stringify(sqlResult.results).substring(0, 1000),
		});
		try {
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: responsePrompt,
				temperature: 0.3,
				maxOutputTokens: 300,
			});
			return text.trim();
		} catch {
			return sqlResult.count === 0
				? getNoResultsMessage(query)
				: getSuccessMessage(sqlResult.count, query);
		}
	}
}
