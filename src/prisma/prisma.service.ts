import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '@/config/config.service';
import { LoggerService } from '@/logger/logger.service';

interface PrismaQueryEvent {
	query: string;
	params: string;
	duration: number;
}

interface PrismaErrorEvent {
	message: string;
	target?: string;
}

interface PrismaInfoEvent {
	message: string;
}

interface PrismaWarnEvent {
	message: string;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
	constructor(
		private readonly logger: LoggerService,
		private readonly configService: AppConfigService,
	) {
		super({
			datasources: {
				db: {
					url: configService.databaseUrl,
				},
			},
			log: [
				{ emit: 'event', level: 'query' },
				{ emit: 'event', level: 'error' },
				{ emit: 'event', level: 'info' },
				{ emit: 'event', level: 'warn' },
			],
		});

		this.setupLogging();
	}

	private setupLogging() {
		// Log database queries in development
		if (this.configService.isDevelopment) {
			// ✅ Dùng configService thay vì process.env
			this.$on('query' as never, (e: PrismaQueryEvent) => {
				const params = e.params ? (JSON.parse(e.params) as unknown[]) : [];
				this.logger.logDbQuery(e.query, params, e.duration);
			});
		}

		this.$on('error' as never, (e: PrismaErrorEvent) => {
			this.logger.error(`Database error: ${e.message}`, e.target, 'Database');
		});

		this.$on('info' as never, (e: PrismaInfoEvent) => {
			this.logger.log(`Database info: ${e.message}`, 'Database');
		});

		this.$on('warn' as never, (e: PrismaWarnEvent) => {
			this.logger.warn(`Database warning: ${e.message}`, 'Database');
		});
	}

	async onModuleInit() {
		try {
			await this.$connect();
			this.logger.log('Database connected successfully', 'Database');

			// Set the Prisma service in logger to enable database error logging
			this.logger.setPrismaService(this);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.stack : String(error);
			this.logger.error('Failed to connect to database', errorMessage, 'Database');
			throw error;
		}
	}

	async onModuleDestroy() {
		try {
			await this.$disconnect();
			this.logger.log('Database disconnected', 'Database');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.stack : String(error);
			this.logger.error('Error disconnecting from database', errorMessage, 'Database');
		}
	}
}
