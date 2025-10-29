import { Module } from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';
import { SupabaseVectorStoreService } from '../vector-store/supabase-vector-store.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
	controllers: [KnowledgeController],
	providers: [
		{
			provide: 'VectorStore',
			useFactory: (appConfigService: AppConfigService): SupabaseVectorStoreService => {
				const supabaseConfig = appConfigService.supabaseConfig;
				const aiConfig = appConfigService.aiConfig;
				if (!supabaseConfig.url || !supabaseConfig.anonKey) {
					throw new Error(
						'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables',
					);
				}
				if (!aiConfig.googleApiKey) {
					throw new Error('GOOGLE_API_KEY must be set in environment variables');
				}
				// TODO: Get tenant_id and db_key from request context or config
				// For now, using default values - should be injected from request/user context
				const service = new SupabaseVectorStoreService(
					supabaseConfig.url,
					supabaseConfig.anonKey,
					{
						tenantId: '00000000-0000-0000-0000-000000000000', // Default tenant ID
						dbKey: 'default', // Default db key
					},
					aiConfig.googleApiKey,
				);
				return service;
			},
			inject: [AppConfigService],
		},
		KnowledgeService,
	],
	exports: [KnowledgeService],
})
export class KnowledgeModule {}
