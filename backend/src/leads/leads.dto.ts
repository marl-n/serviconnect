import { IsInt, IsPositive, IsString, IsNotEmpty, MaxLength, IsDateString, IsOptional, IsIn, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendQuoteDto {
  @ApiProperty({ description: 'Quoted price in ZAR cents' })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @ApiProperty()
  @IsDateString()
  validUntil: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  lineItems?: unknown[];
}

const LEAD_STATUSES = ['NEW', 'VIEWED', 'QUOTED', 'ACCEPTED', 'REJECTED', 'COMPLETED'] as const;

export class UpdateLeadStatusDto {
  @ApiProperty({ enum: LEAD_STATUSES })
  @IsIn(LEAD_STATUSES)
  status: (typeof LEAD_STATUSES)[number];
}
