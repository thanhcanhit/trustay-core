import { BullModule } from '@nestjs/bull';
import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { ElasticsearchCustomModule } from '../elasticsearch/elasticsearch.module';
import { createElasticsearchSyncMiddleware } from '../elasticsearch/middleware/prisma-elasticsearch.middleware';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ChatSessionQueueProcessor } from './processors/chat-session-queue.processor';
import { ElasticsearchSyncProcessor } from './processors/elasticsearch-sync.processor';
import { EmailQueueProcessor } from './processors/email-queue.processor';
import { NotificationQueueProcessor } from './processors/notification-queue.processor';
import { ChatSessionQueueService } from './services/chat-session-queue.service';
import { ElasticsearchQueueService } from './services/elasticsearch-queue.service';
import { EmailQueueService } from './services/email-queue.service';
import { NotificationQueueService } from './services/notification-queue.service';

export const QUEUE_NAMES = {
	EMAIL: 'email-queue',
	NOTIFICATION: 'notification-queue',
	ELASTICSEARCH: 'elasticsearch-sync-queue',
	CHAT_SESSION: 'chat-session-queue',
};

@Global()
@Module({
	imports: [
		PrismaModule,
		AiModule, // Import để có thể inject ChatSessionService vào processor
		ElasticsearchCustomModule,
		BullModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				redis: {
					host: configService.get<string>('redis.host'),
					port: configService.get<number>('redis.port'),
					password: configService.get<string>('redis.password'),
				},
				defaultJobOptions: {
					attempts: 3,
					backoff: {
						type: 'exponential',
						delay: 2000,
					},
					removeOnComplete: 100, // Keep last 100 completed jobs
					removeOnFail: 500, // Keep last 500 failed jobs
				},
			}),
		}),
		BullModule.registerQueue(
			{ name: QUEUE_NAMES.EMAIL },
			{ name: QUEUE_NAMES.NOTIFICATION },
			{ name: QUEUE_NAMES.ELASTICSEARCH },
			{ name: QUEUE_NAMES.CHAT_SESSION },
		),
	],
	providers: [
		EmailQueueService,
		NotificationQueueService,
		ElasticsearchQueueService,
		ChatSessionQueueService,
		EmailQueueProcessor,
		NotificationQueueProcessor,
		ElasticsearchSyncProcessor,
		ChatSessionQueueProcessor,
	],
	exports: [
		BullModule,
		EmailQueueService,
		NotificationQueueService,
		ElasticsearchQueueService,
		ChatSessionQueueService,
	],
})
export class QueueModule implements OnModuleInit {
	constructor(
		private readonly prisma: PrismaService,
		private readonly elasticsearchQueueService: ElasticsearchQueueService,
	) {}

	onModuleInit() {
		// Register Elasticsearch sync middleware
		this.prisma.$use(createElasticsearchSyncMiddleware(this.elasticsearchQueueService));
	}
}
