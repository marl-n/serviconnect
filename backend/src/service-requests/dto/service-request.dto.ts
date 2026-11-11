import { IsArray, ArrayMaxSize, Matches, IsString, IsNotEmpty, IsOptional, IsInt, IsPositive, IsDateString, MaxLength, IsObject, IsIn } from 'class-validator';
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

  // Structured job location (see LocationsModule). The town is required so
  // every request can be matched to businesses' service areas; the suburb is
  // always optional, descriptive only, and must belong to the town.
  @ApiProperty({ description: 'Town/city where the job is located' })
  @IsString()
  @IsNotEmpty()
  townId: string;

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

  @ApiPropertyOptional({ type: [String], description: 'Photo URLs returned by POST /uploads/images (max 5)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @Matches(/^\/uploads\/[A-Za-z0-9._-]+$/, { each: true, message: 'photos must be URLs returned by /uploads/images' })
  photos?: string[];

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
