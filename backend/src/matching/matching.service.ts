import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/** Credits a business pays to unlock one marketplace lead (env LEAD_UNLOCK_CREDITS). */
export const leadUnlockCredits = () => {
  const n = Number(process.env.LEAD_UNLOCK_CREDITS);
  return Number.isInteger(n) && n > 0 ? n : 10;
};
/** How long an unmatched/unpurchased opportunity stays in business feeds. */
export const LEAD_TTL_DAYS = 14;
/** Business statuses that may receive leads. SUSPENDED never does. */
const ELIGIBLE_BUSINESS_STATUSES = ['ACTIVE', 'PENDING', 'UNVERIFIED'] as const;

/**
 * Matches marketplace service requests to businesses and creates one locked
 * Lead per eligible business. A business is eligible for a request when ALL hold:
 *   - its category is the request's category,
 *   - it offers the request's sub-category (BusinessSubCategory),
 *   - it serves the request's town (BusinessServiceArea) — suburbs never restrict,
 *   - it is not suspended, and it is not owned by the requesting customer.
 * Lead creation relies on the @@unique([serviceRequestId, businessId]) constraint
 * with skipDuplicates, so matching is idempotent and safe to re-run.
 */
@Injectable()
export class MatchingService {
  private readonly log = new Logger(MatchingService.name);
  constructor(private prisma: PrismaService) {}

  /** Run after a request is created. Returns the number of new leads. */
  async matchRequest(serviceRequestId: string): Promise<number> {
    const req = await this.prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } });
    if (!req || !req.townId || !['OPEN', 'MATCHED'].includes(req.status)) return 0;

    const businesses = await this.prisma.business.findMany({
      where: {
        categoryId: req.categoryId,
        status: { in: [...ELIGIBLE_BUSINESS_STATUSES] },
        userId: { not: req.customerId },
        subCategories: { some: { subCategoryId: req.subCategoryId } },
        serviceAreas: { some: { townId: req.townId } },
      },
      select: { id: true },
    });
    return this.createLeads(req, businesses.map(b => b.id));
  }

  /**
   * Run after a business changes its sub-categories or service areas, so it
   * also receives recent open requests it now qualifies for.
   */
  async matchBusiness(businessId: string): Promise<number> {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { subCategories: { select: { subCategoryId: true } }, serviceAreas: { select: { townId: true } } },
    });
    if (!biz || !(ELIGIBLE_BUSINESS_STATUSES as readonly string[]).includes(biz.status)) return 0;
    if (biz.subCategories.length === 0 || biz.serviceAreas.length === 0) return 0;

    const since = new Date(Date.now() - LEAD_TTL_DAYS * 86_400_000);
    const requests = await this.prisma.serviceRequest.findMany({
      where: {
        status: { in: ['OPEN', 'MATCHED'] },
        createdAt: { gte: since },
        categoryId: biz.categoryId,
        customerId: { not: biz.userId },
        subCategoryId: { in: biz.subCategories.map(s => s.subCategoryId) },
        townId: { in: biz.serviceAreas.map(a => a.townId) },
      },
    });
    let created = 0;
    for (const req of requests) created += await this.createLeads(req, [businessId]);
    return created;
  }

  private async createLeads(req: any, businessIds: string[]): Promise<number> {
    if (businessIds.length === 0) return 0;
    const expiresAt = new Date(new Date(req.createdAt).getTime() + LEAD_TTL_DAYS * 86_400_000);
    const { count } = await this.prisma.lead.createMany({
      data: businessIds.map(businessId => ({
        customerId: req.customerId,
        businessId,
        serviceRequestId: req.id,
        message: req.message,
        jobAddress: req.jobAddress,
        jobDate: req.jobDate,
        budget: req.budget,
        creditCost: leadUnlockCredits(),
        isUnlocked: false,
        expiresAt,
      })),
      skipDuplicates: true,
    });
    if (count > 0) {
      if (req.status === 'OPEN') {
        await this.prisma.serviceRequest.updateMany({ where: { id: req.id, status: 'OPEN' }, data: { status: 'MATCHED' } });
      }
      await this.prisma.business.updateMany({ where: { id: { in: businessIds } }, data: { leadCount: { increment: 1 } } });
      this.log.log(`Request ${req.id}: ${count} new lead(s)`);
    }
    return count;
  }
}
