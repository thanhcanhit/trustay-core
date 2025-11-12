import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import {
	buildFinalMessagePrompt,
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
import { buildEntityPath } from '../utils/entity-route';

/**
 * Response Generator - Generates human-friendly responses from SQL results with structured data
 */
export class ResponseGenerator {
	private readonly logger = new Logger(ResponseGenerator.name);

	// Configuration constants
	private static readonly RECENT_MESSAGES_LIMIT = 3;
	private static readonly TEMPERATURE = 0.3;
	private static readonly MAX_OUTPUT_TOKENS_FINAL = 500;
	private static readonly MAX_OUTPUT_TOKENS_FRIENDLY = 300;
	private static readonly DATA_PREVIEW_LENGTH_FINAL = 800;
	private static readonly DATA_PREVIEW_LENGTH_FRIENDLY = 1000;
	private static readonly LIST_ITEMS_LIMIT = 50;
	private static readonly TABLE_ROWS_LIMIT = 50;
	private static readonly PREVIEW_LIMIT = 50;
	// Chart constants
	private static readonly CHART_MIME_TYPE = 'image/png';
	private static readonly CHART_ALT_TEXT = 'Chart (Top 10)';
	// Entity types
	private static readonly ENTITY_ROOM = 'room';
	private static readonly ENTITY_POST = 'post';
	private static readonly ENTITY_ROOM_SEEKING_POST = 'room_seeking_post';
	// Message labels
	private static readonly LABEL_USER = 'Người dùng';
	private static readonly LABEL_AI = 'AI';
	// Mode strings
	private static readonly MODE_LIST = 'LIST';
	private static readonly MODE_TABLE = 'TABLE';
	private static readonly MODE_CHART = 'CHART';
	private static readonly MODE_NONE = 'NONE';

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
			.slice(-ResponseGenerator.RECENT_MESSAGES_LIMIT)
			.map(
				(m) =>
					`${m.role === 'user' ? ResponseGenerator.LABEL_USER : ResponseGenerator.LABEL_AI}: ${m.content}`,
			)
			.join('\n');

		// Build structured data payload
		const structuredData = this.buildStructuredData(sqlResult.results, desiredMode);

		// Build message-only prompt for the LLM
		const finalPrompt = buildFinalMessagePrompt({
			recentMessages,
			conversationalMessage,
			count: sqlResult.count,
			dataPreview: JSON.stringify(sqlResult.results).substring(
				0,
				ResponseGenerator.DATA_PREVIEW_LENGTH_FINAL,
			),
			structuredData,
		});

		try {
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: finalPrompt,
				temperature: ResponseGenerator.TEMPERATURE,
				maxOutputTokens: ResponseGenerator.MAX_OUTPUT_TOKENS_FINAL,
			});
			const messageText = text.trim();
			const mode: 'LIST' | 'TABLE' | 'CHART' | 'NONE' = structuredData.list
				? ResponseGenerator.MODE_LIST
				: structuredData.chart
					? ResponseGenerator.MODE_CHART
					: structuredData.table
						? ResponseGenerator.MODE_TABLE
						: ResponseGenerator.MODE_NONE;

			return JSON.stringify({
				message: messageText,
				payload: {
					mode,
					list: structuredData.list,
					table: structuredData.table,
					chart: structuredData.chart,
				},
				meta: {
					sessionId: session.sessionId,
				},
			});
		} catch (error) {
			this.logger.warn('Failed to generate final response, using fallback', error);
			const messageText =
				sqlResult.count === 0 ? getNoResultsMessage() : getSuccessMessage(sqlResult.count);
			const mode: 'LIST' | 'TABLE' | 'CHART' | 'NONE' = structuredData.list
				? ResponseGenerator.MODE_LIST
				: structuredData.chart
					? ResponseGenerator.MODE_CHART
					: structuredData.table
						? ResponseGenerator.MODE_TABLE
						: ResponseGenerator.MODE_NONE;
			return JSON.stringify({
				message: messageText,
				payload: {
					mode,
					list: structuredData.list,
					table: structuredData.table,
					chart: structuredData.chart,
				},
				meta: {
					sessionId: session.sessionId,
				},
			});
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
		if (desiredMode === ResponseGenerator.MODE_LIST || isListLike(rows)) {
			const items = toListItems(rows).slice(0, ResponseGenerator.LIST_ITEMS_LIMIT);
			return {
				list: items,
				table: null,
				chart: null,
			};
		}

		// Try CHART for aggregate/statistics-like data
		if (desiredMode === ResponseGenerator.MODE_CHART) {
			const chartData = tryBuildChart(rows);
			if (chartData) {
				return {
					list: null,
					table: null,
					chart: {
						mimeType: ResponseGenerator.CHART_MIME_TYPE,
						url: chartData.url,
						width: chartData.width,
						height: chartData.height,
						alt: ResponseGenerator.CHART_ALT_TEXT,
					},
				};
			}
		}

		// Fallback to TABLE
		const inferred = inferColumns(rows);
		const columns = selectImportantColumns(inferred, rows);
		const normalized = normalizeRows(rows, columns).slice(0, ResponseGenerator.TABLE_ROWS_LIMIT);

		// MVP: Add path to table rows if entity and id exist
		const rowsWithPath = normalized.map((row) => {
			const hasId = row.id && typeof row.id === 'string';
			const hasEntity = row.entity && typeof row.entity === 'string';
			const entityId = hasId ? String(row.id) : undefined;
			const entity = hasEntity ? String(row.entity) : undefined;

			if (
				entityId &&
				entity &&
				(entity === ResponseGenerator.ENTITY_ROOM ||
					entity === ResponseGenerator.ENTITY_POST ||
					entity === ResponseGenerator.ENTITY_ROOM_SEEKING_POST)
			) {
				const path = buildEntityPath(entity, entityId);
				return { ...row, path };
			}
			return row;
		});

		return {
			list: null,
			table: {
				columns,
				rows: rowsWithPath,
				previewLimit: ResponseGenerator.PREVIEW_LIMIT,
			},
			chart: null,
		};
	}

	// Removed ---END fallback formatting; responses are always returned as JSON envelope

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
			.slice(-ResponseGenerator.RECENT_MESSAGES_LIMIT)
			.map(
				(m) =>
					`${m.role === 'user' ? ResponseGenerator.LABEL_USER : ResponseGenerator.LABEL_AI}: ${m.content}`,
			)
			.join('\n');
		const responsePrompt = buildFriendlyResponsePrompt({
			recentMessages,
			query,
			count: sqlResult.count,
			dataPreview: JSON.stringify(sqlResult.results).substring(
				0,
				ResponseGenerator.DATA_PREVIEW_LENGTH_FRIENDLY,
			),
		});
		try {
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: responsePrompt,
				temperature: ResponseGenerator.TEMPERATURE,
				maxOutputTokens: ResponseGenerator.MAX_OUTPUT_TOKENS_FRIENDLY,
			});
			return text.trim();
		} catch {
			return sqlResult.count === 0
				? getNoResultsMessage(query)
				: getSuccessMessage(sqlResult.count, query);
		}
	}
}
