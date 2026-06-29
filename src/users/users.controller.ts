import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateUserSchema, CreateUserDto,
  UpdateUserSchema, UpdateUserDto,
  ListUsersQuerySchema, ListUsersQuery,
} from './users.dto';

@Controller('users')
@RequirePermissions('users.manage')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(ListUsersQuerySchema)) q: ListUsersQuery) {
    return this.users.list(q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.users.findById(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.create(dto, actor);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Put(':id/toggle-status')
  toggle(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.users.toggleStatus(id, actor);
  }

  @Put(':id/set-password')
  setPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.setPassword(id, body.password, actor);
  }
}
