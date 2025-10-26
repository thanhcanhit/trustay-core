import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class VietnameseElasticsearchConfigService {
	private readonly logger = new Logger(VietnameseElasticsearchConfigService.name);

	constructor(private readonly elasticsearchService: ElasticsearchService) {}

	/**
	 * Vietnamese stopwords list
	 */
	private readonly vietnameseStopwords = [
		// Articles and pronouns
		'của',
		'cho',
		'với',
		'tại',
		'trong',
		'ngoài',
		'trên',
		'dưới',
		'giữa',
		'bên',
		'cạnh',
		'và',
		'hoặc',
		'nhưng',
		'mà',
		'thì',
		'nếu',
		'vì',
		'nên',
		'để',
		'được',
		'có',
		'là',
		'một',
		'các',
		'những',
		'này',
		'đó',
		'kia',
		'đây',
		'đấy',
		'ấy',
		'nọ',

		// Time and frequency
		'khi',
		'lúc',
		'thời',
		'giờ',
		'ngày',
		'tháng',
		'năm',
		'tuần',
		'thứ',
		'cuối',
		'đã',
		'sẽ',
		'đang',
		'vừa',
		'mới',
		'cũng',
		'lại',
		'nữa',
		'thêm',
		'nhiều',
		'ít',

		// Common verbs
		'có',
		'là',
		'được',
		'bị',
		'phải',
		'nên',
		'cần',
		'muốn',
		'thích',
		'ghét',
		'biết',
		'hiểu',
		'nghĩ',
		'tin',
		'hy vọng',
		'mong',
		'chờ',
		'đợi',

		// Adjectives
		'tốt',
		'xấu',
		'đẹp',
		'xấu',
		'lớn',
		'nhỏ',
		'cao',
		'thấp',
		'dài',
		'ngắn',
		'nhanh',
		'chậm',
		'dễ',
		'khó',
		'rẻ',
		'đắt',
		'mới',
		'cũ',
		'sạch',
		'bẩn',

		// Prepositions
		'từ',
		'đến',
		'qua',
		'theo',
		'cùng',
		'về',
		'đi',
		'lại',
		'ra',
		'vào',

		// Common words
		'người',
		'nhà',
		'phòng',
		'căn',
		'tầng',
		'lầu',
		'số',
		'địa',
		'chỉ',
		'điện',
		'thoại',
		'email',
		'website',
		'facebook',
		'zalo',
		'viber',
	];

	/**
	 * Vietnamese synonyms for room rental
	 */
	private readonly vietnameseSynonyms = [
		// Room types
		'phòng trọ,trọ,nhà trọ,phòng cho thuê',
		'căn hộ,apartment,chung cư',
		'nhà nguyên căn,nhà riêng,biệt thự',
		'ký túc xá,dormitory,ktx',
		'homestay,nhà nghỉ,khách sạn',

		// Location terms
		'gần biển,cạnh biển,sát biển',
		'gần trung tâm,cạnh trung tâm,sát trung tâm',
		'gần trường,cạnh trường,sát trường',
		'gần chợ,cạnh chợ,sát chợ',
		'gần bệnh viện,cạnh bệnh viện,sát bệnh viện',

		// Amenities
		'máy lạnh,điều hòa,ac',
		'máy nước nóng,bình nóng lạnh',
		'tủ lạnh,tủ đông',
		'máy giặt,giặt ủi',
		'wifi,internet,mạng',
		'camera,an ninh,bảo vệ',
		'xe máy,motor,bike',
		'ô tô,car,xe hơi',

		// Price terms
		'giá rẻ,rẻ,tiết kiệm',
		'giá tốt,tốt,hợp lý',
		'giá cao,đắt,cao cấp',
		'thuê,cho thuê,rent',
		'tiền thuê,giá thuê,phí thuê',

		// Time terms
		'tháng,monthly,hàng tháng',
		'ngày,daily,hàng ngày',
		'tuần,weekly,hàng tuần',
		'năm,yearly,hàng năm',
	];

	/**
	 * Create Vietnamese analyzer configuration following the standard flow
	 * with ICU plugin support for proper Vietnamese text processing
	 */
	async createVietnameseAnalyzer(): Promise<void> {
		try {
			const settings = {
				analysis: {
					char_filter: {
						vi_map: {
							type: 'mapping',
							mappings: [
								'tp. => thanh pho ',
								'TP. => thanh pho ',
								'HCM => ho chi minh',
								'HN => ha noi',
								'SG => sai gon',
								'ĐN => da nang',
								'NT => nha trang',
								'HP => hai phong',
								'CT => can tho',
								'BD => binh duong',
								'ĐT => dong thap',
								'AG => an giang',
								'BV => ben tre',
								'BL => bac lieu',
								'CM => ca mau',
								'ĐL => dak lak',
								'ĐN => dak nong',
								'GL => gia lai',
								'KL => kon tum',
								'PY => phu yen',
								'QB => quang binh',
								'QN => quang nam',
								'QT => quang tri',
								'TH => thua thien hue',
								'VT => vung tau',
								'BR => ba ria',
								'BT => binh thuan',
								'KH => khanh hoa',
								'LA => lam dong',
								'NB => ninh binh',
								'TB => thai binh',
								'HB => hai duong',
								'HN => hung yen',
								'HY => ha nam',
								'NA => nam dinh',
								'ND => ninh binh',
								'TB => thai binh',
								'VP => vinh phuc',
								'BN => bac ninh',
								'BG => bac giang',
								'LC => lang son',
								'CB => cao bang',
								'BK => bac kan',
								'TN => tuyen quang',
								'PT => phu tho',
								'YB => yen bai',
								'LS => lao cai',
								'DB => dien bien',
								'LB => lai chau',
								'SN => son la',
								'HB => hoa binh',
								'HD => ha giang',
							],
						},
					},
					filter: {
						vi_edge: {
							type: 'edge_ngram',
							min_gram: 2,
							max_gram: 15,
						},
						vi_ngram: {
							type: 'ngram',
							min_gram: 3,
							max_gram: 15,
						},
						vi_shingle: {
							type: 'shingle',
							min_shingle_size: 2,
							max_shingle_size: 3,
							output_unigrams: true,
						},
						vietnamese_stop: {
							type: 'stop',
							stopwords: this.vietnameseStopwords,
						},
						vietnamese_synonyms: {
							type: 'synonym',
							synonyms: this.vietnameseSynonyms,
						},
						vietnamese_stemmer: {
							type: 'stemmer',
							language: 'vietnamese',
						},
					},
					analyzer: {
						vi_base: {
							type: 'custom',
							char_filter: ['vi_map'],
							tokenizer: 'standard',
							filter: ['lowercase'],
						},
						vi_folded: {
							type: 'custom',
							char_filter: ['vi_map'],
							tokenizer: 'standard',
							filter: ['lowercase'],
						},
						vi_autocomplete_index: {
							type: 'custom',
							char_filter: ['vi_map'],
							tokenizer: 'standard',
							filter: ['lowercase', 'vi_edge'],
						},
						vi_autocomplete_search: {
							type: 'custom',
							char_filter: ['vi_map'],
							tokenizer: 'standard',
							filter: ['lowercase'],
						},
						vi_phrase: {
							type: 'custom',
							char_filter: ['vi_map'],
							tokenizer: 'standard',
							filter: ['lowercase', 'vi_shingle'],
						},
						vietnamese_analyzer: {
							type: 'custom',
							char_filter: ['vi_map'],
							tokenizer: 'standard',
							filter: ['lowercase', 'vietnamese_stop', 'vietnamese_synonyms', 'vietnamese_stemmer'],
						},
						vietnamese_search_analyzer: {
							type: 'custom',
							char_filter: ['vi_map'],
							tokenizer: 'standard',
							filter: ['lowercase', 'vietnamese_stop', 'vietnamese_synonyms'],
						},
						vietnamese_completion_analyzer: {
							type: 'custom',
							char_filter: ['vi_map'],
							tokenizer: 'keyword',
							filter: ['lowercase', 'vietnamese_stop', 'vietnamese_synonyms'],
						},
					},
					normalizer: {
						vi_keyword_folded: {
							type: 'custom',
							filter: ['lowercase'],
						},
					},
					tokenizer: {
						vietnamese_tokenizer: {
							type: 'standard',
						},
					},
				},
			};

			// Apply to all room-related indices
			const indices = ['rooms', 'room-seeking', 'roommate-seeking'];

			for (const index of indices) {
				try {
					await this.elasticsearchService.indices.putSettings({
						index,
						body: settings as any,
					});
					this.logger.log(`✅ Applied Vietnamese analyzer settings to index: ${index}`);
				} catch (error) {
					this.logger.warn(`⚠️ Failed to apply settings to index ${index}: ${error.message}`);
				}
			}

			this.logger.log('✅ Vietnamese analyzer configuration completed');
		} catch (error) {
			this.logger.error('❌ Failed to create Vietnamese analyzer:', error);
			throw error;
		}
	}

	/**
	 * Update room mapping with Vietnamese analyzer and completion suggester
	 */
	async updateRoomMapping(): Promise<void> {
		try {
			const mapping = {
				properties: {
					// Basic fields
					id: { type: 'keyword' },
					slug: { type: 'keyword' },
					roomType: { type: 'keyword' },
					areaSqm: { type: 'float' },
					maxOccupancy: { type: 'integer' },
					totalRooms: { type: 'integer' },
					viewCount: { type: 'integer' },
					isActive: { type: 'boolean' },
					isVerified: { type: 'boolean' },
					overallRating: { type: 'float' },
					totalRatings: { type: 'integer' },
					createdAt: { type: 'date' },
					updatedAt: { type: 'date' },

					// Room fields with Vietnamese support
					name: {
						type: 'text',
						analyzer: 'vi_base',
						fields: {
							folded: {
								type: 'text',
								analyzer: 'vi_folded',
							},
							ac: {
								type: 'text',
								analyzer: 'vi_autocomplete_index',
								search_analyzer: 'vi_autocomplete_search',
							},
							ng: {
								type: 'text',
								analyzer: 'vi_autocomplete_index',
								search_analyzer: 'vi_autocomplete_search',
							},
							phrase: {
								type: 'text',
								analyzer: 'vi_phrase',
							},
						},
					},
					description: {
						type: 'text',
						analyzer: 'vi_base',
						fields: {
							folded: {
								type: 'text',
								analyzer: 'vi_folded',
							},
						},
					},

					// Completion suggester field
					name_suggest: {
						type: 'completion',
						analyzer: 'vi_autocomplete_index',
						search_analyzer: 'vi_autocomplete_search',
						preserve_separators: true,
						preserve_position_increments: true,
					},

					// Building fields
					'building.name': {
						type: 'text',
						analyzer: 'vi_base',
						fields: {
							folded: {
								type: 'text',
								analyzer: 'vi_folded',
							},
							ac: {
								type: 'text',
								analyzer: 'vi_autocomplete_index',
								search_analyzer: 'vi_autocomplete_search',
							},
						},
					},
					'building.description': {
						type: 'text',
						analyzer: 'vi_base',
						fields: {
							folded: {
								type: 'text',
								analyzer: 'vi_folded',
							},
						},
					},
					'building.address': {
						type: 'text',
						analyzer: 'vi_base',
						fields: {
							folded: {
								type: 'text',
								analyzer: 'vi_folded',
							},
						},
					},

					// Location fields with normalizer
					city: {
						type: 'keyword',
						normalizer: 'vi_keyword_folded',
					},
					district: {
						type: 'keyword',
						normalizer: 'vi_keyword_folded',
					},
					ward: {
						type: 'keyword',
						normalizer: 'vi_keyword_folded',
					},

					// Amenities with normalizer
					amenities: {
						type: 'keyword',
						normalizer: 'vi_keyword_folded',
					},

					// Price and rating
					price: { type: 'float' },
					rating: { type: 'float' },

					// Vietnamese sorting
					name_sort: {
						type: 'icu_collation_keyword',
						index: false,
						language: 'vi',
					},
				},
			};

			await this.elasticsearchService.indices.putMapping({
				index: 'rooms',
				body: mapping as any,
			});

			this.logger.log('✅ Updated room mapping with Vietnamese analyzer');
		} catch (error) {
			this.logger.error('❌ Failed to update room mapping:', error);
			throw error;
		}
	}

	/**
	 * Update room-seeking mapping with Vietnamese analyzer
	 */
	async updateRoomSeekingMapping(): Promise<void> {
		try {
			const mapping = {
				properties: {
					id: { type: 'keyword' },
					title: {
						type: 'text',
						analyzer: 'vi_base',
						fields: {
							folded: {
								type: 'text',
								analyzer: 'vi_folded',
							},
							ac: {
								type: 'text',
								analyzer: 'vi_autocomplete_index',
								search_analyzer: 'vi_autocomplete_search',
							},
							phrase: {
								type: 'text',
								analyzer: 'vi_phrase',
							},
						},
					},
					description: {
						type: 'text',
						analyzer: 'vi_base',
						fields: {
							folded: {
								type: 'text',
								analyzer: 'vi_folded',
							},
						},
					},
					searchText: {
						type: 'text',
						analyzer: 'vi_base',
						fields: {
							folded: {
								type: 'text',
								analyzer: 'vi_folded',
							},
						},
					},
					city: {
						type: 'keyword',
						normalizer: 'vi_keyword_folded',
					},
					district: {
						type: 'keyword',
						normalizer: 'vi_keyword_folded',
					},
					ward: {
						type: 'keyword',
						normalizer: 'vi_keyword_folded',
					},
					createdAt: { type: 'date' },
					updatedAt: { type: 'date' },
				},
			};

			await this.elasticsearchService.indices.putMapping({
				index: 'room-seeking',
				body: mapping as any,
			});

			this.logger.log('✅ Updated room-seeking mapping with Vietnamese analyzer');
		} catch (error) {
			this.logger.error('❌ Failed to update room-seeking mapping:', error);
			throw error;
		}
	}

	/**
	 * Update roommate-seeking mapping with Vietnamese analyzer
	 */
	async updateRoommateSeekingMapping(): Promise<void> {
		try {
			const mapping = {
				properties: {
					id: { type: 'keyword' },
					title: {
						type: 'text',
						analyzer: 'vi_base',
						fields: {
							folded: {
								type: 'text',
								analyzer: 'vi_folded',
							},
							ac: {
								type: 'text',
								analyzer: 'vi_autocomplete_index',
								search_analyzer: 'vi_autocomplete_search',
							},
							phrase: {
								type: 'text',
								analyzer: 'vi_phrase',
							},
						},
					},
					description: {
						type: 'text',
						analyzer: 'vi_base',
						fields: {
							folded: {
								type: 'text',
								analyzer: 'vi_folded',
							},
						},
					},
					searchText: {
						type: 'text',
						analyzer: 'vi_base',
						fields: {
							folded: {
								type: 'text',
								analyzer: 'vi_folded',
							},
						},
					},
					city: {
						type: 'keyword',
						normalizer: 'vi_keyword_folded',
					},
					district: {
						type: 'keyword',
						normalizer: 'vi_keyword_folded',
					},
					ward: {
						type: 'keyword',
						normalizer: 'vi_keyword_folded',
					},
					createdAt: { type: 'date' },
					updatedAt: { type: 'date' },
				},
			};

			await this.elasticsearchService.indices.putMapping({
				index: 'roommate-seeking',
				body: mapping as any,
			});

			this.logger.log('✅ Updated roommate-seeking mapping with Vietnamese analyzer');
		} catch (error) {
			this.logger.error('❌ Failed to update roommate-seeking mapping:', error);
			throw error;
		}
	}

	/**
	 * Setup complete Vietnamese configuration for all indices
	 */
	async setupCompleteVietnameseConfig(): Promise<void> {
		try {
			this.logger.log('🚀 Starting Vietnamese Elasticsearch configuration...');

			// 1. Create Vietnamese analyzer
			await this.createVietnameseAnalyzer();

			// 2. Update mappings for all indices
			await this.updateRoomMapping();
			await this.updateRoomSeekingMapping();
			await this.updateRoommateSeekingMapping();

			this.logger.log('✅ Vietnamese Elasticsearch configuration completed successfully!');
		} catch (error) {
			this.logger.error('❌ Failed to setup Vietnamese configuration:', error);
			throw error;
		}
	}

	/**
	 * Reindex data with Vietnamese analyzer
	 */
	async reindexWithVietnameseAnalyzer(): Promise<void> {
		try {
			this.logger.log('🔄 Starting reindexing with Vietnamese analyzer...');

			const indices = ['rooms', 'room-seeking', 'roommate-seeking'];

			for (const index of indices) {
				try {
					// Check if index exists
					const exists = await this.elasticsearchService.indices.exists({
						index,
					});

					if (!exists) {
						this.logger.warn(`⚠️ Index ${index} does not exist, skipping reindex`);
						continue;
					}

					// Reindex with refresh
					await this.elasticsearchService.indices.refresh({
						index,
					});

					this.logger.log(`✅ Refreshed index: ${index}`);
				} catch (error) {
					this.logger.warn(`⚠️ Failed to refresh index ${index}: ${error.message}`);
				}
			}

			this.logger.log('✅ Reindexing completed successfully!');
		} catch (error) {
			this.logger.error('❌ Failed to reindex:', error);
			throw error;
		}
	}
}
