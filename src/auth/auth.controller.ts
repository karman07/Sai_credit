import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  LoginSchema, LoginDto,
  RefreshSchema, RefreshDto,
  ForgotPasswordSchema, ForgotPasswordDto,
  ResetPasswordSchema, ResetPasswordDto,
  ChangePasswordSchema, ChangePasswordDto,
} from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginSchema))
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, clientIp(req), req.headers['user-agent']);
  }

  @Public()
  @Post('refresh')
  @UsePipes(new ZodValidationPipe(RefreshSchema))
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, clientIp(req), req.headers['user-agent']);
  }

  @Post('logout')
  logout(@Body() body: { refreshToken?: string }, @CurrentUser() user: AuthUser) {
    return this.auth.logout(body?.refreshToken ?? '', user);
  }

  @Public()
  @Post('forgot-password')
  @UsePipes(new ZodValidationPipe(ForgotPasswordSchema))
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @UsePipes(new ZodValidationPipe(ResetPasswordSchema))
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Put('change-password')
  @UsePipes(new ZodValidationPipe(ChangePasswordSchema))
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthUser) {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}

function clientIp(req: Request): string | undefined {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress ?? undefined;
}
