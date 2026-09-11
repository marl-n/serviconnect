import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCategoryQuestionDto, UpdateCategoryQuestionDto } from './dto/category-question.dto';

@Injectable()
export class CategoryQuestionsService {
  constructor(private prisma: PrismaService) {}

  /** Confirms subCategoryId (if given) actually belongs to categoryId. */
  private async validateCategoryPair(categoryId: string, subCategoryId?: string | null) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new BadRequestException(`Category ${categoryId} not found`);

    if (subCategoryId) {
      const subCategory = await this.prisma.subCategory.findUnique({ where: { id: subCategoryId } });
      if (!subCategory) throw new BadRequestException(`Sub-category ${subCategoryId} not found`);
      if (subCategory.categoryId !== categoryId) {
        throw new BadRequestException('Sub-category does not belong to the given category');
      }
    }
    return category;
  }

  async create(dto: CreateCategoryQuestionDto) {
    await this.validateCategoryPair(dto.categoryId, dto.subCategoryId);

    return this.prisma.categoryQuestion.create({
      data: {
        categoryId: dto.categoryId,
        subCategoryId: dto.subCategoryId,
        key: dto.key,
        label: dto.label,
        type: dto.type as any,
        options: dto.options as any,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryQuestionDto) {
    const existing = await this.prisma.categoryQuestion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Question not found');

    return this.prisma.categoryQuestion.update({
      where: { id },
      data: {
        label: dto.label,
        type: dto.type as any,
        options: dto.options as any,
        isRequired: dto.isRequired,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.categoryQuestion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Question not found');
    await this.prisma.categoryQuestion.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Returns the applicable question set for a category (+ optional
   * subcategory): every category-wide question, plus subcategory-specific
   * ones when a subCategoryId is given.
   */
  async listForCategory(categoryId: string, subCategoryId?: string) {
    return this.prisma.categoryQuestion.findMany({
      where: {
        categoryId,
        OR: [{ subCategoryId: null }, ...(subCategoryId ? [{ subCategoryId }] : [])],
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Validates a submitted `answers` object against the configured
   * questions for a category/subcategory: every `isRequired` question must
   * have a non-empty value present under its `key`.
   * Used by ServiceRequestsService when creating a ServiceRequest.
   */
  async validateAnswers(categoryId: string, subCategoryId: string, answers: Record<string, unknown> | undefined | null) {
    const questions = await this.listForCategory(categoryId, subCategoryId);
    const missing = questions
      .filter((q) => q.isRequired)
      .filter((q) => {
        const value = answers?.[q.key];
        return value === undefined || value === null || value === '';
      })
      .map((q) => q.label);

    if (missing.length > 0) {
      throw new BadRequestException(`Missing required answers: ${missing.join(', ')}`);
    }
  }
}
