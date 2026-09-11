import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoryQuestionsService } from './category-questions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Public } from '../common/decorators/index';
import { UserRole } from '@prisma/client';
import { CreateCategoryQuestionDto, UpdateCategoryQuestionDto } from './dto/category-question.dto';

@ApiTags('Category Questions')
@Controller('category-questions')
export class CategoryQuestionsController {
  constructor(private questions: CategoryQuestionsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get the question set for a category (+ optional subcategory) — drives the ServiceRequest form' })
  list(@Query('categoryId') categoryId: string, @Query('subCategoryId') subCategoryId?: string) {
    return this.questions.listForCategory(categoryId, subCategoryId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Create a category question' })
  create(@Body() dto: CreateCategoryQuestionDto) {
    return this.questions.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Update a category question' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryQuestionDto) {
    return this.questions.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Delete a category question' })
  remove(@Param('id') id: string) {
    return this.questions.delete(id);
  }
}
