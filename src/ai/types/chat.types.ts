/**
 * Interface for chat message compatible with AI SDK
 */
export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
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
}

/**
 * Unified envelope for chat response (Markdown-first). Backward fields kept for compatibility.
 */
export type ChatResponse = ChatEnvelope;

export interface ChatEnvelope {
	kind: 'CONTENT' | 'DATA' | 'CONTROL';
	sessionId: string;
	timestamp: string;
	message: string; // Markdown-first text for rendering
	meta?: Record<string, string | number | boolean>;
	payload?: ContentPayload | DataPayload | ControlPayload;
}

export interface ContentPayload {
	mode: 'CONTENT';
	stats?: readonly { label: string; value: number; unit?: string }[];
}

export type EntityType = 'room' | 'post';

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
	mode: 'LIST' | 'TABLE' | 'CHART';
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
	};
}

export interface ControlPayload {
	mode: 'CLARIFY' | 'ERROR';
	questions?: readonly string[];
	code?: string;
	details?: string;
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
 * Conversational agent response
 */
export interface ConversationalAgentResponse {
	message: string;
	readyForSql: boolean;
	needsClarification?: boolean;
	needsIntroduction?: boolean;
	intentModeHint?: 'LIST' | 'TABLE' | 'CHART';
	entityHint?: 'room' | 'post' | 'room_seeking_post';
	filtersHint?: string; // natural language filters parsed (e.g., district:"gò vấp")
}

/**
 * SQL generation result
 */
export interface SqlGenerationResult {
	sql: string;
	results: any;
	count: number;
	attempts?: number;
	userId?: string;
	userRole?: string;
}
