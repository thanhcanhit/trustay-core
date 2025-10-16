import { BullModule } from '@nestjs/bull';
import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchCustomModule } from '../elasticsearch/elasticsearch.module';
import { createElasticsearchSyncMiddleware } from '../elasticsearch/middleware/prisma-elasticsearch.middleware';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ElasticsearchSyncProcessor } from './processors/elasticsearch-sync.processor';
import { EmailQueueProcessor } from './processors/email-queue.processor';
import { NotificationQueueProcessor } from './processors/notification-queue.processor';
import { ElasticsearchQueueService } from './services/elasticsearch-queue.service';
import { EmailQueueService } from './services/email-queue.service';
import { NotificationQueueService } from './services/notification-queue.service';

export const QUEUE_NAMES = {
	EMAIL: 'email-queue',
	NOTIFICATION: 'notification-queue',
	ELASTICSEARCH: 'elasticsearch-sync-queue',
};

@Global()
@Module({
	imports: [
		PrismaModule,
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
		),
	],
	providers: [
		EmailQueueService,
		NotificationQueueService,
		ElasticsearchQueueService,
		EmailQueueProcessor,
		NotificationQueueProcessor,
		ElasticsearchSyncProcessor,
	],
	exports: [BullModule, EmailQueueService, NotificationQueueService, ElasticsearchQueueService],
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
