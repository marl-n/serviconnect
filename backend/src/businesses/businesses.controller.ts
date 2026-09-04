import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { BusinessesService } from './businesses.service';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  SetSubCategoriesDto,
  AddGalleryImageDto,
  UpdateGalleryImageDto,
  ReorderGalleryDto,
} from './businesses.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, Public, Roles } from '../common/decorators/index';

@ApiTags('Businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private biz: BusinessesService) {}

  // ─── Public ─────────────────────────────────────────────────────────────────

  @Public()
  @Get('category/:categoryId/subcategories')
  @ApiOperation({ summary: 'Get sub-categories for a category' })
  getSubCategories(@Param('categoryId') categoryId: string) {
    return this.biz.getSubCategoriesForCategory(categoryId);
  }

  /**
   * Public gallery — only for ACTIVE businesses.
   * Pending/suspended business galleries are hidden.
   */
  @Public()
  @Get(':id/gallery/public')
  @ApiOperation({ summary: 'Get public gallery for an active business' })
  getPublicGallery(@Param('id') id: string) {
    return this.biz.getPublicGallery(id);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get public business profile by slug' })
  getBySlug(@Param('slug') slug: string) {
    return this.biz.getBySlug(slug);
  }

  // ─── Owner — profile ─────────────────────────────────────────────────────────

  /**
   * BUSINESS role required. Customers have no business profile.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Get('me/profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my business profile (BUSINESS role only)' })
  getMyBusiness(@CurrentUser() user: any) {
    return this.biz.getMyBusiness(user.sub);
  }

  /**
   * BUSINESS role required. Returns 404 if the business hasn't been created yet,
   * rather than crashing on biz!.id.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Get('me/dashboard')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get business dashboard stats (BUSINESS role only)' })
  async getDashboard(@CurrentUser() user: any) {
    const biz = await this.biz.getMyBusiness(user.sub);
    if (!biz) throw new NotFoundException('No business profile found. Please create one first.');
    return this.biz.getDashboardStats(biz.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a business profile (BUSINESS role only)' })
  create(@CurrentUser() user: any, @Body() dto: CreateBusinessDto) {
    return this.biz.create(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update business profile (owner only)' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.biz.update(id, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Post(':id/verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit verification documents (owner only)' })
  verify(@Param('id') id: string, @CurrentUser() user: any, @Body() docs: any) {
    return this.biz.submitVerification(id, user.sub, docs);
  }

  // ─── Sub-categories ──────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Post(':id/subcategories')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set sub-categories for a business (replaces existing)' })
  setSubCategories(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: SetSubCategoriesDto,
  ) {
    return this.biz.setSubCategories(id, user.sub, dto);
  }

  // ─── Gallery — owner ─────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Get(':id/gallery')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get full gallery (owner only — all statuses)' })
  getOwnerGallery(@Param('id') id: string, @CurrentUser() user: any) {
    return this.biz.getOwnerGallery(id, user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Post(':id/gallery')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add image to gallery (max 12, serializable)' })
  addGalleryImage(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: AddGalleryImageDto,
  ) {
    return this.biz.addGalleryImage(id, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Patch(':id/gallery/:galleryId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a gallery image or caption (owner only)' })
  updateGalleryImage(
    @Param('id') id: string,
    @Param('galleryId') galleryId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateGalleryImageDto,
  ) {
    return this.biz.updateGalleryImage(galleryId, id, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Delete(':id/gallery/:galleryId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a gallery image (owner only)' })
  deleteGalleryImage(
    @Param('id') id: string,
    @Param('galleryId') galleryId: string,
    @CurrentUser() user: any,
  ) {
    return this.biz.deleteGalleryImage(galleryId, id, user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @Post(':id/gallery/reorder')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder gallery — must supply ALL current gallery IDs' })
  reorderGallery(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: ReorderGalleryDto,
  ) {
    return this.biz.reorderGallery(id, user.sub, dto);
  }
}
