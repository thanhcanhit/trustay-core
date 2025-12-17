import { RoomPublishingDraft, RoomPublishingExecutionPlan } from './room-publishing.types';

/**
 * Interface for chat message compatible with AI SDK
 */
export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
	kind?: 'CONTENT' | 'DATA' | 'CONTROL';
	payload?: ContentPayload | DataPayload | ControlPayload;
	meta?: Record<string, string | number | boolean>;
}

/**
 * Interface for chat session with conversation history
 */
export interface ChatSession {
	sessionId: string;
	userId?: string;
	clientIp?: string;
	messages: ChatMessage[];
	lastActivity: Date;
	createdAt: Date;
	context?: ChatSessionContext;
}

export interface ChatSessionContext {
	activeFlow?: 'room-publishing';
	roomPublishing?: RoomPublishingDraft;
}

/**
 * Unified envelope for chat response (Markdown-first). Backward fields kept for compatibility.
 */
export type ChatResponse = ChatEnvelope;

export interface ChatEnvelope {
	kind: 'CONTENT' | 'DATA' | 'CONTROL';
	sessionId: string;
	timestamp: string;
	message: string; // Text before ---END delimiter
	meta?: Record<string, string | number | boolean>;
	payload?: ContentPayload | DataPayload | ControlPayload;
}

export interface ContentPayload {
	mode: 'CONTENT';
	stats?: readonly { label: string; value: number; unit?: string }[];
}

export type EntityType = 'room' | 'post' | 'room_seeking_post';

export interface ListItem {
	id: string;
	title: string;
	description?: string;
	thumbnailUrl?: string;
	entity?: EntityType;
	path?: string; // app-relative if available
	externalUrl?: string; // for external links
	extra?: Record<string, string | number | boolean>;
}

export type TableCell = string | number | boolean | null;

export interface TableColumn {
	key: string;
	label: string;
	type: 'string' | 'number' | 'date' | 'boolean' | 'url' | 'image';
}

export interface DataPayload {
	mode: 'LIST' | 'TABLE' | 'CHART' | 'INSIGHT';
	list?: {
		items: readonly ListItem[];
		total: number;
	};
	table?: {
		columns: readonly TableColumn[];
		rows: readonly Record<string, TableCell>[];
		previewLimit?: number;
	};
	chart?: {
		mimeType: 'image/png';
		url: string; // direct URL (e.g., QuickChart)
		width: number;
		height: number;
		alt?: string;
		type?: 'pie' | 'bar' | 'line' | 'doughnut'; // Chart type for reference
	};
}

export interface ControlPayload {
	mode: 'CLARIFY' | 'ERROR' | 'ROOM_PUBLISH';
	questions?: readonly string[];
	code?: string;
	details?: string;
	plan?: RoomPublishingExecutionPlan;
}

/**
 * Query type classification
 */
export type QueryType =
	| 'STATISTICS'
	| 'ROOM_SEARCH'
	| 'ROOM_CREATION'
	| 'CREATE_BUILDING'
	| 'CREATE_ROOM'
	| 'UPDATE_BUILDING'
	| 'UPDATE_ROOM'
	| 'INVALID';

/**
 * Query validation result
 */
export interface QueryValidationResult {
	isValid: boolean;
	reason?: string;
	needsClarification?: boolean;
	needsIntroduction?: boolean;
	clarificationQuestion?: string;
	queryType?: QueryType;
}

/**
 * User access validation result
 */
export interface UserAccessResult {
	hasAccess: boolean;
	userRole?: string;
	restrictions: string[];
}

/**
 * Request type classification
 */
export enum RequestType {
	QUERY = 'QUERY',
	GREETING = 'GREETING',
	CLARIFICATION = 'CLARIFICATION',
	GENERAL_CHAT = 'GENERAL_CHAT',
}

/**
 * User role classification
 */
export enum UserRole {
	GUEST = 'GUEST',
	TENANT = 'TENANT',
	LANDLORD = 'LANDLORD',
}

/**
 * Token usage from AI SDK generateText calls
 */
export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

/**
 * Missing parameter for clarification
 */
export interface MissingParam {
	name: string; // Parameter name (e.g., "location", "price_range")
	reason: string; // Why this parameter is needed
	examples?: string[]; // Example values (e.g., ["Quận 1", "Gò Vấp"])
}

/**
 * Orchestrator agent response
 */
export interface OrchestratorAgentResponse {
	message: string;
	requestType: RequestType;
	userRole: UserRole;
	userId?: string;
	prompt?: string;
	rawResponse?: string;
	recentMessages?: string;
	currentPageContext?: {
		entity: string;
		identifier: string;
		type?: 'slug' | 'id';
	};
	businessContext?: string; // RAG business context from KnowledgeService
	readyForSql: boolean;
	needsClarification?: boolean;
	needsIntroduction?: boolean;
	intentModeHint?: 'LIST' | 'TABLE' | 'CHART' | 'INSIGHT';
	entityHint?: 'room' | 'post' | 'room_seeking_post';
	filtersHint?: string; // natural language filters parsed (e.g., district:"gò vấp")
	tablesHint?: string; // comma-separated list of tables needed (e.g., "rentals,users,payments")
	relationshipsHint?: string; // relationships and JOINs needed (e.g., rentals→users(tenant), payments→rentals→users(owner))
	missingParams?: MissingParam[]; // MVP: Missing parameters for clarification
	intentAction?: 'search' | 'own' | 'stats'; // Intent action: search (toàn hệ thống), own (cá nhân), stats (thống kê)
	tokenUsage?: TokenUsage; // Token usage from LLM call
}

/**
 * SQL generation result
 */
export interface SqlGenerationAttempt {
	attempt: number;
	prompt?: string;
	rawResponse?: string;
	finalSql?: string;
	tokenUsage?: TokenUsage;
	durationMs?: number;
	error?: string;
	safetyCheck?: {
		isValid: boolean;
		violations?: string[];
		enforcedSql?: string;
		isAggregate?: boolean;
	};
}

export interface SqlGenerationDebug {
	ragContext?: string;
	canonicalDecision?: any;
	intentAction?: string;
	filtersHint?: string;
	tablesHint?: string;
	relationshipsHint?: string;
	recentMessages?: string;
	schemaChunkCount?: number;
	qaChunkCount?: number;
	qaChunkSqlCount?: number;
	attempts?: SqlGenerationAttempt[];
}

export interface SqlGenerationResult {
	sql: string;
	results: any;
	count: number;
	attempts?: number;
	userId?: string;
	userRole?: string;
	tokenUsage?: TokenUsage; // Token usage from LLM call(s)
	debug?: SqlGenerationDebug;
}

/**
 * Result validator response - Fail-closed design
 */
export interface ResultValidationResponse {
	isValid: boolean;
	reason?: string;
	violations?: string[]; // List of validation violations
	severity?: 'ERROR' | 'WARN'; // Severity level: ERROR blocks persistence, WARN allows but logs
	evaluation?: string; // Đánh giá chi tiết về SQL và kết quả
	tokenUsage?: TokenUsage; // Token usage from LLM call
	prompt?: string;
	rawResponse?: string;
	resultsPreview?: string;
	originalQuestion?: string; // Original user query (short, context-dependent)
	canonicalQuestion?: string; // Expanded canonical question (full context, used for SQL generation)
}

/**
 * Response generator output (JSON envelope text + debug)
 */
export interface ResponseGeneratorResult {
	responseText: string;
	prompt: string;
	mode: 'LIST' | 'TABLE' | 'CHART' | 'INSIGHT' | 'NONE';
	tokenUsage?: TokenUsage;
	structuredData?: { list: any[] | null; table: any | null; chart: any | null } | null;
}
