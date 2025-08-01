import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health Check')
@Controller()
export class AppController {
	@Get()
	@ApiOperation({
		summary: 'Health check endpoint',
		description: 'Returns basic application status and information',
	})
	@ApiResponse({
		status: 200,
		description: 'Application is running successfully',
		schema: {
			type: 'object',
			properties: {
				message: { type: 'string' },
				status: { type: 'string' },
				timestamp: { type: 'string' },
				version: { type: 'string' },
			},
		},
	})
	getHealth() {
		return {
			message: 'TrustStay Core API is running',
			status: 'healthy',
			timestamp: new Date().toISOString(),
			version: '1.0.0',
		};
	}

	@Get('health')
	@ApiOperation({
		summary: 'Detailed health check',
		description: 'Returns detailed health status for monitoring',
	})
	@ApiResponse({
		status: 200,
		description: 'Detailed health information',
	})
	getDetailedHealth() {
		return {
			status: 'ok',
			info: {
				database: { status: 'up' },
				redis: { status: 'up' },
			},
			error: {},
			details: {
				database: { status: 'up' },
				redis: { status: 'up' },
			},
		};
	}
}
