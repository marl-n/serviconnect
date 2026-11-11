import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, Roles } from '../common/decorators/index';
import { SendQuoteDto, UpdateLeadStatusDto } from './leads.dto';

@ApiTags('Leads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Customer sends a quote request to a business' })
  createLead(@CurrentUser() user: any, @Body() dto: any) {
    return this.leads.createLead(user.sub, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Customer sees responses: direct leads and marketplace leads businesses have unlocked' })
  getMyLeads(@CurrentUser() user: any) {
    return this.leads.getCustomerLeads(user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Get('feed')
  @ApiOperation({ summary: "Signed-in business's lead feed (locked leads hide customer contact details)" })
  getFeed(@CurrentUser() user: any, @Query('status') status?: string) {
    return this.leads.getFeed(user.sub, status);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Get('business/:businessId')
  @ApiOperation({ summary: 'Business lead inbox (owner only; same as /leads/feed)' })
  getBusinessLeads(@Param('businessId') id: string, @CurrentUser() user: any, @Query('status') status?: string) {
    return this.leads.getBusinessLeads(id, user.sub, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single lead (its business or its customer only)' })
  getLead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leads.getLeadById(id, user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Post(':id/unlock')
  @ApiOperation({ summary: 'Spend credits to unlock a marketplace lead (max 3 businesses per request; idempotent)' })
  unlock(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leads.unlock(id, user.sub);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update lead status' })
  updateStatus(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateLeadStatusDto) {
    return this.leads.updateStatus(id, user.sub, user.role, dto.status);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Post(':id/quote')
  @ApiOperation({ summary: 'Business sends a quote on an unlocked lead' })
  sendQuote(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: SendQuoteDto) {
    return this.leads.sendQuote(id, user.sub, dto);
  }

  @Post('quotes/:quoteId/accept')
  @ApiOperation({ summary: 'Customer accepts a quote (hires the business)' })
  acceptQuote(@Param('quoteId') quoteId: string, @CurrentUser() user: any) {
    return this.leads.acceptQuote(quoteId, user.sub);
  }
}
