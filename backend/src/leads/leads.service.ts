import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

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

  async getBusinessLeads(businessId: string, status?: string) {
    return this.prisma.lead.findMany({
      where: { businessId, ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        quotes: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async getCustomerLeads(customerId: string) {
    return this.prisma.lead.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        quotes: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async updateStatus(leadId: string, userId: string, userRole: UserRole, status: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException();

    const business = await this.prisma.business.findFirst({
      where: { id: lead.businessId, userId },
    });
    const isBusiness = !!business;
    const isCustomer = lead.customerId === userId;
    if (!isBusiness && !isCustomer) throw new ForbiddenException();

    const update: any = { status };
    if (status === 'VIEWED' && isBusiness) update.viewedAt = new Date();
    if (status === 'COMPLETED') update.completedAt = new Date();

    return this.prisma.lead.update({ where: { id: leadId }, data: update });
  }

  async sendQuote(leadId: string, userId: string, dto: any) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException();

    const business = await this.prisma.business.findFirst({
      where: { id: lead.businessId, userId },
    });
    if (!business) throw new ForbiddenException();

    const quote = await this.prisma.quote.create({
      data: {
        leadId,
        amount: dto.amount,
        description: dto.description,
        lineItems: dto.lineItems,
        validUntil: new Date(dto.validUntil),
      },
    });
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { status: 'QUOTED', respondedAt: new Date() },
    });
    return quote;
  }

  async acceptQuote(quoteId: string, customerId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { lead: true },
    });
    if (!quote) throw new NotFoundException();
    if (quote.lead.customerId !== customerId) throw new ForbiddenException();

    await this.prisma.lead.update({
      where: { id: quote.leadId },
      data: { status: 'ACCEPTED' },
    });
    return this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
  }

  async getLeadById(leadId: string, userId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        quotes: { orderBy: { createdAt: 'desc' } },
        business: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });
    if (!lead) throw new NotFoundException();

    const customer = await this.prisma.user.findUnique({
      where: { id: lead.customerId },
      select: { id: true, name: true, phone: true },
    });

    return { ...lead, customer };
  }
}