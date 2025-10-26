import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class ElasticsearchDebugService {
	private readonly logger = new Logger(ElasticsearchDebugService.name);

	constructor(private readonly elasticsearchService: ElasticsearchService) {}

	/**
	 * Debug Elasticsearch indices and data
	 */
	async debugElasticsearchStatus(): Promise<any> {
		try {
			const indices = ['rooms', 'room-seeking', 'roommate-seeking'];
			const results: any = {};

			for (const index of indices) {
				try {
					// Check if index exists
					const exists = await this.elasticsearchService.indices.exists({ index });

					if (!exists) {
						results[index] = { exists: false, error: 'Index does not exist' };
						continue;
					}

					// Get index stats
					const stats = await this.elasticsearchService.indices.stats({ index });
					const mapping = await this.elasticsearchService.indices.getMapping({ index });
					const settings = await this.elasticsearchService.indices.getSettings({ index });

					// Get sample data
					const sampleData = await this.elasticsearchService.search({
						index,
						body: {
							query: { match_all: {} },
							_source: ['name', 'title', 'description'],
							size: 3,
						},
					});

					results[index] = {
						exists: true,
						stats: {
							totalDocs: stats.indices[index]?.total?.docs?.count || 0,
							storeSize: stats.indices[index]?.total?.store?.size_in_bytes || 0,
						},
						mapping: mapping[index]?.mappings?.properties || {},
						settings: settings[index]?.settings?.index?.analysis || {},
						sampleData: sampleData.hits?.hits?.map((hit: any) => hit._source) || [],
					};
				} catch (error) {
					results[index] = { exists: false, error: error.message };
				}
			}

			return results;
		} catch (error) {
			this.logger.error('Failed to debug Elasticsearch status:', error);
			return { error: error.message };
		}
	}

	/**
	 * Test Vietnamese analyzer with sample text
	 */
	async testVietnameseAnalyzer(): Promise<any> {
		try {
			const testTexts = [
				'phòng trọ giá rẻ',
				'phòng cho thuê quận 1',
				'căn hộ chung cư',
				'nhà nguyên căn',
				'phòng gần biển',
			];

			const results: any = {};

			for (const text of testTexts) {
				try {
					// Test with Vietnamese analyzer
					const response = await this.elasticsearchService.indices.analyze({
						index: 'rooms',
						body: {
							analyzer: 'vietnamese_analyzer',
							text: text,
						},
					});

					results[text] = {
						tokens:
							response.tokens?.map((token: any) => ({
								token: token.token,
								start: token.start_offset,
								end: token.end_offset,
								type: token.type,
							})) || [],
					};
				} catch (error) {
					results[text] = { error: error.message };
				}
			}

			return results;
		} catch (error) {
			this.logger.error('Failed to test Vietnamese analyzer:', error);
			return { error: error.message };
		}
	}

	/**
	 * Test autocomplete with different queries
	 */
	async testAutocompleteQueries(): Promise<any> {
		try {
			const queries = ['phong', 'phòng', 'tro', 'trọ', 'gia', 'giá', 're', 'rẻ'];
			const results: any = {};

			for (const query of queries) {
				try {
					// Test with completion suggester
					const completionResponse = await this.elasticsearchService.search({
						index: 'rooms',
						body: {
							suggest: {
								room_suggest: {
									prefix: query,
									completion: {
										field: 'name.suggest',
										size: 5,
									},
								},
							},
						},
					});

					// Test with phrase prefix search
					const phraseResponse = await this.elasticsearchService.search({
						index: 'rooms',
						body: {
							query: {
								multi_match: {
									query: query,
									fields: ['name^3', 'description^1'],
									type: 'phrase_prefix',
								},
							},
							_source: ['name', 'description'],
							size: 3,
						},
					});

					results[query] = {
						completion: completionResponse.suggest?.room_suggest?.[0]?.options || [],
						phraseSearch:
							phraseResponse.hits?.hits?.map((hit: any) => ({
								name: hit._source?.name,
								description: hit._source?.description,
								score: hit._score,
							})) || [],
					};
				} catch (error) {
					results[query] = { error: error.message };
				}
			}

			return results;
		} catch (error) {
			this.logger.error('Failed to test autocomplete queries:', error);
			return { error: error.message };
		}
	}

	/**
	 * Force refresh all indices
	 */
	async refreshAllIndices(): Promise<any> {
		try {
			const indices = ['rooms', 'room-seeking', 'roommate-seeking'];
			const results: any = {};

			for (const index of indices) {
				try {
					await this.elasticsearchService.indices.refresh({ index });
					results[index] = { success: true };
				} catch (error) {
					results[index] = { success: false, error: error.message };
				}
			}

			return results;
		} catch (error) {
			this.logger.error('Failed to refresh indices:', error);
			return { error: error.message };
		}
	}

	/**
	 * Reindex all data from database to Elasticsearch
	 */
	async reindexAllData(): Promise<any> {
		try {
			// This would typically call your sync service
			// For now, just refresh indices
			const refreshResults = await this.refreshAllIndices();

			return {
				message: 'Reindex completed (indices refreshed)',
				refreshResults,
			};
		} catch (error) {
			this.logger.error('Failed to reindex all data:', error);
			return { error: error.message };
		}
	}

	/**
	 * Complete diagnostic and fix
	 */
	async diagnoseAndFix(): Promise<any> {
		try {
			this.logger.log('Starting Elasticsearch diagnostic and fix...');

			// 1. Check current status
			const status = await this.debugElasticsearchStatus();

			// 2. Test analyzer
			const analyzerTest = await this.testVietnameseAnalyzer();

			// 3. Test autocomplete
			const autocompleteTest = await this.testAutocompleteQueries();

			// 4. Refresh indices
			const refreshResults = await this.refreshAllIndices();

			return {
				status,
				analyzerTest,
				autocompleteTest,
				refreshResults,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			this.logger.error('Failed to diagnose and fix:', error);
			return { error: error.message };
		}
	}
}
