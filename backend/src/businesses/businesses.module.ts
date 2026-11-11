import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { SavedBusinessesController } from './saved.controller';
import { SavedBusinessesService } from './saved.service';
import { LocationsModule } from '../locations/locations.module';
import { MatchingModule } from '../matching/matching.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [LocationsModule, MatchingModule, CreditsModule],
  controllers: [BusinessesController, SavedBusinessesController],
  providers: [BusinessesService, SavedBusinessesService],
})
export class BusinessesModule {}
