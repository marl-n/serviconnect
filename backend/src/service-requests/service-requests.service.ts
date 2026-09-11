import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CategoryQuestionsService } from '../category-questions/category-questions.service';
import { CreateServiceRequestDto, UpdateServiceRequestStatusDto } from './dto/service-request.dto';

@Injectable()
export class ServiceRequestsService {
  constructor(
    private prisma: PrismaService,
    private categoryQuestions: CategoryQuestionsService,
  ) {}

  /** Confirms subCategoryId actually belongs to categoryId — required, mirrors BusinessesService.setSubCategories. */
  private async validateCategoryPair(categoryId: string, subCategoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new BadRequestException(`Category ${categoryId} not found`);

    const subCategory = await this.prisma.subCategory.findUnique({ where: { id: subCategoryId } });
    if (!subCategory) throw new BadRequestException(`Sub-category ${subCategoryId} not found`);
    if (subCategory.categoryId !== categoryId) {
      throw new BadRequestException('Sub-category does not belong to the given category');
    }
  }

  async create(customerId: string, dto: CreateServiceRequestDto) {
    await this.validateCategoryPair(dto.categoryId, dto.subCategoryId);
    await this.categoryQuestions.validateAnswers(dto.categoryId, dto.subCategoryId, dto.answers);

    // NOTE: matching businesses to this request and generating Lead rows is
    // deliberately not implemented yet — this phase only persists the
    // request. See project notes: "sophisticated matching engine" is a
    // later phase.
    return this.prisma.serviceRequest.create({
      data: {
        customerId,
        categoryId: dto.categoryId,
        subCategoryId: dto.subCategoryId,
        message: dto.message,
        jobAddress: dto.jobAddress,
        jobDate: dto.jobDate ? new Date(dto.jobDate) : undefined,
        budget: dto.budget,
        answers: dto.answers as any,
        status: 'OPEN',
      },
    });
  }

  async getMine(customerId: string) {
    return this.prisma.serviceRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true, slug: true } },
        leads: { select: { id: true, businessId: true, status: true, isUnlocked: true } },
      },
    });
  }

  async getById(id: string, userId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!request) throw new NotFoundException('Service request not found');
    if (request.customerId !== userId) {
      throw new ForbiddenException('You do not have access to this service request');
    }
    return request;
  }

  async updateStatus(id: string, userId: string, dto: UpdateServiceRequestStatusDto) {
    const request = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Service request not found');
    if (request.customerId !== userId) {
      throw new ForbiddenException('You do not have access to this service request');
    }
    // A customer may only cancel their own request from here; other status
    // transitions (MATCHED, FULFILLED, EXPIRED) belong to the future
    // matching engine / system processes, not a direct customer PATCH.
    if (dto.status !== 'CANCELLED') {
      throw new BadRequestException('Customers may only cancel a service request via this endpoint');
    }
    return this.prisma.serviceRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
