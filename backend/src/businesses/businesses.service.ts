import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  SetSubCategoriesDto,
  AddGalleryImageDto,
  UpdateGalleryImageDto,
  ReorderGalleryDto,
} from './businesses.dto';

const GALLERY_MAX = 12;

const PUBLIC_INCLUDE = {
  category: { select: { id: true, name: true, slug: true, icon: true } },
  subCategories: {
    include: {
      subCategory: { select: { id: true, name: true, slug: true } },
    },
  },
  gallery: { orderBy: { sortOrder: 'asc' as const } },
  services: { where: { isActive: true } },
  reviews: {
    orderBy: { createdAt: 'desc' as const },
    take: 10,
    include: { customer: { select: { name: true, avatarUrl: true } } },
  },
  _count: { select: { reviews: true, leads: true } },
};

@Injectable()
export class BusinessesService {
  constructor(private prisma: PrismaService) {}

  // ─── Public ────────────────────────────────────────────────────────────────

  async getBySlug(slug: string) {
    const biz = await this.prisma.business.findUnique({
      where: { slug },
      include: PUBLIC_INCLUDE,
    });
    if (!biz || biz.status !== 'ACTIVE') throw new NotFoundException('Business not found');
    this.prisma.business
      .update({ where: { id: biz.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
    return biz;
  }

  /**
   * Public gallery — only visible for ACTIVE businesses.
   * Inactive/pending business galleries are not exposed.
   */
  async getPublicGallery(businessId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { status: true },
    });
    if (!biz || biz.status !== 'ACTIVE') throw new NotFoundException('Business not found');
    return this.prisma.businessGallery.findMany({
      where: { businessId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getSubCategoriesForCategory(categoryId: string) {
    return this.prisma.subCategory.findMany({
      where: { categoryId },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Owner — profile ───────────────────────────────────────────────────────

  async getMyBusiness(userId: string) {
    return this.prisma.business.findUnique({
      where: { userId },
      include: {
        services: true,
        subscription: true,
        ads: { where: { status: 'ACTIVE' } },
        subCategories: {
          include: { subCategory: { select: { id: true, name: true, slug: true } } },
        },
        gallery: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  /**
   * Dashboard stats — only called after confirming the business exists.
   * Caller must resolve the business first.
   */
  async getDashboardStats(businessId: string) {
    const [leadCount, bizData, recentLeads] = await Promise.all([
      this.prisma.lead.count({ where: { businessId } }),
      this.prisma.business.findUnique({
        where: { id: businessId },
        select: { viewCount: true, ratingAvg: true, reviewCount: true },
      }),
      this.prisma.lead.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    return { leadCount, ...bizData, recentLeads };
  }

  async create(userId: string, dto: CreateBusinessDto) {
    const existing = await this.prisma.business.findUnique({ where: { userId } });
    if (existing) return existing;
    const slug = this.toSlug(dto.name) + '-' + Date.now().toString(36);
    return this.prisma.business.create({
      data: {
        userId,
        slug,
        name: dto.name,
        categoryId: dto.categoryId,
        description: dto.description,
        phone: dto.phone,
        whatsapp: dto.whatsapp ?? dto.phone,
        email: dto.email,
        website: dto.website,
        address: dto.address,
        suburb: dto.suburb,
        city: dto.city ?? 'Johannesburg',
        province: dto.province ?? 'Gauteng',
        logoUrl: dto.logoUrl,
        priceMin: dto.priceMin,
        priceMax: dto.priceMax,
        yearsInBusiness: dto.yearsInBusiness,
      },
    });
  }

  async update(businessId: string, userId: string, dto: UpdateBusinessDto) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!biz) throw new NotFoundException();
    if (biz.userId !== userId) throw new ForbiddenException();
    return this.prisma.business.update({
      where: { id: businessId },
      data: {
        name: dto.name,
        description: dto.description,
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        email: dto.email,
        website: dto.website,
        address: dto.address,
        suburb: dto.suburb,
        city: dto.city,
        province: dto.province,
        logoUrl: dto.logoUrl,
        priceMin: dto.priceMin,
        priceMax: dto.priceMax,
        yearsInBusiness: dto.yearsInBusiness,
        operatingHours: dto.operatingHours,
      },
    });
  }

  async submitVerification(businessId: string, userId: string, docs: any) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!biz || biz.userId !== userId) throw new ForbiddenException();
    return this.prisma.businessVerification.upsert({
      where: { businessId },
      create: { businessId, idDocUrl: docs.idDocUrl, bizDocUrl: docs.bizDocUrl, selfieUrl: docs.selfieUrl },
      update: { idDocUrl: docs.idDocUrl, bizDocUrl: docs.bizDocUrl, selfieUrl: docs.selfieUrl, status: 'PENDING' },
    });
  }

  // ─── Sub-categories ────────────────────────────────────────────────────────

  async setSubCategories(businessId: string, userId: string, dto: SetSubCategoriesDto) {
    const biz = await this.assertOwner(businessId, userId);
    const ids = dto.subCategoryIds ?? [];

    // 1. Reject duplicates upfront — before any DB lookup
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      const seen = new Set<string>();
      const dupes = ids.filter(id => seen.has(id) ? true : !seen.add(id));
      throw new BadRequestException(`Duplicate sub-category IDs: ${[...new Set(dupes)].join(', ')}`);
    }

    if (ids.length > 0) {
      // 2. Reject nonexistent IDs
      const found = await this.prisma.subCategory.findMany({
        where: { id: { in: ids } },
      });
      if (found.length !== ids.length) {
        const foundIds = new Set(found.map(s => s.id));
        const missing = ids.filter(id => !foundIds.has(id));
        throw new BadRequestException(`Sub-category IDs not found: ${missing.join(', ')}`);
      }

      // 3. Reject IDs from a different category
      const wrong = found.filter(sc => sc.categoryId !== biz.categoryId);
      if (wrong.length > 0) {
        throw new BadRequestException(
          `Sub-categories do not belong to this business's category: ${wrong.map(s => s.name).join(', ')}`
        );
      }
    }

    // 4. Replace atomically
    await this.prisma.$transaction([
      this.prisma.businessSubCategory.deleteMany({ where: { businessId } }),
      ...(ids.length > 0
        ? [this.prisma.businessSubCategory.createMany({
            data: ids.map(subCategoryId => ({ businessId, subCategoryId })),
            skipDuplicates: true,
          })]
        : []),
    ]);

    return this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        subCategories: {
          include: { subCategory: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
  }

  // ─── Gallery ───────────────────────────────────────────────────────────────

  /** Owner-only gallery — full data including pending/inactive businesses */
  async getOwnerGallery(businessId: string, userId: string) {
    await this.assertOwner(businessId, userId);
    return this.prisma.businessGallery.findMany({
      where: { businessId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Concurrency-safe gallery add.
   * Uses SERIALIZABLE isolation so two concurrent requests cannot both
   * read count < 12 and both succeed — one will retry or fail.
   */
  async addGalleryImage(businessId: string, userId: string, dto: AddGalleryImageDto) {
    await this.assertOwner(businessId, userId);

    return this.prisma.$transaction(
      async (tx) => {
        // Lock the count read inside a serializable transaction
        const count = await tx.businessGallery.count({ where: { businessId } });
        if (count >= GALLERY_MAX) {
          throw new BadRequestException(`Gallery limit of ${GALLERY_MAX} images reached.`);
        }
        const maxOrder = await tx.businessGallery.aggregate({
          where: { businessId },
          _max: { sortOrder: true },
        });
        return tx.businessGallery.create({
          data: {
            businessId,
            imageUrl: dto.imageUrl,
            caption: dto.caption,
            sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async updateGalleryImage(
    galleryId: string,
    businessId: string,
    userId: string,
    dto: UpdateGalleryImageDto,
  ) {
    await this.assertOwner(businessId, userId);
    const item = await this.prisma.businessGallery.findUnique({ where: { id: galleryId } });
    if (!item || item.businessId !== businessId) throw new NotFoundException('Gallery image not found');
    return this.prisma.businessGallery.update({
      where: { id: galleryId },
      data: { imageUrl: dto.imageUrl, caption: dto.caption },
    });
  }

  async deleteGalleryImage(galleryId: string, businessId: string, userId: string) {
    await this.assertOwner(businessId, userId);
    const item = await this.prisma.businessGallery.findUnique({ where: { id: galleryId } });
    if (!item || item.businessId !== businessId) throw new NotFoundException('Gallery image not found');
    await this.prisma.businessGallery.delete({ where: { id: galleryId } });
    return { success: true };
  }

  /**
   * Reorder gallery images.
   *
   * Requires EXACTLY the full current set of gallery IDs for this business —
   * no more, no fewer. Rejects:
   *   - duplicate IDs in the request
   *   - IDs belonging to a different business
   *   - missing IDs (some of this business's images not included)
   *   - extra IDs not in the gallery at all
   */
  async reorderGallery(businessId: string, userId: string, dto: ReorderGalleryDto) {
    await this.assertOwner(businessId, userId);
    const ids = dto.orderedIds;

    // 1. Reject duplicates
    if (new Set(ids).size !== ids.length) {
      const seen = new Set<string>();
      const dupes = ids.filter(id => seen.has(id) ? true : !seen.add(id));
      throw new BadRequestException(`Duplicate IDs in orderedIds: ${[...new Set(dupes)].join(', ')}`);
    }

    // 2. Load all current gallery items for this business
    const currentItems = await this.prisma.businessGallery.findMany({
      where: { businessId },
      select: { id: true },
    });
    const currentIds = new Set(currentItems.map(i => i.id));

    // 3. Reject foreign IDs
    const foreign = ids.filter(id => !currentIds.has(id));
    if (foreign.length > 0) {
      throw new BadRequestException(`Gallery IDs not found on this business: ${foreign.join(', ')}`);
    }

    // 4. Reject missing IDs — must provide the full set
    const missing = [...currentIds].filter(id => !ids.includes(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `orderedIds must include ALL gallery images. Missing: ${missing.join(', ')}`
      );
    }

    // 5. Apply reorder transactionally
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.businessGallery.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    return this.prisma.businessGallery.findMany({
      where: { businessId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async assertOwner(businessId: string, userId: string) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!biz) throw new NotFoundException('Business not found');
    if (biz.userId !== userId) throw new ForbiddenException('You do not own this business');
    return biz;
  }

  private toSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}
