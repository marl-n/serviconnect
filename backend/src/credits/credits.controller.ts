import { Controller, Get, Post, Param, Body, Query, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreditsService } from './credits.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser } from '../common/decorators/index';
import { UserRole } from '@prisma/client';
import { GrantCreditsDto, RefundLeadCreditsDto, TransactionHistoryQueryDto } from './dto/credits.dto';

@ApiTags('Credits')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('credits')
export class CreditsController {
  constructor(
    private credits: CreditsService,
    private prisma: PrismaService,
  ) {}

  /** Resolves the caller's own business, or throws — never trusts a client-supplied businessId. */
  private async getOwnBusinessId(userId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({ where: { userId } });
    if (!business) throw new ForbiddenException('No business account found for this user');
    return business.id;
  }

  @Get('wallet')
  @ApiOperation({ summary: "Get the authenticated business's current credit balance" })
  async getWallet(@CurrentUser() user: any) {
    const businessId = await this.getOwnBusinessId(user.sub);
    return this.credits.getBalance(businessId);
  }

  @Get('wallet/transactions')
  @ApiOperation({ summary: "Get the authenticated business's credit transaction history" })
  async getTransactions(@CurrentUser() user: any, @Query() query: TransactionHistoryQueryDto) {
    const businessId = await this.getOwnBusinessId(user.sub);
    return this.credits.getTransactionHistory(businessId, query.page, query.limit);
  }

  // ─── Admin endpoints ───────────────────────────────────────────────────

  @Post('admin/grant')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Grant promotional/adjustment credits to a business' })
  async adminGrant(@CurrentUser() user: any, @Body() dto: GrantCreditsDto) {
    const business = await this.prisma.business.findUnique({ where: { id: dto.businessId } });
    if (!business) throw new NotFoundException('Business not found');

    return this.credits.grantCredits({
      businessId: dto.businessId,
      amount: dto.amount,
      type: 'ADMIN_ADJUSTMENT',
      reason: dto.reason,
      performedByUserId: user.sub,
    });
  }

  @Post('admin/refund-lead/:leadId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Refund the credits spent unlocking a specific lead' })
  async adminRefundLead(
    @Param('leadId') leadId: string,
    @CurrentUser() user: any,
    @Body() dto: RefundLeadCreditsDto,
  ) {
    return this.credits.refundLeadCredits({
      leadId,
      reason: dto.reason,
      performedByUserId: user.sub,
    });
  }
}
