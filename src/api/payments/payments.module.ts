import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillsModule } from '../bills/bills.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PayosService } from './payos.service';
import { PayosWebhookController } from './payos-webhook.controller';
import { PayosWebhookService } from './payos-webhook.service';

@Module({
	imports: [PrismaModule, NotificationsModule, forwardRef(() => BillsModule)],
	controllers: [PaymentsController, PayosWebhookController],
	providers: [PaymentsService, PayosService, PayosWebhookService],
	exports: [PaymentsService, PayosService, PayosWebhookService],
})
export class PaymentsModule {}
