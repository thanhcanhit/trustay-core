import { BullModule } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailQueueProcessor } from './processors/email-queue.processor';
import { NotificationQueueProcessor } from './processors/notification-queue.processor';
import { EmailQueueService } from './services/email-queue.service';
import { NotificationQueueService } from './services/notification-queue.service';

export const QUEUE_NAMES = {
	EMAIL: 'email-queue',
	NOTIFICATION: 'notification-queue',
};

@Global()
@Module({
	imports: [
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
		BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL }, { name: QUEUE_NAMES.NOTIFICATION }),
	],
	providers: [
		EmailQueueService,
		NotificationQueueService,
		EmailQueueProcessor,
		NotificationQueueProcessor,
	],
	exports: [BullModule, EmailQueueService, NotificationQueueService],
})
export class QueueModule {}
