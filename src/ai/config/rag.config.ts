/**
 * RAG Configuration - Centralized thresholds and limits for vector search
 * Higher threshold = more precise, lower threshold = more results
 */
export const RAG_THRESHOLDS = {
	/** Schema chunks (tables, columns, relationships) */
	SCHEMA: 0.75,
	/** Business context chunks (amenities, cost types, rules) */
	BUSINESS: 0.75,
	/** Q&A examples from knowledge base */
	QA: 0.85,
	/** Default fallback threshold */
	DEFAULT: 0.75,
} as const;

/**
 * RAG Limits - Maximum chunks to retrieve per type
 */
export const RAG_LIMITS = {
	SCHEMA_DEFAULT: 16,
	SCHEMA_ORCHESTRATOR: 6,
	BUSINESS_DEFAULT: 6,
	QA_DEFAULT: 2,
} as const;

export type RagThresholdType = keyof typeof RAG_THRESHOLDS;

export function getRagThreshold(type: RagThresholdType = 'DEFAULT'): number {
	return RAG_THRESHOLDS[type];
}
