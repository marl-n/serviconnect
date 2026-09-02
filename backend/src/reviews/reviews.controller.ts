import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, Public } from '../common/decorators/index';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Public()
  @Get('business/:businessId')
  @ApiOperation({ summary: 'Get reviews for a business' })
  getReviews(
    @Param('businessId') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviews.getBusinessReviews(id, Number(page ?? 1), Number(limit ?? 10));
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my submitted reviews' })
  getMyReviews(@CurrentUser() user: any) {
    return this.reviews.getMyReviews(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('can-review/:businessId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if current user can review a business' })
  canReview(@Param('businessId') businessId: string, @CurrentUser() user: any) {
    return this.reviews.canReview(user.sub, businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a review for a business' })
  createReview(@CurrentUser() user: any, @Body() dto: any) {
    return this.reviews.createReview(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/reply')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Business owner replies to a review' })
  reply(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('reply') reply: string,
  ) {
    return this.reviews.replyToReview(id, user.sub, reply);
  }
}