import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationalAgent } from './agents/conversational-agent';
import { ErrorHandler } from './agents/error-handler';
import { ResponseGenerator } from './agents/response-generator';
import { SqlGenerationAgent } from './agents/sql-generation-agent';
import { KnowledgeService } from './knowledge/knowledge.service';
import {
	ChatMessage,
	ChatResponse,
	ChatSession,
	DataPayload,
	EntityType,
	ListItem,
	TableCell,
	TableColumn,
} from './types/chat.types';
import { buildQuickChartUrl } from './utils/chart';
import { buildEntityPath } from './utils/entity-route';
export { ChatResponse };

@Injectable()
export class AiService {
	// AI Constants
	private readonly AI_CONFIG = {
		temperature: 0.1,
		maxTokens: 500,
		limit: 100,
		model: 'gemini-2.0-flash',
	};

	// Logger for debugging
	private readonly logger = new Logger(AiService.name);

	// AI Agents
	private readonly conversationalAgent = new ConversationalAgent();
	private sqlGenerationAgent: SqlGenerationAgent;
	private readonly responseGenerator = new ResponseGenerator();

	// Chat session management - similar to rooms.service.ts view cache pattern
	private chatSessions = new Map<string, ChatSession>();
	private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 phút
	private readonly MAX_MESSAGES_PER_SESSION = 20; // Giới hạn tin nhắn mỗi session
	private readonly CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 phút

	constructor(
		private readonly prisma: PrismaService,
		private readonly knowledge: KnowledgeService,
	) {
		// Initialize SQL generation agent with knowledge service for RAG
		this.sqlGenerationAgent = new SqlGenerationAgent(this.knowledge);
		// Dọn dẹp session cũ định kỳ - similar to rooms.service.ts cleanup pattern
		setInterval(() => {
			this.cleanupExpiredSessions();
		}, this.CLEANUP_INTERVAL_MS);
	}

	/**
	 * Format step-based log message with a consistent, prominent tag
	 */
	private formatStep(step: string, message: string): string {
		const tag = `[${step}@ai.service.ts]`;
		return `${tag} ${message}`;
	}

	private logDebug(step: string, message: string): void {
		this.logger.debug(this.formatStep(step, message));
	}

	private logInfo(step: string, message: string): void {
		this.logger.log(this.formatStep(step, message));
	}

	private logWarn(step: string, message: string, err?: unknown): void {
		this.logger.warn(this.formatStep(step, message), err as any);
	}

	private logError(step: string, message: string, err?: unknown): void {
		this.logger.error(this.formatStep(step, message), err as any);
	}

	/**
	 * Generate session ID based on user context - similar to rooms.service.ts cache key generation
	 * @param userId - User ID if authenticated
	 * @param clientIp - Client IP address
	 * @returns Session ID
	 */
	private generateSessionId(userId?: string, clientIp?: string): string {
		if (userId) {
			return `user_${userId}`;
		}
		if (clientIp) {
			return `ip_${clientIp.replace(/[:.]/g, '_')}`;
		}
		// Fallback to random session (không khuyến khích)
		return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Get or create chat session - pattern similar to rooms.service.ts shouldIncrementView
	 * @param userId - User ID if authenticated
	 * @param clientIp - Client IP address
	 * @returns Chat session
	 */
	private getOrCreateSession(userId?: string, clientIp?: string): ChatSession {
		const sessionId = this.generateSessionId(userId, clientIp);

		if (this.chatSessions.has(sessionId)) {
			const session = this.chatSessions.get(sessionId)!;
			session.lastActivity = new Date();
			return session;
		}

		// Tạo session mới
		const newSession: ChatSession = {
			sessionId,
			userId,
			clientIp,
			messages: [],
			lastActivity: new Date(),
			createdAt: new Date(),
		};

		this.chatSessions.set(sessionId, newSession);
		return newSession;
	}

	/**
	 * Add message to session with AI SDK CoreMessage format
	 * @param session - Chat session
	 * @param role - Message role
	 * @param content - Message content
	 */
	private addMessageToSession(
		session: ChatSession,
		role: 'user' | 'assistant' | 'system',
		content: string,
	): void {
		const message: ChatMessage = {
			role,
			content,
			timestamp: new Date(),
		};

		session.messages.push(message);
		session.lastActivity = new Date();

		// Giới hạn số lượng tin nhắn để tránh memory leak
		if (session.messages.length > this.MAX_MESSAGES_PER_SESSION) {
			// Giữ lại system message đầu tiên (nếu có) và tin nhắn gần đây nhất
			const systemMessages = session.messages.filter((m) => m.role === 'system');
			const recentMessages = session.messages
				.filter((m) => m.role !== 'system')
				.slice(-this.MAX_MESSAGES_PER_SESSION + systemMessages.length);
			session.messages = [...systemMessages, ...recentMessages];
		}
	}

	/**
	 * Clean up expired sessions - similar to rooms.service.ts cleanupViewCache
	 */
	private cleanupExpiredSessions(): void {
		const now = Date.now();
		const expiredSessions: string[] = [];

		for (const [sessionId, session] of this.chatSessions.entries()) {
			if (now - session.lastActivity.getTime() > this.SESSION_TIMEOUT_MS) {
				expiredSessions.push(sessionId);
			}
		}

		for (const sessionId of expiredSessions) {
			this.chatSessions.delete(sessionId);
		}

		if (expiredSessions.length > 0) {
			// Log cleanup for monitoring purposes
			// console.log(`Cleaned up ${expiredSessions.length} expired chat sessions`);
		}
	}

	/**
	 * Chat with AI for database queries - Multi-agent flow implementation
	 * @param query - User query
	 * @param context - User context (userId, clientIp)
	 * @returns Chat response with conversation history
	 */
	async chatWithAI(
		query: string,
		context: { userId?: string; clientIp?: string } = {},
	): Promise<ChatResponse> {
		const { userId, clientIp } = context;

		// Step 1: Get or create chat session
		const session = this.getOrCreateSession(userId, clientIp);

		// Add user message to session
		this.addMessageToSession(session, 'user', query);

		try {
			this.logDebug('SESSION', `Processing chat query: "${query}" (session: ${session.sessionId})`);

			// MULTI-AGENT FLOW:
			// Agent 1: Conversational Agent - Always responds naturally
			this.logInfo('CONVO_AGENT', 'Generating conversational response...');
			// Ensure system prompt for Vietnamese output
			this.ensureVietnameseSystemPrompt(session);
			const conversationalResponse = await this.conversationalAgent.process(
				query,
				session,
				this.AI_CONFIG,
			);
			this.logDebug(
				'CONVO_AGENT',
				`Response received (readyForSql=${conversationalResponse.readyForSql})`,
			);

			// Decide desired response mode (before SQL) based on conversation intent or fallback heuristics
			const desiredMode: 'LIST' | 'TABLE' | 'CHART' =
				conversationalResponse.intentModeHint ?? this.resolveDesiredMode(query);
			if (conversationalResponse.entityHint) {
				this.addMessageToSession(
					session,
					'system',
					`[INTENT] ENTITY=${conversationalResponse.entityHint.toUpperCase()}`,
				);
			}
			if (conversationalResponse.filtersHint) {
				this.addMessageToSession(
					session,
					'system',
					`[INTENT] FILTERS=${conversationalResponse.filtersHint}`,
				);
			}
			if (desiredMode === 'CHART') {
				this.addMessageToSession(session, 'system', '[INTENT] MODE=CHART');
			} else if (desiredMode === 'LIST') {
				this.addMessageToSession(session, 'system', '[INTENT] MODE=LIST');
			} else {
				this.addMessageToSession(session, 'system', '[INTENT] MODE=TABLE');
			}

			// If conversational agent determines we have enough info for SQL
			if (conversationalResponse.readyForSql) {
				this.logInfo('SQL_AGENT', 'Generating SQL...');
				// Agent 2: SQL Generation Agent
				const sqlResult = await this.sqlGenerationAgent.process(
					query,
					session,
					this.prisma,
					this.AI_CONFIG,
				);
				this.logInfo('SQL_AGENT', `SQL generated successfully (rows=${sqlResult.count})`);

				// Build Markdown-first envelope with DATA payload (LIST/TABLE/CHART)
				const dataPayload: DataPayload | undefined = this.buildDataPayload(
					sqlResult.results,
					query,
					desiredMode,
				);
				const messageText: string = this.buildMarkdownForData(
					conversationalResponse.message,
					sqlResult.results,
					sqlResult.count,
					dataPayload?.mode ?? desiredMode,
					dataPayload?.mode === 'CHART' ? dataPayload.chart?.url : undefined,
					true,
				);

				// Persist Q&A with SQL canonical for self-learning
				try {
					this.logDebug('PERSIST', 'Saving Q&A interaction (canonical + QA chunk if new)...');
					await this.knowledge.saveQAInteraction({
						question: query,
						sql: sqlResult.sql,
						sessionId: session.sessionId,
						userId: session.userId,
						context: { count: sqlResult.count },
					});
				} catch (persistErr) {
					this.logWarn('PERSIST', 'Failed to persist Q&A to knowledge store', persistErr);
				}

				this.addMessageToSession(session, 'assistant', messageText);

				return {
					kind: 'DATA',
					sessionId: session.sessionId,
					timestamp: new Date().toISOString(),
					message: messageText,
					payload: dataPayload,
				};
			} else {
				// Agent 1 needs more info - return conversational response
				this.logInfo('CONVO_AGENT', 'Returning conversational response (not ready for SQL)');
				const messageText: string = `Mình cần thêm chút thông tin để trả lời chính xác: ${conversationalResponse.message}`;
				this.addMessageToSession(session, 'assistant', messageText);

				return {
					kind: 'CONTROL',
					sessionId: session.sessionId,
					timestamp: new Date().toISOString(),
					message: messageText,
					payload: { mode: 'CLARIFY', questions: [] },
				};
			}
		} catch (error) {
			// Log detailed error for debugging
			this.logError('ERROR', `Chat error (session ${session.sessionId})`, error);

			// Generate user-friendly error message
			const errorMessage = ErrorHandler.generateErrorResponse((error as Error).message);
			const messageText: string = `Xin lỗi, đã xảy ra lỗi: ${errorMessage}`;
			this.addMessageToSession(session, 'assistant', messageText);

			return {
				kind: 'CONTROL',
				sessionId: session.sessionId,
				timestamp: new Date().toISOString(),
				message: messageText,
				payload: { mode: 'ERROR', details: (error as Error).message },
			};
		}
	}

	// Build Markdown for DATA responses (LIST or TABLE)
	private buildMarkdownForData(
		intro: string,
		results: unknown,
		_count: number | undefined,
		mode?: 'LIST' | 'TABLE' | 'CHART',
		chartUrl?: string,
		suppressBody: boolean = false,
	): string {
		const finalIntro = String(intro ?? '').trim();
		if (
			!Array.isArray(results) ||
			results.length === 0 ||
			typeof results[0] !== 'object' ||
			suppressBody
		) {
			return `${finalIntro}`;
		}
		const rows = results as ReadonlyArray<Record<string, unknown>>;
		if (mode === 'CHART' && chartUrl) {
			return `${finalIntro}\n\n![Biểu đồ](${chartUrl})`;
		}
		if (mode === 'LIST' || this.isListLike(rows)) {
			const items = this.toListItems(rows).slice(0, 10);
			const lines = items.map((i) => {
				const title = i.title;
				const link = i.path || i.externalUrl || '';
				const desc = i.description ? `  \n  ${i.description}` : '';
				return link ? `- [${title}](${link})${desc}` : `- ${title}${desc}`;
			});
			return `${finalIntro}\n\n${lines.join('\n')}`;
		}
		const columns: TableColumn[] = this.inferColumns(rows);
		const previewRows = this.normalizeRows(rows, columns).slice(0, 10);
		const tableHeader = `| ${columns.map((c) => c.label).join(' | ')} |\n| ${columns.map(() => '---').join(' | ')} |`;
		const tableBody = previewRows
			.map((r) => `| ${columns.map((c) => String(r[c.key] ?? '')).join(' | ')} |`)
			.join('\n');
		return `${finalIntro}\n\n${tableHeader}\n${tableBody}`;
	}

	// removed sanitizeIntroForMode in favor of prompt-based control

	private buildDataPayload(
		results: unknown,
		query: string,
		desiredMode?: 'LIST' | 'TABLE' | 'CHART',
	): DataPayload | undefined {
		if (!Array.isArray(results) || results.length === 0 || typeof results[0] !== 'object') {
			return undefined;
		}
		const rows = results as ReadonlyArray<Record<string, unknown>>;
		// Prefer LIST (either intent or data shape)
		if (desiredMode === 'LIST' || this.isListLike(rows)) {
			const items = this.toListItems(rows);
			return {
				mode: 'LIST',
				list: {
					items: items.slice(0, 50),
					total: items.length,
				},
			};
		}
		// Then try CHART for aggregate/statistics-like data, only when intent matches
		const chartIntent = desiredMode === 'CHART' || this.isChartIntent(query);
		const chartData = chartIntent ? this.tryBuildChart(rows) : null;
		if (chartData) {
			return {
				mode: 'CHART',
				chart: {
					mimeType: 'image/png',
					url: chartData.url,
					width: chartData.width,
					height: chartData.height,
					alt: 'Chart (Top 10)',
				},
			};
		}
		const inferred: TableColumn[] = this.inferColumns(rows);
		const columns: TableColumn[] = this.selectImportantColumns(inferred, rows);
		const normalized = this.normalizeRows(rows, columns);
		return {
			mode: 'TABLE',
			table: {
				columns,
				rows: normalized.slice(0, 50),
				previewLimit: 50,
			},
		};
	}

	private selectImportantColumns(
		columns: ReadonlyArray<TableColumn>,
		rows: ReadonlyArray<Record<string, unknown>>,
	): TableColumn[] {
		const PRIORITY_KEYS = [
			'id',
			'name',
			'title',
			'price',
			'area',
			'count',
			'total',
			'created_at',
			'createdAt',
			'updated_at',
			'updatedAt',
			'room',
			'post',
			'url',
			'link',
			'href',
		];
		const MAX_COLUMNS = 8;
		const isNonEmpty = (key: string): boolean =>
			rows
				.slice(0, 50)
				.some((r) => r[key] !== null && r[key] !== undefined && String(r[key]).trim() !== '');
		// Filter out columns with non-primitive objects by probing first row values
		const primitiveColumns = columns.filter((c) => {
			const v = rows[0]?.[c.key];
			const t = typeof v;
			return v === null || v === undefined || t === 'string' || t === 'number' || t === 'boolean';
		});
		const nonEmpty = primitiveColumns.filter((c) => isNonEmpty(c.key));
		const prioritized = [
			...nonEmpty.filter((c) => PRIORITY_KEYS.includes(c.key)),
			...nonEmpty.filter((c) => !PRIORITY_KEYS.includes(c.key)),
		];
		return prioritized.slice(0, MAX_COLUMNS);
	}

	private isChartIntent(query: string): boolean {
		const q = (query || '').toLowerCase();
		// Vietnamese + English keywords for stats/visualization intent
		const keywords = [
			'biểu đồ',
			'chart',
			'thống kê',
			'stat',
			'statistics',
			'so sánh',
			'compare',
			'top',
			'tỷ lệ',
			'ratio',
			'phân bố',
			'distribution',
			'xu hướng',
			'trend',
			'trong 7 ngày',
			'theo tháng',
			'theo quý',
			'by month',
			'by quarter',
			'hóa đơn',
			'hoá đơn',
			'invoice',
			'doanh thu',
			'revenue',
			'doanh số',
			'thu chi',
			'tổng',
			'theo năm',
		];
		return keywords.some((k) => q.includes(k));
	}

	private resolveDesiredMode(query: string): 'LIST' | 'TABLE' | 'CHART' {
		const q = (query || '').toLowerCase();
		// Prioritize statistics/visualization
		if (this.isChartIntent(q)) {
			return 'CHART';
		}
		// Strong LIST intent (search/browse)
		const listKeywords = [
			'tìm',
			'tim',
			'có phòng',
			'phòng',
			'room',
			'bài đăng',
			'post',
			'ở',
			'near',
			'trong khu vực',
			'gần',
		];
		if (listKeywords.some((k) => q.includes(k))) {
			return 'LIST';
		}
		return 'TABLE';
	}

	private isListLike(rows: ReadonlyArray<Record<string, unknown>>): boolean {
		const sample = rows[0] ?? {};
		const keys = Object.keys(sample).map((k) => k.toLowerCase());
		const hasTitle = keys.some((k) => ['title', 'name'].includes(k));
		const hasUrlOrImage = keys.some((k) =>
			['url', 'link', 'href', 'image', 'imageurl', 'thumbnail'].includes(k),
		);
		const hasEntityId = keys.includes('id') && keys.includes('entity');
		return hasTitle && (hasUrlOrImage || hasEntityId);
	}

	private tryBuildChart(
		rows: ReadonlyArray<Record<string, unknown>>,
	): { url: string; width: number; height: number } | null {
		if (rows.length === 0) {
			return null;
		}
		const sample = rows[0];
		const keys = Object.keys(sample);
		const numericKeys = keys.filter(
			(k) => typeof (sample as Record<string, unknown>)[k] === 'number',
		);
		if (numericKeys.length === 0) {
			return null;
		}
		// Choose a label key: prefer name/title/category; else the first non-numeric
		const labelKey =
			keys.find((k) => /name|title|label|category/i.test(k)) ??
			keys.find((k) => !numericKeys.includes(k));
		if (!labelKey) {
			return null;
		}
		const valueKey = numericKeys[0];
		// Heuristic: aggregate/statistics-like detection
		const statLike = keys.some((k) => /count|sum|avg|total|min|max/i.test(k));
		const numericRatio = numericKeys.length / Math.max(keys.length, 1);
		if (!statLike && numericRatio < 0.6) {
			return null;
		}
		// Build pairs, sort desc, take top 10
		const pairs = rows.map((r) => ({
			label: String((r as Record<string, unknown>)[labelKey] ?? ''),
			value: Number((r as Record<string, unknown>)[valueKey] ?? 0),
		}));
		pairs.sort((a, b) => b.value - a.value);
		const top = pairs.slice(0, 10);
		const labels: string[] = top.map((p) => p.label);
		const data: number[] = top.map((p) => p.value);
		const { url, width, height } = buildQuickChartUrl({
			labels,
			datasetLabel: this.toLabel(valueKey),
			data,
			type: 'bar',
			width: 800,
			height: 400,
		});
		return { url, width, height };
	}

	private toListItems(rows: ReadonlyArray<Record<string, unknown>>): ListItem[] {
		return rows.map((r) => this.toListItem(r));
	}

	private toListItem(row: Record<string, unknown>): ListItem {
		const obj = this.toLowerKeys(row);
		const rawId = (obj.id as unknown) ?? (obj.slug as unknown) ?? (obj.uuid as unknown) ?? '';
		const id = String(rawId ?? '').trim();
		const entityExplicit = (obj.entity as EntityType | undefined) ?? undefined;
		const inferredEntity: EntityType | undefined = entityExplicit ?? (id ? 'room' : undefined);
		const path = inferredEntity && id ? buildEntityPath(inferredEntity, id) : undefined;
		const extUrl =
			(obj.url as string | undefined) ??
			(obj.link as string | undefined) ??
			(obj.href as string | undefined);
		const imageUrl =
			(obj.imageurl as string | undefined) ??
			(obj.image as string | undefined) ??
			(obj.thumbnail as string | undefined);
		return {
			id:
				id ||
				(obj.uuid as string | undefined) ||
				(obj.slug as string | undefined) ||
				String(Math.random()).slice(2),
			title: String(obj.title ?? obj.name ?? 'Untitled'),
			description: obj.description ? String(obj.description) : undefined,
			thumbnailUrl: imageUrl,
			entity: inferredEntity,
			path,
			externalUrl: extUrl,
		};
	}

	private toLowerKeys(obj: Record<string, unknown>): Record<string, unknown> {
		return Object.entries(obj).reduce<Record<string, unknown>>((acc, [k, v]) => {
			acc[k.toLowerCase()] = v;
			return acc;
		}, {});
	}

	private ensureVietnameseSystemPrompt(session: ChatSession): void {
		const exists = session.messages.some(
			(m) => m.role === 'system' && m.content.includes('[LOCALE] vi-VN'),
		);
		if (exists) {
			return;
		}
		const instruction =
			'[LOCALE] vi-VN\n' +
			'Hãy luôn trả lời bằng tiếng Việt tự nhiên, thân thiện, ấm áp, tránh cụt lủn. ' +
			'Bắt đầu bằng 1-2 câu ngắn gọn, hữu ích (không dùng các từ đơn kiểu "Tuyệt vời", "OK"). ' +
			'Tất cả nội dung hiển thị (tiêu đề, mô tả, số liệu, tên cột) phải ở tiếng Việt. ' +
			'Không chèn HTML, chỉ sử dụng Markdown an toàn. ' +
			'Nếu có tên trường/từ tiếng Anh, hãy chuyển sang tiếng Việt dễ hiểu. ' +
			'Mẫu gợi ý: LIST → "Mình tìm được {count} kết quả phù hợp, bạn xem thử nhé:"; ' +
			'TABLE → "Dưới đây là bản xem nhanh dữ liệu:"; ' +
			'CHART → "Mình đã vẽ biểu đồ để bạn xem nhanh xu hướng:"';
		this.addMessageToSession(session, 'system', instruction);
	}

	private inferColumns(rows: ReadonlyArray<Record<string, unknown>>): TableColumn[] {
		const sample = rows[0] ?? {};
		return Object.keys(sample).map((key) => {
			const v = (sample as Record<string, unknown>)[key];
			const type: TableColumn['type'] =
				typeof v === 'number'
					? 'number'
					: v instanceof Date
						? 'date'
						: typeof v === 'boolean'
							? 'boolean'
							: /url|link|href/i.test(key)
								? 'url'
								: /image|thumbnail/i.test(key)
									? 'image'
									: 'string';
			// Keep label as raw key; beautification/localization handled by LLM in message or frontend
			return { key, label: key, type };
		});
	}

	private normalizeRows(
		rows: ReadonlyArray<Record<string, unknown>>,
		columns: ReadonlyArray<TableColumn>,
	): ReadonlyArray<Record<string, TableCell>> {
		return rows.map((row) =>
			columns.reduce<Record<string, TableCell>>((acc, c) => {
				const v = row[c.key];
				if (v === null || v === undefined) {
					acc[c.key] = null;
					return acc;
				}
				if (c.type === 'date') {
					acc[c.key] = v instanceof Date ? v.toISOString() : String(v);
					return acc;
				}
				if (c.type === 'number') {
					acc[c.key] = Number(v);
					return acc;
				}
				if (c.type === 'boolean') {
					acc[c.key] = Boolean(v);
					return acc;
				}
				acc[c.key] = String(v);
				return acc;
			}, {}),
		);
	}

	private toLabel(key: string): string {
		return key
			.replace(/_/g, ' ')
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/\s+/g, ' ')
			.replace(/^./, (s) => s.toUpperCase());
	}

	// removed toVietnameseLabel - LLM/front-end handles localization

	/**
	 * Get chat history for a session - For frontend to display conversation
	 * @param context - User context (userId, clientIp)
	 * @returns Chat messages compatible with AI SDK Conversation component
	 */
	async getChatHistory(context: { userId?: string; clientIp?: string } = {}): Promise<{
		sessionId: string;
		messages: Array<{
			id: string;
			role: 'user' | 'assistant';
			content: string;
			timestamp: string;
		}>;
	}> {
		const { userId, clientIp } = context;
		const session = this.getOrCreateSession(userId, clientIp);

		return {
			sessionId: session.sessionId,
			messages: session.messages
				.filter((m) => m.role !== 'system') // Don't show system messages to user
				.map((message, index) => ({
					id: `${session.sessionId}_${index}`,
					role: message.role as 'user' | 'assistant',
					content: message.content,
					timestamp: message.timestamp.toISOString(),
				})),
		};
	}

	/**
	 * Clear chat history for a session
	 * @param context - User context (userId, clientIp)
	 */
	async clearChatHistory(
		context: { userId?: string; clientIp?: string } = {},
	): Promise<{ success: boolean }> {
		const { userId, clientIp } = context;
		const sessionId = this.generateSessionId(userId, clientIp);

		if (this.chatSessions.has(sessionId)) {
			this.chatSessions.delete(sessionId);
		}

		return { success: true };
	}

	/**
	 * Legacy method for backward compatibility with retry logic and security
	 * @param query - User query
	 * @param userId - Optional user ID for authorization
	 * @returns SQL execution result
	 */
	async generateAndExecuteSql(query: string, userId?: string) {
		return await this.sqlGenerationAgent.generateAndExecuteSql(
			query,
			userId,
			this.prisma,
			this.AI_CONFIG,
		);
	}
}
