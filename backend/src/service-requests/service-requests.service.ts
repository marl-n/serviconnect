import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CategoryQuestionsService } from '../category-questions/category-questions.service';
import { MatchingService } from '../matching/matching.service';
import { CreateServiceRequestDto, UpdateServiceRequestStatusDto } from './dto/service-request.dto';

@Injectable()
export class ServiceRequestsService {
  constructor(
    private prisma: PrismaService,
    private categoryQuestions: CategoryQuestionsService,
    @Optional() private matching?: MatchingService,
  ) {}

  private readonly log = new Logger(ServiceRequestsService.name);

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

  /** Town is required and must exist; suburb (optional) must exist and belong to that town. */
  private async validateLocation(townId: string, suburbId?: string) {
    if (!townId) throw new BadRequestException('A town is required for every service request');

    const town = await this.prisma.town.findUnique({ where: { id: townId } });
    if (!town) throw new BadRequestException(`Town ${townId} not found`);

    if (suburbId) {
      const suburb = await this.prisma.suburb.findUnique({ where: { id: suburbId } });
      if (!suburb) throw new BadRequestException(`Suburb ${suburbId} not found`);
      if (suburb.townId !== townId) {
        throw new BadRequestException('Suburb does not belong to the given town');
      }
    }
  }

  async create(customerId: string, dto: CreateServiceRequestDto) {
    await this.validateCategoryPair(dto.categoryId, dto.subCategoryId);
    await this.validateLocation(dto.townId, dto.suburbId);
    await this.categoryQuestions.validateAnswers(dto.categoryId, dto.subCategoryId, dto.answers);

    const request = await this.prisma.serviceRequest.create({
      data: {
        customerId,
        categoryId: dto.categoryId,
        subCategoryId: dto.subCategoryId,
        message: dto.message,
        townId: dto.townId,
        suburbId: dto.suburbId,
        jobAddress: dto.jobAddress,
        jobDate: dto.jobDate ? new Date(dto.jobDate) : undefined,
        budget: dto.budget,
        answers: dto.answers as any,
        photos: dto.photos ?? [],
        status: 'OPEN',
      },
    });

    // Create one locked Lead per eligible business. A matching failure must not
    // lose the customer's request: it is logged, and the request stays OPEN.
    let matchedBusinesses = 0;
    try {
      matchedBusinesses = (await this.matching?.matchRequest(request.id)) ?? 0;
    } catch (err) {
      this.log.error(`Matching failed for request ${request.id}`, err as any);
    }
    return { ...request, status: matchedBusinesses > 0 ? 'MATCHED' : request.status, matchedBusinesses };
  }

  async getMine(customerId: string) {
    return this.prisma.serviceRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true, slug: true } },
        town: { select: { id: true, name: true, province: { select: { id: true, name: true } } } },
        suburb: { select: { id: true, name: true } },
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
        town: { select: { id: true, name: true, province: { select: { id: true, name: true } } } },
        suburb: { select: { id: true, name: true } },
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
