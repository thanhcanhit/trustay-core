import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PayosWebhookDto } from './dto';
import { PayosWebhookService } from './payos-webhook.service';

@ApiTags('PayOS')
@Controller('payos')
export class PayosWebhookController {
	constructor(private readonly webhookService: PayosWebhookService) {}

	@Post('webhook')
	@HttpCode(200)
	@ApiOperation({ summary: 'Webhook callback endpoint for PayOS' })
	async handleWebhook(@Body() payload: PayosWebhookDto): Promise<{ success: boolean }> {
		await this.webhookService.handleWebhook(payload);
		return { success: true };
	}
}
