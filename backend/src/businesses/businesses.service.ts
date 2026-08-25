import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class BusinessesService {
  constructor(private prisma: PrismaService) {}

  async getBySlug(slug: string) {
    const biz = await this.prisma.business.findUnique({
      where: { slug },
      include: {
        category: true,
        services: { where: { isActive: true } },
        reviews: { orderBy: { createdAt: 'desc' }, take: 10, include: { customer: { select: { name: true, avatarUrl: true } } } },
        _count: { select: { reviews: true, leads: true } },
      },
    });
    if (!biz || biz.status !== 'ACTIVE') throw new NotFoundException('Business not found');
    // Increment view count (fire-and-forget)
    this.prisma.business.update({ where: { id: biz.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
    return biz;
  }

async create(userId: string, dto: any) {
  // Check if user already has a business
  const existing = await this.prisma.business.findUnique({ where: { userId } });
  if (existing) return existing;

  const slug = this.toSlug(dto.name) + '-' + Date.now().toString(36);
  return this.prisma.business.create({
    data: { userId, slug, ...dto },
  });
}

  async update(businessId: string, userId: string, dto: any) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!biz) throw new NotFoundException();
    if (biz.userId !== userId) throw new ForbiddenException();
    return this.prisma.business.update({ where: { id: businessId }, data: dto });
  }

  async getMyBusiness(userId: string) {
    return this.prisma.business.findUnique({
      where: { userId },
      include: { services: true, subscription: true, ads: { where: { status: 'ACTIVE' } } },
    });
  }

  async getDashboardStats(businessId: string) {
    const [leadCount, viewCount, reviewStats, recentLeads] = await Promise.all([
      this.prisma.lead.count({ where: { businessId } }),
      this.prisma.business.findUnique({ where: { id: businessId }, select: { viewCount: true, ratingAvg: true, reviewCount: true } }),
      this.prisma.review.aggregate({ where: { businessId }, _avg: { rating: true }, _count: true }),
      this.prisma.lead.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' }, take: 5, include: { business: { select: { name: true, phone: true } } } }),
    ]);
    return { leadCount, ...viewCount, reviewStats, recentLeads };
  }

  async submitVerification(businessId: string, userId: string, docs: any) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!biz || biz.userId !== userId) throw new ForbiddenException();
    return this.prisma.businessVerification.upsert({
      where: { businessId },
      create: { businessId, ...docs },
      update: { ...docs, status: 'PENDING' },
    });
  }

  private toSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}
