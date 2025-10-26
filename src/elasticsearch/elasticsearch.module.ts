import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule as NestElasticsearchModule } from '@nestjs/elasticsearch';
import { ElasticsearchDebugService } from './services/elasticsearch-debug.service';
import { ElasticsearchIndexService } from './services/elasticsearch-index.service';
import { ElasticsearchSearchService } from './services/elasticsearch-search.service';
import { ElasticsearchSyncService } from './services/elasticsearch-sync.service';
import { VietnameseElasticsearchConfigService } from './services/vietnamese-elasticsearch-config.service';

@Module({
	imports: [
		NestElasticsearchModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => ({
				node: configService.get<string>('elasticsearch.node'),
				auth:
					configService.get<string>('elasticsearch.username') &&
					configService.get<string>('elasticsearch.password')
						? {
								username: configService.get<string>('elasticsearch.username'),
								password: configService.get<string>('elasticsearch.password'),
							}
						: undefined,
				maxRetries: configService.get<number>('elasticsearch.maxRetries'),
				requestTimeout: configService.get<number>('elasticsearch.requestTimeout'),
			}),
			inject: [ConfigService],
		}),
	],
	providers: [
		ElasticsearchIndexService,
		ElasticsearchSearchService,
		ElasticsearchSyncService,
		VietnameseElasticsearchConfigService,
		ElasticsearchDebugService,
	],
	exports: [
		ElasticsearchIndexService,
		ElasticsearchSearchService,
		ElasticsearchSyncService,
		VietnameseElasticsearchConfigService,
		ElasticsearchDebugService,
	],
})
export class ElasticsearchCustomModule implements OnModuleInit {
	constructor(private readonly elasticsearchIndexService: ElasticsearchIndexService) {}

	async onModuleInit() {
		try {
			// Initialize indices on module startup
			await this.elasticsearchIndexService.initializeIndices();
		} catch (error) {
			console.error('Failed to initialize Elasticsearch indices:', error);
			// Don't throw error to prevent app from crashing if ES is not available
		}
	}
}
