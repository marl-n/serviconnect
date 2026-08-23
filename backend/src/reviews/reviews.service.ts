import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(customerId: string, dto: any) {
    const review = await this.prisma.review.create({
      data: { customerId, businessId: dto.businessId, rating: dto.rating, comment: dto.comment, leadId: dto.leadId },
    });
    // Recalculate business rating average
    const agg = await this.prisma.review.aggregate({ where: { businessId: dto.businessId }, _avg: { rating: true }, _count: true });
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
        where: { businessId }, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true, avatarUrl: true } } },
      }),
      this.prisma.review.count({ where: { businessId } }),
    ]);
    return { data: reviews, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async replyToReview(reviewId: string, userId: string, reply: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId }, include: { business: true } });
    if (!review) throw new ForbiddenException();
    if (review.business.userId !== userId) throw new ForbiddenException('Only the business owner can reply');
    return this.prisma.review.update({ where: { id: reviewId }, data: { reply, repliedAt: new Date() } });
  }
}
