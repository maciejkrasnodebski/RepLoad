import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthRequest } from './jwt-auth.guard';
import { LoginService } from './login.service';
import { SESSION_DURATION_MS } from './login.constants';

const COOKIE_NAME = 'token';

@Controller('auth')
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.loginService.register(dto);
    this.setCookie(res, token);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.loginService.login(dto);
    this.setCookie(res, token);
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const requestCookies = (
      req as unknown as { cookies?: Record<string, unknown> }
    ).cookies;
    const token = requestCookies?.token;
    await this.loginService.logout(
      typeof token === 'string' ? token : undefined,
    );
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthRequest) {
    return {
      user: {
        id: req.user!.sub,
        username: req.user!.username,
        role: req.user!.role,
      },
    };
  }

  private setCookie(res: Response, token: string) {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_DURATION_MS,
      path: '/',
    });
  }
}
