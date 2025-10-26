import { Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ElasticsearchDebugService } from '../../elasticsearch/services/elasticsearch-debug.service';
import { ElasticsearchSearchService } from '../../elasticsearch/services/elasticsearch-search.service';
import { VietnameseElasticsearchConfigService } from '../../elasticsearch/services/vietnamese-elasticsearch-config.service';
import { AutocompleteQueryDto, AutocompleteResponseDto } from './dto/autocomplete.dto';

@ApiTags('Search')
@Controller('search')
export class SearchController {
	private readonly logger = new Logger(SearchController.name);

	constructor(
		private readonly elasticsearchSearchService: ElasticsearchSearchService,
		private readonly vietnameseConfigService: VietnameseElasticsearchConfigService,
		private readonly debugService: ElasticsearchDebugService,
	) {}

	@Get('autocomplete')
	@ApiOperation({
		summary: 'Get word completion suggestions',
		description: 'Get next word suggestions as user types - suggests completing words/phrases',
	})
	@ApiQuery({
		name: 'keyword',
		required: true,
		description: 'Partial word/phrase (minimum 2 characters)',
		example: 'phòng',
	})
	@ApiResponse({
		status: 200,
		description: 'Word completion suggestions retrieved successfully',
		type: AutocompleteResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Keyword must be at least 2 characters long',
	})
	async autocomplete(@Query() query: AutocompleteQueryDto): Promise<AutocompleteResponseDto> {
		const { keyword } = query;
		const LIMIT = 10; // Constant limit

		if (!keyword || keyword.length < 2) {
			return {
				success: false,
				message: 'Keyword must be at least 2 characters long',
				data: [],
				keyword: keyword || '',
			};
		}

		try {
			// Get autocomplete suggestions using both completion suggester and edge_ngram
			const suggestions = await this.elasticsearchSearchService.getAutocompleteSuggestions(
				keyword,
				LIMIT,
			);

			return {
				success: true,
				data: suggestions,
				keyword,
			};
		} catch (error) {
			this.logger.error('Failed to get word completion suggestions:', error);
			return {
				success: false,
				message: 'Failed to get word completion suggestions',
				data: [],
				keyword,
			};
		}
	}

	@Get('debug')
	@ApiOperation({
		summary: 'Debug Elasticsearch data',
		description: 'Check if there is data in Elasticsearch rooms index',
	})
	@ApiResponse({
		status: 200,
		description: 'Debug information retrieved successfully',
	})
	async debug(): Promise<any> {
		try {
			const debugInfo = await this.elasticsearchSearchService.debugRoomData();
			return {
				success: true,
				data: debugInfo,
			};
		} catch (error) {
			this.logger.error('Failed to get debug info:', error);
			return {
				success: false,
				message: 'Failed to get debug info',
				error: error.message,
			};
		}
	}

	@Get('setup-vietnamese')
	@ApiOperation({
		summary: 'Setup Vietnamese analyzer',
		description: 'Configure Elasticsearch for better Vietnamese text processing',
	})
	@ApiResponse({
		status: 200,
		description: 'Vietnamese analyzer setup completed',
	})
	async setupVietnamese(): Promise<any> {
		try {
			await this.vietnameseConfigService.setupCompleteVietnameseConfig();
			return {
				success: true,
				message: 'Vietnamese analyzer setup completed',
			};
		} catch (error) {
			this.logger.error('Failed to setup Vietnamese analyzer:', error);
			return {
				success: false,
				message: 'Failed to setup Vietnamese analyzer',
				error: error.message,
			};
		}
	}

	@Get('diagnose')
	@ApiOperation({
		summary: 'Complete Elasticsearch diagnostic',
		description: 'Run comprehensive diagnostic to check ES status, analyzer, and autocomplete',
	})
	@ApiResponse({
		status: 200,
		description: 'Diagnostic completed',
	})
	async diagnose(): Promise<any> {
		try {
			const results = await this.debugService.diagnoseAndFix();
			return {
				success: true,
				data: results,
			};
		} catch (error) {
			this.logger.error('Failed to run diagnostic:', error);
			return {
				success: false,
				message: 'Failed to run diagnostic',
				error: error.message,
			};
		}
	}

	@Get('test-analyzer')
	@ApiOperation({
		summary: 'Test Vietnamese analyzer',
		description: 'Test Vietnamese analyzer with sample Vietnamese text',
	})
	@ApiResponse({
		status: 200,
		description: 'Analyzer test completed',
	})
	async testAnalyzer(): Promise<any> {
		try {
			const results = await this.debugService.testVietnameseAnalyzer();
			return {
				success: true,
				data: results,
			};
		} catch (error) {
			this.logger.error('Failed to test analyzer:', error);
			return {
				success: false,
				message: 'Failed to test analyzer',
				error: error.message,
			};
		}
	}

	@Post('test-data')
	@ApiOperation({
		summary: 'Insert test Vietnamese data for autocomplete testing',
		description: 'Insert sample Vietnamese room data to test autocomplete functionality',
	})
	@ApiResponse({
		status: 200,
		description: 'Test data inserted successfully',
	})
	async insertTestData(): Promise<any> {
		try {
			const testData = [
				{
					id: 'test-1',
					name: 'Phòng gần biển Đà Nẵng',
					description: 'View biển, yên tĩnh, gần trung tâm',
					city: 'Đà Nẵng',
					district: 'Hải Châu',
					amenities: ['hồ bơi', 'wifi', 'máy lạnh'],
					price: 900000,
					rating: 4.6,
					isActive: true,
					name_suggest: 'Phòng gần biển Đà Nẵng',
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: 'test-2',
					name: 'Phòng gia đình 2 người, Hồ Chí Minh',
					description: 'Gần trung tâm, sạch sẽ, đầy đủ tiện nghi',
					city: 'Hồ Chí Minh',
					district: 'Quận 1',
					amenities: ['điều hòa', 'wifi', 'máy giặt'],
					price: 1200000,
					rating: 4.3,
					isActive: true,
					name_suggest: 'Phòng gia đình 2 người Hồ Chí Minh',
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: 'test-3',
					name: 'Căn hộ gần biển Nha Trang',
					description: 'Ban công rộng, view đẹp, gần chợ',
					city: 'Nha Trang',
					district: 'Nha Trang',
					amenities: ['bếp', 'máy giặt', 'tủ lạnh'],
					price: 800000,
					rating: 4.5,
					isActive: true,
					name_suggest: 'Căn hộ gần biển Nha Trang',
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: 'test-4',
					name: 'Phòng trọ sinh viên gần trường',
					description: 'Giá rẻ, gần trường đại học, có wifi',
					city: 'Hà Nội',
					district: 'Cầu Giấy',
					amenities: ['wifi', 'quạt', 'giường'],
					price: 500000,
					rating: 4.2,
					isActive: true,
					name_suggest: 'Phòng trọ sinh viên gần trường',
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: 'test-5',
					name: 'Nhà nguyên căn cho thuê dài hạn',
					description: 'Nhà 2 tầng, có sân vườn, gần chợ',
					city: 'Cần Thơ',
					district: 'Ninh Kiều',
					amenities: ['sân vườn', 'garage', 'bếp'],
					price: 1500000,
					rating: 4.7,
					isActive: true,
					name_suggest: 'Nhà nguyên căn cho thuê dài hạn',
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			// Insert test data into Elasticsearch
			const bulkBody = [];
			for (const room of testData) {
				bulkBody.push({
					index: {
						_index: 'rooms',
						_id: room.id,
					},
				});
				bulkBody.push(room);
			}

			await this.elasticsearchSearchService['elasticsearchService'].bulk({
				body: bulkBody,
			});

			// Refresh index to make data searchable
			await this.elasticsearchSearchService['elasticsearchService'].indices.refresh({
				index: 'rooms',
			});

			return {
				success: true,
				message: 'Test Vietnamese data inserted successfully',
				count: testData.length,
				data: testData.map((room) => ({
					id: room.id,
					name: room.name,
					city: room.city,
				})),
			};
		} catch (error) {
			this.logger.error('Failed to insert test data:', error);
			return {
				success: false,
				message: 'Failed to insert test data',
				error: error.message,
			};
		}
	}
}
