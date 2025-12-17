/**
 * Agent Configuration - Shared configs for AI agents
 */

/**
 * AI Model Names
 */
export const AI_MODELS = {
	/** Main model for complex tasks */
	MAIN: 'gemini-2.0-flash',
	/** Lightweight model for simple tasks (expansion, summarization) */
	LIGHT: 'gemini-2.0-flash',
} as const;

/**
 * Temperature Settings
 * Lower = more deterministic, Higher = more creative
 */
export const AI_TEMPERATURE = {
	/** High precision tasks (validation, expansion) */
	PRECISE: 0.2,
	/** Standard tasks (response generation, summarization) */
	STANDARD: 0.3,
	/** Complex tasks (orchestration) */
	COMPLEX: 0.4,
} as const;

/**
 * Max Output Tokens per Agent Type
 */
export const MAX_OUTPUT_TOKENS = {
	/** Question expansion (canonical question) */
	EXPANSION: 100,
	/** Summary generation (title + summary) */
	SUMMARY: 150,
	/** Result validation */
	VALIDATION: 300,
	/** Response generation (friendly) */
	RESPONSE_FRIENDLY: 300,
	/** Response generation (final) */
	RESPONSE_FINAL: 500,
	/** Response generation (insight) */
	RESPONSE_INSIGHT: 2000,
	/** Orchestration */
	ORCHESTRATION: 400,
} as const;

/**
 * Recent Messages Limits - How many recent messages to include in context
 * Unified limit for all agents to maintain consistent context
 */
export const RECENT_MESSAGES_LIMIT = {
	/** Standard limit for all agents */
	DEFAULT: 5,
	/** Orchestrator agent */
	ORCHESTRATOR: 5,
	/** SQL generation agent */
	SQL_GENERATION: 5,
	/** Response generator */
	RESPONSE: 5,
} as const;

/**
 * Preview Lengths - For logging and debugging
 */
export const PREVIEW_LENGTHS = {
	/** Standard log preview */
	LOG: 200,
	/** Prompt preview (longer) */
	PROMPT: 1200,
	/** Raw response preview */
	RAW_RESPONSE: 1200,
	/** Data preview (final) */
	DATA_FINAL: 800,
	/** Data preview (friendly) */
	DATA_FRIENDLY: 1000,
} as const;

/**
 * Message Labels - For formatting messages in context
 */
export const MESSAGE_LABELS = {
	USER: 'Người dùng',
	AI: 'AI',
} as const;

/**
 * Entity Types - Supported entity types in the system
 */
export const ENTITY_TYPES = {
	ROOM: 'room',
	POST: 'post',
	ROOM_SEEKING_POST: 'room_seeking_post',
} as const;
