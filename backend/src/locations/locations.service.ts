import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const TOWN_WITH_PROVINCE = {
  id: true,
  name: true,
  provinceId: true,
  province: { select: { id: true, name: true } },
};

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  // ─── Reference data ────────────────────────────────────────────────────

  getProvinces() {
    return this.prisma.province.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  getTowns(provinceId: string, q?: string, limit?: number) {
    const search = q?.trim();
    return this.prisma.town.findMany({
      where: {
        provinceId,
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { name: 'asc' },
      ...(limit ? { take: limit } : {}),
      select: { id: true, name: true, provinceId: true },
    });
  }

  /** Suburbs are optional data: a town with none simply returns an empty list. */
  getSuburbs(townId: string) {
    return this.prisma.suburb.findMany({
      where: { townId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, townId: true },
    });
  }

  // ─── Business service areas (towns a business serves) ──────────────────

  async getBusinessServiceAreas(businessId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');
    return this.readServiceAreas(businessId);
  }

  /** Replaces the full set of towns this business serves. Owner only. */
  async setBusinessServiceAreas(businessId: string, userId: string, townIds: string[]) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');
    if (business.userId !== userId) throw new ForbiddenException('You do not own this business');

    const ids = townIds ?? [];

    // 1. Reject duplicates upfront (same behaviour as sub-categories)
    if (new Set(ids).size !== ids.length) {
      const seen = new Set<string>();
      const dupes = ids.filter(id => (seen.has(id) ? true : !seen.add(id)));
      throw new BadRequestException(`Duplicate town IDs: ${[...new Set(dupes)].join(', ')}`);
    }

    // 2. Reject nonexistent towns
    if (ids.length > 0) {
      const found = await this.prisma.town.findMany({ where: { id: { in: ids } }, select: { id: true } });
      if (found.length !== ids.length) {
        const foundIds = new Set(found.map((t: { id: string }) => t.id));
        throw new BadRequestException(`Town IDs not found: ${ids.filter(id => !foundIds.has(id)).join(', ')}`);
      }
    }

    // 3. Replace atomically
    await this.prisma.$transaction([
      this.prisma.businessServiceArea.deleteMany({ where: { businessId } }),
      ...(ids.length > 0
        ? [this.prisma.businessServiceArea.createMany({
            data: ids.map(townId => ({ businessId, townId })),
            skipDuplicates: true,
          })]
        : []),
    ]);

    return this.readServiceAreas(businessId);
  }

  private async readServiceAreas(businessId: string) {
    const rows = await this.prisma.businessServiceArea.findMany({
      where: { businessId },
      include: { town: { select: TOWN_WITH_PROVINCE } },
      orderBy: { town: { name: 'asc' } },
    });
    return rows.map((r: { town: unknown }) => r.town);
  }
}
