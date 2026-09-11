import { IsString, IsInt, IsPositive, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GrantCreditsDto {
  @ApiProperty()
  @IsString()
  businessId: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class RefundLeadCreditsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class TransactionHistoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  limit?: number;
}
