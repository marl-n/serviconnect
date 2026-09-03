import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SavedBusinessesService {
  constructor(private prisma: PrismaService) {}

  async save(userId: string, businessId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');

    try {
      return await this.prisma.savedBusiness.create({
        data: { userId, businessId },
      });
    } catch (e: any) {
      // Unique constraint — already saved
      if (e.code === 'P2002') throw new ConflictException('Business already saved');
      throw e;
    }
  }

  async unsave(userId: string, businessId: string) {
    await this.prisma.savedBusiness.deleteMany({
      where: { userId, businessId },
    });
    return { success: true };
  }

  async getMySaved(userId: string) {
    const saved = await this.prisma.savedBusiness.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            suburb: true,
            city: true,
            ratingAvg: true,
            reviewCount: true,
            isVerified: true,
            priceMin: true,
            priceMax: true,
            phone: true,
            whatsapp: true,
            category: { select: { name: true, slug: true, icon: true } },
          },
        },
      },
    });
    return saved.map(s => ({ ...s.business, savedAt: s.createdAt }));
  }

  async isSaved(userId: string, businessId: string) {
    const record = await this.prisma.savedBusiness.findUnique({
      where: { userId_businessId: { userId, businessId } },
    });
    return { saved: !!record };
  }
}