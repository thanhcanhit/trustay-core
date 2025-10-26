import { Test, TestingModule } from '@nestjs/testing';
import { ElasticsearchSearchService } from '../../elasticsearch/services/elasticsearch-search.service';
import { SearchController } from './search.controller';

describe('SearchController', () => {
	let controller: SearchController;
	let elasticsearchService: jest.Mocked<ElasticsearchSearchService>;

	beforeEach(async () => {
		const mockElasticsearchService = {
			autocomplete: jest.fn(),
			enhancedAutocomplete: jest.fn(),
			getSimpleWordCompletions: jest.fn(),
		};

		const mockVietnameseConfigService = {
			setupCompleteVietnameseConfig: jest.fn(),
			reindexWithVietnameseAnalyzer: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [SearchController],
			providers: [
				{
					provide: ElasticsearchSearchService,
					useValue: mockElasticsearchService,
				},
				{
					provide: 'VietnameseElasticsearchConfigService',
					useValue: mockVietnameseConfigService,
				},
			],
		}).compile();

		controller = module.get<SearchController>(SearchController);
		elasticsearchService = module.get(ElasticsearchSearchService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('autocomplete', () => {
		it('should return error for keyword less than 2 characters', async () => {
			const result = await controller.autocomplete({
				keyword: 'a',
			});

			expect(result.success).toBe(false);
			expect(result.message).toBe('Keyword must be at least 2 characters long');
			expect(result.data).toEqual([]);
		});

		it('should return word completion suggestions', async () => {
			const mockSuggestions = [
				{ text: 'trọ', score: 0.95, context: { fullText: 'Phòng trọ', query: 'phòng' } },
				{ text: 'cho thuê', score: 0.9, context: { fullText: 'Phòng cho thuê', query: 'phòng' } },
			];

			elasticsearchService.getSimpleWordCompletions.mockResolvedValue(mockSuggestions);

			const result = await controller.autocomplete({
				keyword: 'phòng',
			});

			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockSuggestions);
			expect(result.keyword).toBe('phòng');
			expect(elasticsearchService.getSimpleWordCompletions).toHaveBeenCalledWith('phòng', 10);
		});

		it('should handle elasticsearch errors gracefully', async () => {
			elasticsearchService.getSimpleWordCompletions.mockRejectedValue(new Error('ES Error'));

			const result = await controller.autocomplete({
				keyword: 'phòng',
			});

			expect(result.success).toBe(false);
			expect(result.message).toBe('Failed to get word completion suggestions');
			expect(result.data).toEqual([]);
		});
	});
});
