import { IsString, IsOptional, IsBoolean, IsInt, Min, MaxLength, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const QUESTION_TYPES = ['TEXT', 'NUMBER', 'SELECT', 'MULTISELECT', 'BOOLEAN', 'DATE'] as const;

export class CreateCategoryQuestionDto {
  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiPropertyOptional({ description: 'Omit to apply this question to the whole category' })
  @IsOptional()
  @IsString()
  subCategoryId?: string;

  @ApiProperty({ description: 'JSON key this answer will be stored under in ServiceRequest.answers' })
  @IsString()
  @MaxLength(100)
  key: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  label: string;

  @ApiProperty({ enum: QUESTION_TYPES })
  @IsIn(QUESTION_TYPES)
  type: (typeof QUESTION_TYPES)[number];

  @ApiPropertyOptional({ description: 'Choices for SELECT/MULTISELECT, e.g. ["Tile", "Metal", "Thatch"]' })
  @IsOptional()
  options?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  label?: string;

  @ApiPropertyOptional({ enum: QUESTION_TYPES })
  @IsOptional()
  @IsIn(QUESTION_TYPES)
  type?: (typeof QUESTION_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  options?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
