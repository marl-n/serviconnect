import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { CreditsService, MAX_UNLOCKS_PER_REQUEST } from '../credits/credits.service';
import { SendQuoteDto } from './leads.dto';

/** Request details a business sees on a marketplace lead. */
const REQUEST_FOR_BUSINESS = {
  select: {
    id: true, status: true, unlockCount: true, answers: true, photos: true, createdAt: true,
    category: { select: { id: true, name: true } },
    subCategory: { select: { id: true, name: true } },
    town: { select: { id: true, name: true, province: { select: { id: true, name: true } } } },
    suburb: { select: { id: true, name: true } },
  },
} as const;

const BUSINESS_FOR_CUSTOMER = {
  select: {
    id: true, name: true, slug: true, logoUrl: true, phone: true, whatsapp: true,
    suburb: true, city: true, isVerified: true, ratingAvg: true, reviewCount: true,
    category: { select: { name: true, slug: true } },
  },
} as const;

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService, private credits: CreditsService) {}

  // ─── Legacy direct quote request (customer → one business) ─────────────────

  async createLead(customerId: string, dto: any) {
    const lead = await this.prisma.lead.create({
      data: {
        customerId,
        businessId: dto.businessId,
        serviceId: dto.serviceId,
        message: dto.message,
        jobAddress: dto.jobAddress,
        jobDate: dto.jobDate ? new Date(dto.jobDate) : undefined,
        budget: dto.budget,
      },
    });
    await this.prisma.business.update({
      where: { id: dto.businessId },
      data: { leadCount: { increment: 1 } },
    });
    return lead;
  }

  // ─── Business side ──────────────────────────────────────────────────────────

  private async ownBusiness(userId: string) {
    const business = await this.prisma.business.findUnique({ where: { userId } });
    if (!business) throw new ForbiddenException('No business account found for this user');
    return business;
  }

  /**
   * What a business may see of a lead. Until a marketplace lead is unlocked,
   * the customer's identity, phone and street address stay hidden; the job
   * itself (category, town/suburb, description, answers, photos, budget) is shown
   * so the business can decide whether to spend credits.
   */
  private forBusiness(lead: any, customer?: { id: string; name: string; phone: string } | null) {
    const req = lead.serviceRequest;
    const locked = !lead.isUnlocked;
    const unlocksRemaining = req ? Math.max(0, MAX_UNLOCKS_PER_REQUEST - req.unlockCount) : null;
    const expired = !!lead.expiresAt && new Date(lead.expiresAt) < new Date();
    return {
      ...lead,
      isMarketplace: !!req,
      jobAddress: locked ? null : lead.jobAddress,
      customer: locked ? null : customer ?? null,
      unlocksRemaining,
      canUnlock: !!req && locked && !expired && unlocksRemaining! > 0 && ['OPEN', 'MATCHED'].includes(req.status),
    };
  }

  /** The signed-in business's lead feed: direct leads plus marketplace leads it may still act on. */
  async getFeed(userId: string, status?: string) {
    const business = await this.ownBusiness(userId);
    const leads = await this.prisma.lead.findMany({
      where: { businessId: business.id, ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        quotes: { orderBy: { createdAt: 'desc' }, take: 1 },
        serviceRequest: REQUEST_FOR_BUSINESS,
      },
    });
    const customers = await this.customersById(leads.filter(l => l.isUnlocked).map(l => l.customerId));
    return leads
      .map(l => this.forBusiness(l, customers.get(l.customerId)))
      // A locked lead the business can no longer unlock (3 others got it, expired, cancelled) is not an opportunity.
      .filter(l => l.isUnlocked || l.canUnlock);
  }

  /** Kept for the existing mobile client; only the owner may read its own leads. */
  async getBusinessLeads(businessId: string, userId: string, status?: string) {
    const business = await this.ownBusiness(userId);
    if (business.id !== businessId) throw new ForbiddenException('You do not own this business');
    return this.getFeed(userId, status);
  }

  async unlock(leadId: string, userId: string) {
    const business = await this.ownBusiness(userId);
    const result = await this.credits.unlockLead({ leadId, businessId: business.id });
    const balance = await this.credits.getBalance(business.id);
    return { ...result, balance: balance.balance, lead: await this.getLeadById(leadId, userId) };
  }

  async sendQuote(leadId: string, userId: string, dto: SendQuoteDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    const business = await this.prisma.business.findFirst({ where: { id: lead.businessId, userId } });
    if (!business) throw new ForbiddenException();
    if (!lead.isUnlocked) throw new ForbiddenException('Unlock this lead before sending a quote');
    if (['ACCEPTED', 'REJECTED', 'COMPLETED'].includes(lead.status)) {
      throw new BadRequestException(`This lead is ${lead.status.toLowerCase()} and can no longer be quoted`);
    }
    if (new Date(dto.validUntil) <= new Date()) throw new BadRequestException('validUntil must be in the future');
    if (lead.serviceRequestId) {
      const req = await this.prisma.serviceRequest.findUnique({ where: { id: lead.serviceRequestId }, select: { status: true } });
      if (req && !['OPEN', 'MATCHED'].includes(req.status)) {
        throw new BadRequestException('The customer has closed this request — no more quotes can be sent');
      }
    }

    const quote = await this.prisma.quote.create({
      data: {
        leadId,
        amount: dto.amount,
        description: dto.description,
        lineItems: dto.lineItems as any,
        validUntil: new Date(dto.validUntil),
      },
    });
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { status: 'QUOTED', respondedAt: new Date() },
    });
    return quote;
  }

  // ─── Customer side ──────────────────────────────────────────────────────────

  /**
   * The customer's responses: direct leads, plus marketplace leads a business
   * has unlocked (i.e. actually engaged with). Locked matches are not shown —
   * those businesses have not seen the customer's details or responded.
   */
  async getCustomerLeads(customerId: string) {
    const leads = await this.prisma.lead.findMany({
      where: { customerId, isUnlocked: true },
      orderBy: { createdAt: 'desc' },
      include: {
        quotes: { orderBy: { createdAt: 'desc' }, take: 1 },
        business: BUSINESS_FOR_CUSTOMER,
        serviceRequest: {
          select: {
            id: true, status: true,
            category: { select: { name: true } },
            subCategory: { select: { name: true } },
            town: { select: { name: true } },
            suburb: { select: { name: true } },
          },
        },
      },
    });
    return leads;
  }

  /**
   * Accepting a quote hires that business: its lead becomes ACCEPTED; for a
   * marketplace request, the request is FULFILLED and competing pending quotes
   * are declined.
   */
  async acceptQuote(quoteId: string, customerId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { lead: true },
    });
    if (!quote) throw new NotFoundException();
    if (quote.lead.customerId !== customerId) throw new ForbiddenException();
    if (quote.status !== 'PENDING') throw new BadRequestException(`This quote is ${quote.status.toLowerCase()}`);
    if (quote.validUntil < new Date()) throw new BadRequestException('This quote has expired');

    const requestId = quote.lead.serviceRequestId;
    return this.prisma.$transaction(async tx => {
      if (requestId) {
        const otherLeads = await tx.lead.findMany({ where: { serviceRequestId: requestId, id: { not: quote.leadId } }, select: { id: true } });
        const otherIds = otherLeads.map(l => l.id);
        await tx.quote.updateMany({ where: { leadId: { in: otherIds }, status: 'PENDING' }, data: { status: 'REJECTED' } });
        await tx.lead.updateMany({ where: { id: { in: otherIds }, status: 'QUOTED' }, data: { status: 'REJECTED' } });
        await tx.serviceRequest.update({ where: { id: requestId }, data: { status: 'FULFILLED' } });
      }
      await tx.lead.update({ where: { id: quote.leadId }, data: { status: 'ACCEPTED' } });
      return tx.quote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
    });
  }

  // ─── Shared ─────────────────────────────────────────────────────────────────

  private async customersById(ids: string[]) {
    const rows = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true, phone: true } })
      : [];
    return new Map(rows.map(r => [r.id, r]));
  }

  async updateStatus(leadId: string, userId: string, _userRole: UserRole, status: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException();

    const business = await this.prisma.business.findFirst({ where: { id: lead.businessId, userId } });
    const isBusiness = !!business;
    const isCustomer = lead.customerId === userId;
    if (!isBusiness && !isCustomer) throw new ForbiddenException();

    // QUOTED and ACCEPTED are set only by sending / accepting a quote.
    const allowed = isBusiness ? ['VIEWED', 'REJECTED', 'COMPLETED'] : ['REJECTED', 'COMPLETED'];
    if (!allowed.includes(status)) throw new BadRequestException(`You cannot set this lead to ${status}`);

    // Opening a lead marks it viewed only the first time; never downgrade QUOTED etc.
    if (status === 'VIEWED') {
      if (lead.status !== 'NEW') return lead;
      return this.prisma.lead.update({ where: { id: leadId }, data: { status: 'VIEWED', viewedAt: new Date() } });
    }
    const update: any = { status };
    if (status === 'COMPLETED') update.completedAt = new Date();
    return this.prisma.lead.update({ where: { id: leadId }, data: update });
  }

  /** A lead as its business (redacted until unlocked) or its customer sees it. */
  async getLeadById(leadId: string, userId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        quotes: { orderBy: { createdAt: 'desc' } },
        business: BUSINESS_FOR_CUSTOMER,
        serviceRequest: REQUEST_FOR_BUSINESS,
      },
    });
    if (!lead) throw new NotFoundException();

    if (lead.customerId === userId) return lead;

    const business = await this.prisma.business.findFirst({ where: { id: lead.businessId, userId }, select: { id: true } });
    if (!business) throw new ForbiddenException('You do not have access to this lead');

    const customers = lead.isUnlocked ? await this.customersById([lead.customerId]) : new Map();
    return this.forBusiness(lead, customers.get(lead.customerId));
  }
}
