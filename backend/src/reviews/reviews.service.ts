import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(customerId: string, dto: any) {
    // Eligibility check — customer must have an ACCEPTED or COMPLETED lead with this business
    const eligibleLead = await this.prisma.lead.findFirst({
      where: {
        customerId,
        businessId: dto.businessId,
        status: { in: ['ACCEPTED', 'COMPLETED'] },
      },
    });
    if (!eligibleLead) {
      throw new BadRequestException('You can only review a business after accepting their quote.');
    }

    // Prevent duplicate reviews
    const existing = await this.prisma.review.findFirst({
      where: { customerId, businessId: dto.businessId },
    });
    if (existing) {
      throw new BadRequestException('You have already reviewed this business.');
    }

    const review = await this.prisma.review.create({
      data: {
        customerId,
        businessId: dto.businessId,
        rating: dto.rating,
        comment: dto.comment,
        leadId: eligibleLead.id,
        isVerified: true, // verified because they have a real lead
      },
    });

    // Recalculate business rating average
    const agg = await this.prisma.review.aggregate({
      where: { businessId: dto.businessId },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.business.update({
      where: { id: dto.businessId },
      data: { ratingAvg: agg._avg.rating ?? 0, reviewCount: agg._count },
    });

    return review;
  }

  async getBusinessReviews(businessId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { businessId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, avatarUrl: true } },
        },
      }),
      this.prisma.review.count({ where: { businessId } }),
    ]);
    return {
      data: reviews,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getMyReviews(customerId: string) {
    return this.prisma.review.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        business: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
      },
    });
  }

  async canReview(customerId: string, businessId: string) {
    const eligible = await this.prisma.lead.findFirst({
      where: {
        customerId,
        businessId,
        status: { in: ['ACCEPTED', 'COMPLETED'] },
      },
    });
    const alreadyReviewed = await this.prisma.review.findFirst({
      where: { customerId, businessId },
    });
    return {
      canReview: !!eligible && !alreadyReviewed,
      reason: !eligible
        ? 'no_completed_job'
        : alreadyReviewed
        ? 'already_reviewed'
        : null,
    };
  }

  async replyToReview(reviewId: string, userId: string, reply: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { business: true },
    });
    if (!review) throw new ForbiddenException();
    if (review.business.userId !== userId) {
      throw new ForbiddenException('Only the business owner can reply');
    }
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { reply, repliedAt: new Date() },
    });
  }
}