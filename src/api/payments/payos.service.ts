import {
	BadRequestException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from '@nestjs/common';
import {
	CreatePaymentLinkResponse,
	PaymentLinkItem,
	PayOS,
	Webhook,
	WebhookData,
} from '@payos/node';
import { AppConfigService } from '../../config/config.service';

type PayosCredentials = {
	clientId: string;
	apiKey: string;
	checksumKey: string;
	returnUrl: string;
	cancelUrl: string;
};

export type PayosPaymentLinkPayload = {
	orderCode: number;
	amount: number;
	description: string;
	items?: PaymentLinkItem[];
	returnUrl?: string;
	cancelUrl?: string;
	buyerName?: string;
	buyerEmail?: string;
	buyerPhone?: string;
	buyerAddress?: string;
};

export type PayosPaymentLinkResult = {
	checkoutUrl: string;
	qrCode: string;
	orderCode: number;
	amount: number;
	currency: string;
	description: string;
	paymentLinkId: string;
	expiredAt: number | null;
};

/**
 * Encapsulates all PayOS SDK interactions to keep higher-level services agnostic of SDK details.
 */
@Injectable()
export class PayosService {
	private readonly logger = new Logger(PayosService.name);
	private readonly payosClient: PayOS;
	private readonly credentials: PayosCredentials;

	constructor(private readonly appConfig: AppConfigService) {
		this.credentials = this.appConfig.payosConfig;
		this.validateCredentials();
		this.payosClient = new PayOS({
			clientId: this.credentials.clientId,
			apiKey: this.credentials.apiKey,
			checksumKey: this.credentials.checksumKey,
		});
	}

	/**
	 * Creates a PayOS payment link using the SDK.
	 * @param payload Input data required to build the payment link.
	 */
	async createPaymentLink(payload: PayosPaymentLinkPayload): Promise<PayosPaymentLinkResult> {
		const normalizedAmount = this.normalizeAmount(payload.amount);
		const normalizedItems = this.normalizeItems(payload.items);
		const { cancelUrl, returnUrl } = this.resolveRedirectUrls(payload);
		const sanitizedDescription = this.truncateDescription(payload.description);
		try {
			const response = await this.payosClient.paymentRequests.create({
				orderCode: payload.orderCode,
				amount: normalizedAmount,
				description: sanitizedDescription,
				cancelUrl,
				returnUrl,
				items: normalizedItems.length > 0 ? normalizedItems : undefined,
				buyerName: payload.buyerName,
				buyerEmail: payload.buyerEmail,
				buyerPhone: payload.buyerPhone,
				buyerAddress: payload.buyerAddress,
			});
			return this.mapResponse(response);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.logger.error(
				`Failed to create PayOS payment link: ${message}`,
				error instanceof Error ? error.stack : undefined,
			);
			throw new ServiceUnavailableException(
				'Unable to create PayOS payment link right now, please try again later.',
			);
		}
	}

	private normalizeAmount(amount: number): number {
		const roundedAmount = Math.round(amount);
		if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
			throw new BadRequestException('Payment amount must be a positive integer greater than 0.');
		}
		return roundedAmount;
	}

	private normalizeItems(items?: PaymentLinkItem[]): PaymentLinkItem[] {
		if (!items || items.length === 0) {
			return [];
		}
		const normalizedItems = items
			.map((item) => {
				const roundedPrice = Math.round(item.price);
				if (!Number.isFinite(roundedPrice) || roundedPrice <= 0) {
					return null;
				}
				return {
					...item,
					price: roundedPrice,
				};
			})
			.filter((item): item is PaymentLinkItem => item !== null);
		return normalizedItems;
	}

	private truncateDescription(description: string): string {
		const MAX_LENGTH = 25;
		const fallback = 'Trustay payment';
		if (!description || description.trim().length === 0) {
			return fallback;
		}
		if (description.length <= MAX_LENGTH) {
			return description;
		}
		return `${description.slice(0, MAX_LENGTH - 3)}...`;
	}

	private resolveRedirectUrls(payload: PayosPaymentLinkPayload): {
		cancelUrl: string;
		returnUrl: string;
	} {
		const cancelUrl = payload.cancelUrl ?? this.credentials.cancelUrl;
		const returnUrl = payload.returnUrl ?? this.credentials.returnUrl;
		if (!cancelUrl || !returnUrl) {
			throw new ServiceUnavailableException('PayOS redirect URLs are not configured.');
		}
		return { cancelUrl, returnUrl };
	}

	private validateCredentials(): void {
		if (!this.credentials.clientId || !this.credentials.apiKey || !this.credentials.checksumKey) {
			throw new ServiceUnavailableException('PayOS credentials are not configured.');
		}
	}

	private mapResponse(response: CreatePaymentLinkResponse): PayosPaymentLinkResult {
		return {
			checkoutUrl: response.checkoutUrl,
			qrCode: response.qrCode,
			orderCode: response.orderCode,
			amount: response.amount,
			currency: response.currency,
			description: response.description,
			paymentLinkId: response.paymentLinkId,
			expiredAt: response.expiredAt ?? null,
		};
	}

	/**
	 * Verifies webhook payload sent from PayOS.
	 * @param payload Raw webhook payload received from PayOS.
	 */
	async verifyWebhook(payload: Webhook): Promise<WebhookData> {
		try {
			return await this.payosClient.webhooks.verify(payload);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.logger.warn(`Invalid PayOS webhook payload: ${message}`);
			throw new BadRequestException('Invalid PayOS webhook payload');
		}
	}
}
