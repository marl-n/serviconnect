import { Controller, Post, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SavedBusinessesService } from './saved.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/index';

@ApiTags('Saved')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('saved')
export class SavedBusinessesController {
  constructor(private saved: SavedBusinessesService) {}

  @Get()
  @ApiOperation({ summary: 'Get my saved businesses' })
  getMySaved(@CurrentUser() user: any) {
    return this.saved.getMySaved(user.sub);
  }

  @Get(':businessId/check')
  @ApiOperation({ summary: 'Check if a business is saved' })
  isSaved(@Param('businessId') businessId: string, @CurrentUser() user: any) {
    return this.saved.isSaved(user.sub, businessId);
  }

  @Post(':businessId')
  @ApiOperation({ summary: 'Save a business' })
  save(@Param('businessId') businessId: string, @CurrentUser() user: any) {
    return this.saved.save(user.sub, businessId);
  }

  @Delete(':businessId')
  @ApiOperation({ summary: 'Unsave a business' })
  unsave(@Param('businessId') businessId: string, @CurrentUser() user: any) {
    return this.saved.unsave(user.sub, businessId);
  }
}