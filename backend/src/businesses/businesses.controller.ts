import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, Public } from '../common/decorators/index';

@ApiTags('Businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private biz: BusinessesService) {}

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get public business profile by slug' })
  getBySlug(@Param('slug') slug: string) { return this.biz.getBySlug(slug); }

  @UseGuards(JwtAuthGuard)
  @Get('me/profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my own business' })
  getMyBusiness(@CurrentUser() user: any) { return this.biz.getMyBusiness(user.sub); }

  @UseGuards(JwtAuthGuard)
  @Get('me/dashboard')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get business dashboard stats' })
  async getDashboard(@CurrentUser() user: any) {
    const biz = await this.biz.getMyBusiness(user.sub);
    return this.biz.getDashboardStats(biz!.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new business profile' })
  create(@CurrentUser() user: any, @Body() dto: any) { return this.biz.create(user.sub, dto); }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update business profile' })
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.biz.update(id, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit verification documents' })
  verify(@Param('id') id: string, @CurrentUser() user: any, @Body() docs: any) {
    return this.biz.submitVerification(id, user.sub, docs);
  }
}
