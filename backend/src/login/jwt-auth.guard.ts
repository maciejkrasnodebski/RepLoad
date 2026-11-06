import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export type JwtPayload = { sub: string; username: string };

export type AuthRequest = Request & {
  cookies?: Record<string, string>;
  user?: JwtPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const requestCookies = (
      req as unknown as { cookies?: Record<string, unknown> }
    ).cookies;
    const token =
      typeof requestCookies?.token === 'string'
        ? requestCookies.token
        : undefined;

    if (!token) throw new UnauthorizedException();

    let payload: JwtPayload;
    try {
      const verify = this.jwt.verifyAsync.bind(this.jwt) as (
        token: string,
      ) => Promise<unknown>;
      const verified = await verify(token);
      if (
        !this.isRecord(verified) ||
        typeof verified.sub !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          verified.sub,
        ) ||
        typeof verified.username !== 'string'
      ) {
        throw new UnauthorizedException();
      }
      payload = { sub: verified.sub, username: verified.username };
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true },
    });
    if (!user) {
      throw new UnauthorizedException('Sesja wygasła. Zaloguj się ponownie.');
    }

    req.user = { sub: user.id, username: user.username };
    return true;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
