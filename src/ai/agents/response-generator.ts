import { google } from '@ai-sdk/google';
import { Logger } from '@nestjs/common';
import { generateText } from 'ai';
import {
	AI_TEMPERATURE,
	ENTITY_TYPES,
	MAX_OUTPUT_TOKENS,
	MESSAGE_LABELS,
	PREVIEW_LENGTHS,
	RECENT_MESSAGES_LIMIT,
} from '../config/agent.config';
import {
	buildFinalMessagePrompt,
	buildFriendlyResponsePrompt,
	getNoResultsMessage,
	getSuccessMessage,
} from '../prompts/response-generator.prompt';
import {
	ChatSession,
	EntityType,
	SqlGenerationResult,
	TableColumn,
	TokenUsage,
} from '../types/chat.types';
import {
	hasColumnMapping,
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
	private static readonly LIST_ITEMS_LIMIT = 50;
	private static readonly TABLE_ROWS_LIMIT = 50;
	private static readonly PREVIEW_LIMIT = 50;
	// Chart constants
	private static readonly CHART_MIME_TYPE = 'image/png';
	private static readonly CHART_ALT_TEXT = 'Chart (Top 10)';
	// Mode strings
	private static readonly MODE_LIST = 'LIST';
	private static readonly MODE_TABLE = 'TABLE';
	private static readonly MODE_CHART = 'CHART';
	private static readonly MODE_INSIGHT = 'INSIGHT';
	private static readonly MODE_NONE = 'NONE';

	/**
	 * Generate final response combining conversational context with SQL results
	 * Format: message text ---END LIST: [] TABLE: {} CHART: {}
	 * @param conversationalMessage - Message from orchestrator agent
	 * @param sqlResult - SQL execution result
	 * @param session - Chat session for context
	 * @param aiConfig - AI configuration
	 * @param desiredMode - Desired output mode (LIST/TABLE/CHART/INSIGHT)
	 * @returns Final combined response with ---END delimiter and structured data
	 */
	async generateFinalResponse(
		conversationalMessage: string,
		sqlResult: SqlGenerationResult,
		session: ChatSession,
		aiConfig: { model: string; temperature: number; maxTokens: number },
		desiredMode?: 'LIST' | 'TABLE' | 'CHART' | 'INSIGHT',
		sessionSummary?: string | null,
	): Promise<string> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-RECENT_MESSAGES_LIMIT.RESPONSE)
			.map((m) => `${m.role === 'user' ? MESSAGE_LABELS.USER : MESSAGE_LABELS.AI}: ${m.content}`)
			.join('\n');

		// INSIGHT mode: Chỉ trả về message với phân tích chi tiết, không có structured data
		if (desiredMode === ResponseGenerator.MODE_INSIGHT) {
			// For INSIGHT mode, use full data preview (no truncation) to ensure all details are available
			const insightPrompt = buildFinalMessagePrompt({
				recentMessages,
				conversationalMessage,
				count: sqlResult.count,
				dataPreview: JSON.stringify(sqlResult.results), // Use full data, no truncation for insight
				structuredData: null, // Không có structured data cho insight mode
				isInsightMode: true,
			});

			try {
				const { text, usage } = await generateText({
					model: google(aiConfig.model),
					prompt: insightPrompt,
					temperature: AI_TEMPERATURE.STANDARD,
					maxOutputTokens: MAX_OUTPUT_TOKENS.RESPONSE_INSIGHT,
				});
				const messageText = text.trim();
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

				return JSON.stringify({
					message: messageText,
					payload: {
						mode: ResponseGenerator.MODE_INSIGHT,
						list: null,
						table: null,
						chart: null,
					},
					meta: {
						sessionId: session.sessionId,
						tokenUsage,
					},
				});
			} catch (error) {
				this.logger.warn('Failed to generate insight response, using fallback', error);
				const messageText =
					sqlResult.count === 0
						? getNoResultsMessage()
						: 'Đã có thông tin phòng nhưng không thể tạo insight chi tiết.';
				return JSON.stringify({
					message: messageText,
					payload: {
						mode: ResponseGenerator.MODE_INSIGHT,
						list: null,
						table: null,
						chart: null,
					},
					meta: {
						sessionId: session.sessionId,
					},
				});
			}
		}

		// Build structured data payload cho các mode khác (không phải INSIGHT)
		let structuredData: { list: any[] | null; table: any | null; chart: any | null } | null = null;
		if (desiredMode && desiredMode !== ('INSIGHT' as typeof desiredMode)) {
			structuredData = await this.buildStructuredData(sqlResult.results, desiredMode, aiConfig);
		}

		// Build message-only prompt for the LLM
		const finalPrompt = buildFinalMessagePrompt({
			recentMessages,
			sessionSummary: sessionSummary || undefined,
			conversationalMessage,
			count: sqlResult.count,
			dataPreview: JSON.stringify(sqlResult.results).substring(0, PREVIEW_LENGTHS.DATA_FINAL),
			structuredData,
			isInsightMode: false,
		});

		try {
			const { text, usage } = await generateText({
				model: google(aiConfig.model),
				prompt: finalPrompt,
				temperature: AI_TEMPERATURE.STANDARD,
				maxOutputTokens: MAX_OUTPUT_TOKENS.RESPONSE_FINAL,
			});
			const messageText = text.trim();
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
			const mode: 'LIST' | 'TABLE' | 'CHART' | 'NONE' = structuredData?.list
				? ResponseGenerator.MODE_LIST
				: structuredData?.chart
					? ResponseGenerator.MODE_CHART
					: structuredData?.table
						? ResponseGenerator.MODE_TABLE
						: ResponseGenerator.MODE_NONE;

			return JSON.stringify({
				message: messageText,
				payload: {
					mode,
					list: structuredData?.list || null,
					table: structuredData?.table || null,
					chart: structuredData?.chart || null,
				},
				meta: {
					sessionId: session.sessionId,
					tokenUsage,
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
	 * Translate column labels using LLM for columns not in mapping
	 * @param columns - Columns to translate
	 * @param aiConfig - AI configuration
	 * @returns Translated columns
	 */
	private async translateColumnLabelsWithLLM(
		columns: TableColumn[],
		aiConfig: { model: string; temperature: number; maxTokens: number },
	): Promise<TableColumn[]> {
		// Filter columns that need LLM translation (not in mapping)
		const columnsToTranslate = columns.filter((col) => !hasColumnMapping(col.key));
		if (columnsToTranslate.length === 0) {
			return columns; // All columns already translated by mapping
		}
		try {
			const columnKeys = columnsToTranslate.map((col) => col.key).join(', ');
			const prompt = `Bạn là AI assistant. Nhiệm vụ của bạn là chuyển tên cột database (snake_case, tiếng Anh) sang tiếng Việt dễ hiểu cho người dùng không chuyên kỹ thuật.

Danh sách tên cột cần chuyển: ${columnKeys}

QUY TẮC:
1. Chuyển sang tiếng Việt tự nhiên, dễ hiểu
2. Giữ nguyên ý nghĩa của cột
3. Nếu là số liệu/thống kê → thêm đơn vị nếu cần (ví dụ: "Số lượng", "Tổng tiền (VNĐ)")
4. Nếu là ngày tháng → dùng "Ngày ..."
5. Nếu là trạng thái → dùng "Trạng thái ..."
6. Nếu là ID → có thể giữ nguyên "ID" hoặc mô tả rõ hơn

VÍ DỤ:
- base_price_monthly → "Giá thuê/tháng"
- district_name → "Quận/Huyện"
- total_amount → "Tổng tiền"
- payment_date → "Ngày thanh toán"
- status → "Trạng thái"

Trả về JSON format: {"column_key": "Tên tiếng Việt", ...}
Ví dụ: {"base_price_monthly": "Giá thuê/tháng", "district_name": "Quận/Huyện"}

CHỈ trả về JSON, không có text khác:`;
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt,
				temperature: 0.3,
				maxOutputTokens: 200,
			});
			// Parse JSON response
			const jsonMatch = text.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const translations = JSON.parse(jsonMatch[0]) as Record<string, string>;
				// Update columns with LLM translations
				return columns.map((col) => {
					if (translations[col.key]) {
						return { ...col, label: translations[col.key] };
					}
					return col;
				});
			}
		} catch (error) {
			this.logger.warn(
				`Failed to translate column labels with LLM, using original labels: ${(error as Error).message}`,
			);
		}
		// Fallback: return original columns
		return columns;
	}

	/**
	 * Build structured data from SQL results
	 * @param results - SQL query results
	 * @param desiredMode - Desired output mode
	 * @param aiConfig - AI configuration (for LLM translation)
	 * @returns Structured data object with LIST/TABLE/CHART
	 */
	private async buildStructuredData(
		results: unknown,
		desiredMode?: 'LIST' | 'TABLE' | 'CHART',
		aiConfig?: { model: string; temperature: number; maxTokens: number },
	): Promise<{ list: any[] | null; table: any | null; chart: any | null }> {
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
		let columns = selectImportantColumns(inferred, rows);
		// Translate column labels with LLM if aiConfig is provided
		if (aiConfig) {
			columns = await this.translateColumnLabelsWithLLM(columns, aiConfig);
		}
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
				(entity === ENTITY_TYPES.ROOM ||
					entity === ENTITY_TYPES.POST ||
					entity === ENTITY_TYPES.ROOM_SEEKING_POST)
			) {
				const path = buildEntityPath(entity as EntityType, entityId);
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
		sessionSummary?: string | null,
	): Promise<string> {
		const recentMessages = session.messages
			.filter((m) => m.role !== 'system')
			.slice(-RECENT_MESSAGES_LIMIT.RESPONSE)
			.map((m) => `${m.role === 'user' ? MESSAGE_LABELS.USER : MESSAGE_LABELS.AI}: ${m.content}`)
			.join('\n');
		const responsePrompt = buildFriendlyResponsePrompt({
			recentMessages,
			sessionSummary: sessionSummary || undefined,
			query,
			count: sqlResult.count,
			dataPreview: JSON.stringify(sqlResult.results).substring(0, PREVIEW_LENGTHS.DATA_FRIENDLY),
		});
		try {
			const { text } = await generateText({
				model: google(aiConfig.model),
				prompt: responsePrompt,
				temperature: AI_TEMPERATURE.STANDARD,
				maxOutputTokens: MAX_OUTPUT_TOKENS.RESPONSE_FRIENDLY,
			});
			return text.trim();
		} catch {
			return sqlResult.count === 0
				? getNoResultsMessage(query)
				: getSuccessMessage(sqlResult.count, query);
		}
	}
}
