import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { CreditsModule } from '../credits/credits.module';

@Module({ imports: [CreditsModule], controllers: [LeadsController], providers: [LeadsService] })
export class LeadsModule {}
