import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Webhook, WebhookData } from '@payos/node';
import { BillsService } from '../bills/bills.service';
import { PayosWebhookDto } from './dto';
import { PayosService } from './payos.service';

@Injectable()
export class PayosWebhookService {
	constructor(
		private readonly payosService: PayosService,
		@Inject(forwardRef(() => BillsService))
		private readonly billsService: BillsService,
	) {}

	async handleWebhook(payload: PayosWebhookDto): Promise<void> {
		const verifiedData = await this.payosService.verifyWebhook(payload as unknown as Webhook);
		const orderCode = verifiedData.orderCode;
		const transactionReference = `payos:${orderCode}`;
		const paymentDate = verifiedData.transactionDateTime
			? new Date(verifiedData.transactionDateTime)
			: new Date();

		if (!this.isSuccessfulWebhook(payload, verifiedData)) {
			await this.billsService.processPayosPaymentFailure({
				transactionReference,
				providerReference: verifiedData.reference,
				reason: verifiedData.desc,
			});
			return;
		}

		await this.billsService.processPayosPaymentSuccess({
			transactionReference,
			paymentDate,
			providerReference: verifiedData.reference,
		});
	}

	private isSuccessfulWebhook(payload: PayosWebhookDto, data: WebhookData): boolean {
		const topLevelSuccess = payload.success ?? true;
		if (!topLevelSuccess || payload.code !== '00') {
			return false;
		}
		return data?.code === '00';
	}
}
