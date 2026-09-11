import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceRequestsService } from './service-requests.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/index';
import { CreateServiceRequestDto, UpdateServiceRequestStatusDto } from './dto/service-request.dto';

@ApiTags('Service Requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private serviceRequests: ServiceRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Customer submits a marketplace service request' })
  create(@CurrentUser() user: any, @Body() dto: CreateServiceRequestDto) {
    return this.serviceRequests.create(user.sub, dto);
  }

  @Get('my')
  @ApiOperation({ summary: "Customer's own service requests" })
  getMine(@CurrentUser() user: any) {
    return this.serviceRequests.getMine(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single service request (owning customer only)' })
  getById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.serviceRequests.getById(id, user.sub);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update status (customer may only cancel)' })
  updateStatus(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateServiceRequestStatusDto) {
    return this.serviceRequests.updateStatus(id, user.sub, dto);
  }
}
