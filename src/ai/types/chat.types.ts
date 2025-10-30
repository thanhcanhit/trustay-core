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
 * Interface for chat response
 */
export interface ChatResponse {
	sessionId: string;
	message: string;
	sql?: string;
	results?: any;
	count?: number;
	timestamp: string;
	validation?: {
		isValid: boolean;
		reason?: string;
		needsClarification?: boolean;
		needsIntroduction?: boolean;
		clarificationQuestion?: string;
	};
	error?: string;
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
