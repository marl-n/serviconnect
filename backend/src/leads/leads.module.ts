import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { CreditsModule } from '../credits/credits.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({ imports: [CreditsModule, NotificationsModule], controllers: [LeadsController], providers: [LeadsService] })
export class LeadsModule {}
