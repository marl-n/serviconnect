import { Module } from '@nestjs/common';
import { CategoryQuestionsController } from './category-questions.controller';
import { CategoryQuestionsService } from './category-questions.service';

@Module({
  controllers: [CategoryQuestionsController],
  providers: [CategoryQuestionsService],
  exports: [CategoryQuestionsService],
})
export class CategoryQuestionsModule {}
