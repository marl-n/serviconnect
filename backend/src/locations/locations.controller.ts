import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { Public } from '../common/decorators/index';
import { TownsQueryDto, SuburbsQueryDto } from './dto/locations.dto';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private locations: LocationsService) {}

  @Public()
  @Get('provinces')
  @ApiOperation({ summary: 'List provinces' })
  getProvinces() {
    return this.locations.getProvinces();
  }

  @Public()
  @Get('towns')
  @ApiOperation({ summary: 'List towns/cities in a province (optional name search)' })
  getTowns(@Query() query: TownsQueryDto) {
    return this.locations.getTowns(query.provinceId, query.q, query.limit);
  }

  @Public()
  @Get('suburbs')
  @ApiOperation({ summary: 'List suburbs of a town (may be empty — suburb data is incomplete)' })
  getSuburbs(@Query() query: SuburbsQueryDto) {
    return this.locations.getSuburbs(query.townId);
  }
}
