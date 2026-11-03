import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, MaxLength, IsArray, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const MAX_SERVICE_AREAS = 200;

export class TownsQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  provinceId: string;

  @ApiPropertyOptional({ description: 'Case-insensitive "contains" filter on the town name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Maximum number of towns to return' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}

export class SuburbsQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  townId: string;
}

export class SetServiceAreasDto {
  @ApiProperty({ type: [String], description: 'Town IDs this business serves (replaces the existing set)' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(MAX_SERVICE_AREAS)
  townIds: string[];
}
