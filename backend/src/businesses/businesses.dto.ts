import {
  IsString,
  IsOptional,
  IsUrl,
  IsInt,
  IsArray,
  IsPositive,
  MaxLength,
  Min,
  Max,
  ArrayMaxSize,
  IsJSON,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Create ──────────────────────────────────────────────────────────────────

export class CreateBusinessDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({}, { message: 'website must be a valid URL' })
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  suburb?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({}, { message: 'logoUrl must be a valid URL' })
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  priceMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  priceMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  @Type(() => Number)
  yearsInBusiness?: number;
}

// ─── Update ───────────────────────────────────────────────────────────────────
// All fields optional. Excludes: userId, slug, status, isVerified, ratings, counters.

export class UpdateBusinessDto {
  @IsOptional() @IsString() @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(20)
  whatsapp?: string;

  @IsOptional() @IsString() @MaxLength(100)
  email?: string;

  @IsOptional()
  @ValidateIf(o => o.website !== null && o.website !== '')
  @IsUrl({}, { message: 'website must be a valid URL' })
  @MaxLength(200)
  website?: string;

  @IsOptional() @IsString() @MaxLength(200)
  address?: string;

  @IsOptional() @IsString() @MaxLength(100)
  suburb?: string;

  @IsOptional() @IsString() @MaxLength(100)
  city?: string;

  @IsOptional() @IsString() @MaxLength(100)
  province?: string;

  @IsOptional()
  @ValidateIf(o => o.logoUrl !== null && o.logoUrl !== '')
  @IsUrl({}, { message: 'logoUrl must be a valid URL' })
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional() @IsInt() @IsPositive() @Type(() => Number)
  priceMin?: number;

  @IsOptional() @IsInt() @IsPositive() @Type(() => Number)
  priceMax?: number;

  @IsOptional() @IsInt() @Min(0) @Max(200) @Type(() => Number)
  yearsInBusiness?: number;

  @IsOptional()
  operatingHours?: Record<string, string>;
}

// ─── Sub-categories ───────────────────────────────────────────────────────────

export class SetSubCategoriesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  subCategoryIds: string[];
}

// ─── Gallery ──────────────────────────────────────────────────────────────────

export class AddGalleryImageDto {
  @ApiProperty()
  @IsUrl({}, { message: 'imageUrl must be a valid URL' })
  @MaxLength(500)
  imageUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}

export class UpdateGalleryImageDto {
  @IsOptional()
  @ValidateIf(o => o.imageUrl !== undefined)
  @IsUrl({}, { message: 'imageUrl must be a valid URL' })
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}

export class ReorderGalleryDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  orderedIds: string[];
}
