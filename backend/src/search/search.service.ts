import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface SearchParams {
  q?: string;
  categorySlug?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  sortBy?: 'relevance' | 'rating' | 'distance' | 'newest';
  page?: number;
  limit?: number;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(params: SearchParams) {
    const { q, categorySlug, lat, lng, radiusKm = 25, minRating, verifiedOnly = false, sortBy = 'relevance', page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = { status: 'ACTIVE' };
    if (verifiedOnly) where.isVerified = true;
    if (minRating) where.ratingAvg = { gte: Number(minRating) };
    if (categorySlug) where.category = { slug: categorySlug };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }
    if (lat && lng) {
      const latD = radiusKm / 111;
      const lngD = radiusKm / (111 * Math.cos((Number(lat) * Math.PI) / 180));
      where.lat = { gte: Number(lat) - latD, lte: Number(lat) + latD };
      where.lng = { gte: Number(lng) - lngD, lte: Number(lng) + lngD };
    }

    const [businesses, total] = await Promise.all([
      this.prisma.business.findMany({
        where, skip, take: limit,
        include: {
          category: { select: { name: true, slug: true, icon: true } },
          services: { where: { isActive: true }, take: 3 },
          ads: { where: { status: 'ACTIVE' }, select: { boostLevel: true }, take: 1 },
          _count: { select: { reviews: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.business.count({ where }),
    ]);

    let results = businesses.map((b) => {
      const distance = lat && lng && b.lat && b.lng ? this.haversine(Number(lat), Number(lng), b.lat, b.lng) : null;
      return {
        id: b.id, name: b.name, slug: b.slug, description: b.description,
        category: b.category, suburb: b.suburb, city: b.city,
        logoUrl: b.logoUrl, photos: b.photos.slice(0, 3),
        ratingAvg: b.ratingAvg, reviewCount: b._count.reviews,
        isVerified: b.isVerified, priceMin: b.priceMin, priceMax: b.priceMax,
        services: b.services,
        distanceKm: distance != null ? Math.round(distance * 10) / 10 : null,
        isSponsored: (b.ads?.length ?? 0) > 0,
        boostLevel: b.ads?.[0]?.boostLevel ?? 0,
      };
    });

    if (sortBy === 'rating') results.sort((a, b) => b.ratingAvg - a.ratingAvg);
    else if (sortBy === 'distance') results.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    else results.sort((a, b) => {
      const sA = (a.isSponsored ? 100 : 0) + a.boostLevel * 10 + a.ratingAvg * 5;
      const sB = (b.isSponsored ? 100 : 0) + b.boostLevel * 10 + b.ratingAvg * 5;
      return sB - sA;
    });

    return { data: results, meta: { total, page, limit, totalPages: Math.ceil(total / limit), hasMore: skip + limit < total } };
  }

  async getCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { businesses: true } } },
    });
  }

  async autocomplete(q: string) {
    if (!q || q.length < 2) return { categories: [], businesses: [] };
    const [categories, businesses] = await Promise.all([
      this.prisma.category.findMany({ where: { name: { contains: q, mode: 'insensitive' }, isActive: true }, take: 4, select: { id: true, name: true, slug: true, icon: true } }),
      this.prisma.business.findMany({ where: { name: { contains: q, mode: 'insensitive' }, status: 'ACTIVE' }, take: 5, select: { id: true, name: true, slug: true, suburb: true, city: true, logoUrl: true } }),
    ]);
    return {
      categories: categories.map(c => ({ type: 'category', ...c })),
      businesses: businesses.map(b => ({ type: 'business', ...b })),
    };
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
