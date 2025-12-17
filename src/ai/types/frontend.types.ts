/**
 * Frontend Types Export
 * Types để Frontend có thể import và sử dụng
 * Export từ Backend để đảm bảo type consistency
 */

// Import types để sử dụng trong file này
import type { ContentPayload, ControlPayload, DataPayload } from './chat.types';

// Re-export types để Frontend có thể import
export type {
	ChatEnvelope,
	ChatMessage,
	ChatResponse,
	ContentPayload,
	ControlPayload,
	DataPayload,
	ListItem,
	TableColumn,
} from './chat.types';

/**
 * Conversation API Response Types
 */
export interface ConversationListItem {
	id: string;
	title: string;
	summary: string | null;
	lastMessageAt: string | null;
	messageCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface ConversationMessage {
	id: string;
	sessionId: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	metadata: {
		kind?: 'CONTENT' | 'DATA' | 'CONTROL';
		payload?: ContentPayload | DataPayload | ControlPayload;
		sql?: string;
		canonicalQuestion?: string;
		meta?: Record<string, unknown>;
	} | null;
	sequenceNumber: number;
	createdAt: string;
}

export interface ConversationDetail {
	id: string;
	userId: string | null;
	title: string;
	summary: string | null;
	messageCount: number;
	lastMessageAt: string | null;
	createdAt: string;
	updatedAt: string;
	messages: ConversationMessage[];
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export interface ConversationListResponse {
	items: ConversationListItem[];
	total: number;
}

export interface ConversationMessagesResponse {
	items: ConversationMessage[];
	total: number;
}

export interface CreateConversationRequest {
	title?: string;
	initialMessage?: string;
}

export interface SendMessageRequest {
	message: string;
	currentPage?: string;
	images?: string[];
}

export interface UpdateTitleRequest {
	title: string;
}
