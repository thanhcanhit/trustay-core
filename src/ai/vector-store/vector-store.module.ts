import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';
import { SupabaseVectorStoreService } from './supabase-vector-store.service';
import { SupabaseVectorStoreConfig } from './types/vector.types';

/**
 * Supabase Vector Store Module
 * Provides vector storage and similarity search capabilities
 */
@Module({})
export class VectorStoreModule {}

/**
 * Register vector store module with configuration from AppConfigService
 * @param config - Vector store tenant/database configuration
 * @returns Dynamic module
 */
export function registerVectorStoreModule(config: {
	tenantId: string;
	dbKey: string;
}): DynamicModule {
	const providers: Provider[] = [
		{
			provide: SupabaseVectorStoreService,
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

				const vectorStoreConfig: SupabaseVectorStoreConfig = {
					tenantId: config.tenantId,
					dbKey: config.dbKey,
				};

				return new SupabaseVectorStoreService(
					supabaseConfig.url,
					supabaseConfig.anonKey,
					vectorStoreConfig,
					aiConfig.googleApiKey,
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
 * @param config - Vector store tenant/database configuration
 * @returns Dynamic module
 */
export function registerVectorStoreModuleAsync(config?: {
	supabaseUrl: string;
	supabaseKey: string;
	tenantId: string;
	dbKey: string;
}): DynamicModule {
	if (!config || !config.supabaseUrl || !config.supabaseKey) {
		throw new Error('supabaseUrl and supabaseKey are required');
	}

	const providers: Provider[] = [
		{
			provide: SupabaseVectorStoreService,
			useFactory: (): SupabaseVectorStoreService => {
				const vectorStoreConfig: SupabaseVectorStoreConfig = {
					tenantId: config.tenantId,
					dbKey: config.dbKey,
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
