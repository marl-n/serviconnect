import { Module } from '@nestjs/common';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';
import { CategoryQuestionsModule } from '../category-questions/category-questions.module';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [CategoryQuestionsModule, MatchingModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
