import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateCustomerSchema, CreateCustomerDto,
  UpdateCustomerSchema, UpdateCustomerDto,
  ListCustomersQuerySchema, ListCustomersQuery,
  AssignSchema, AssignDto,
} from './customers.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('customers.read')
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListCustomersQuerySchema)) q: ListCustomersQuery,
  ) {
    return this.customers.list(user, q);
  }

  @Get(':id')
  @RequirePermissions('customers.read')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.findById(user, id);
  }

  @Post()
  @RequirePermissions('customers.create')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateCustomerSchema)) dto: CreateCustomerDto,
  ) {
    return this.customers.create(user, dto);
  }

  @Put(':id')
  @RequirePermissions('customers.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCustomerSchema)) dto: UpdateCustomerDto,
  ) {
    return this.customers.update(user, id, dto);
  }

  @Put(':id/assign')
  @RequirePermissions('customers.assign')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignSchema)) dto: AssignDto,
  ) {
    return this.customers.assign(user, id, dto.assignedTo);
  }

  @Delete(':id')
  @RequirePermissions('customers.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.softDelete(user, id);
  }
}
