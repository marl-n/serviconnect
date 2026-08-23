import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { Public } from '../common/decorators/index';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private search: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search businesses by service + location' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'categorySlug', required: false })
  @ApiQuery({ name: 'lat', required: false })
  @ApiQuery({ name: 'lng', required: false })
  @ApiQuery({ name: 'radiusKm', required: false })
  @ApiQuery({ name: 'minRating', required: false })
  @ApiQuery({ name: 'verifiedOnly', required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['relevance','rating','distance','newest'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  searchBusinesses(@Query() query: any) {
    return this.search.search({
      q: query.q,
      categorySlug: query.categorySlug,
      lat: query.lat ? Number(query.lat) : undefined,
      lng: query.lng ? Number(query.lng) : undefined,
      radiusKm: query.radiusKm ? Number(query.radiusKm) : 25,
      minRating: query.minRating ? Number(query.minRating) : undefined,
      verifiedOnly: query.verifiedOnly === 'true',
      sortBy: query.sortBy ?? 'relevance',
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Math.min(Number(query.limit), 50) : 20,
    });
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Get all service categories' })
  getCategories() { return this.search.getCategories(); }

  @Public()
  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete suggestions for search bar' })
  autocomplete(@Query('q') q: string) { return this.search.autocomplete(q); }
}
