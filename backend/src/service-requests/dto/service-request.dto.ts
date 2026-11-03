import { IsString, IsOptional, IsInt, IsPositive, IsDateString, MaxLength, IsObject, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceRequestDto {
  @ApiProperty()
  @IsString()
  categoryId: string;

  // Required per approved design — every marketplace ServiceRequest must
  // carry both category and subcategory for matching quality.
  @ApiProperty()
  @IsString()
  subCategoryId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  message: string;

  // Structured job location (see LocationsModule). Optional for now so the
  // existing mobile client keeps working; suburb is always optional and
  // requires a town.
  @ApiPropertyOptional({ description: 'Town/city where the job is located' })
  @IsOptional()
  @IsString()
  townId?: string;

  @ApiPropertyOptional({ description: 'Suburb within the town (optional)' })
  @IsOptional()
  @IsString()
  suburbId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  jobAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  jobDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  budget?: number;

  @ApiPropertyOptional({ description: 'Category-specific answers keyed by CategoryQuestion.key' })
  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
}

const REQUEST_STATUSES = ['OPEN', 'MATCHED', 'EXPIRED', 'CANCELLED', 'FULFILLED'] as const;

export class UpdateServiceRequestStatusDto {
  @ApiProperty({ enum: REQUEST_STATUSES })
  @IsIn(REQUEST_STATUSES)
  status: (typeof REQUEST_STATUSES)[number];
}
