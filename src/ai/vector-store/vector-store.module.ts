import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';
import { SupabaseVectorStoreService } from './supabase-vector-store.service';
import { SupabaseVectorStoreConfig } from './types/vector.types';

/**
 * Supabase Vector Store Module
 * Provides vector storage and similarity search capabilities
 */
@Module({})
export class VectorStoreModule {
	/**
	 * Register vector store module with configuration from AppConfigService
	 * @param config - Vector store table/column configuration
	 * @returns Dynamic module
	 */
	static forRoot(config?: {
		tableName?: string;
		embeddingColumnName?: string;
		contentColumnName?: string;
		metadataColumnName?: string;
	}): DynamicModule {
		const providers: Provider[] = [
			{
				provide: SupabaseVectorStoreService,
				useFactory: (appConfigService: AppConfigService): SupabaseVectorStoreService => {
					const supabaseConfig = appConfigService.supabaseConfig;

					if (!supabaseConfig.url || !supabaseConfig.anonKey) {
						throw new Error(
							'SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables',
						);
					}

					const vectorStoreConfig: SupabaseVectorStoreConfig = {
						tableName: config?.tableName || 'documents',
						embeddingColumnName: config?.embeddingColumnName || 'embedding',
						contentColumnName: config?.contentColumnName || 'content',
						metadataColumnName: config?.metadataColumnName || 'metadata',
					};

					return new SupabaseVectorStoreService(
						supabaseConfig.url,
						supabaseConfig.anonKey,
						vectorStoreConfig,
					);
				},
				inject: [AppConfigService],
			},
		];

		return {
			module: VectorStoreModule,
			providers,
			exports: [SupabaseVectorStoreService],
			global: false,
		};
	}

	/**
	 * Register vector store module with custom service instance
	 * @param supabaseUrl - Supabase project URL
	 * @param supabaseKey - Supabase anon/service key
	 * @param config - Vector store configuration
	 * @returns Dynamic module
	 */
	static forRootAsync(config?: {
		supabaseUrl: string;
		supabaseKey: string;
		tableName?: string;
		embeddingColumnName?: string;
		contentColumnName?: string;
		metadataColumnName?: string;
	}): DynamicModule {
		if (!config?.supabaseUrl || !config?.supabaseKey) {
			throw new Error('supabaseUrl and supabaseKey are required');
		}

		const providers: Provider[] = [
			{
				provide: SupabaseVectorStoreService,
				useFactory: (): SupabaseVectorStoreService => {
					const vectorStoreConfig: SupabaseVectorStoreConfig = {
						tableName: config.tableName || 'documents',
						embeddingColumnName: config.embeddingColumnName || 'embedding',
						contentColumnName: config.contentColumnName || 'content',
						metadataColumnName: config.metadataColumnName || 'metadata',
					};

					return new SupabaseVectorStoreService(
						config.supabaseUrl,
						config.supabaseKey,
						vectorStoreConfig,
					);
				},
			},
		];

		return {
			module: VectorStoreModule,
			providers,
			exports: [SupabaseVectorStoreService],
			global: false,
		};
	}
}
