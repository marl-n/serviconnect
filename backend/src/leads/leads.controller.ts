import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/index';

@ApiTags('Leads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Customer sends a quote request to a business' })
  createLead(@CurrentUser() user: any, @Body() dto: any) { return this.leads.createLead(user.sub, dto); }

  @Get('business/:businessId')
  @ApiOperation({ summary: 'Business gets their lead inbox' })
  getBusinessLeads(@Param('businessId') id: string, @Query('status') status?: string) {
    return this.leads.getBusinessLeads(id, status);
  }

  @Get('my')
  @ApiOperation({ summary: 'Customer sees their sent quote requests' })
  getMyLeads(@CurrentUser() user: any) { return this.leads.getCustomerLeads(user.sub); }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update lead status' })
  updateStatus(@Param('id') id: string, @CurrentUser() user: any, @Body('status') status: string) {
    return this.leads.updateStatus(id, user.sub, user.role, status);
  }

  @Post(':id/quote')
  @ApiOperation({ summary: 'Business sends a quote on a lead' })
  sendQuote(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.leads.sendQuote(id, user.sub, dto);
  }

  @Post('quotes/:quoteId/accept')
  @ApiOperation({ summary: 'Customer accepts a quote' })
  acceptQuote(@Param('quoteId') quoteId: string, @CurrentUser() user: any) {
    return this.leads.acceptQuote(quoteId, user.sub);
  }
}
