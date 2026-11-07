import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

function createContext(cookies: Record<string, string> = {}) {
  const request: { cookies: Record<string, string>; user?: unknown } = {
    cookies,
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  it('rejects a valid token when its user no longer exists', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: '00000000-0000-4000-8000-000000000017',
        username: 'user',
      }),
    } as unknown as JwtService;
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(jwt, prisma);
    const { context } = createContext({ token: 'valid-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: '00000000-0000-4000-8000-000000000017' },
      select: { id: true, username: true, role: true },
    });
  });

  it('sets the authenticated user from the current database record', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: '00000000-0000-4000-8000-000000000017',
        username: 'old-name',
        role: 'admin',
      }),
    } as unknown as JwtService;
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000017',
          username: 'current-name',
          role: 'user',
        }),
      },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(jwt, prisma);
    const { context, request } = createContext({ token: 'valid-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      sub: '00000000-0000-4000-8000-000000000017',
      username: 'current-name',
      role: 'user',
    });
  });

  it('rejects a token with an invalid subject', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: '17', username: 'user' }),
    } as unknown as JwtService;
    const prisma = {
      user: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(jwt, prisma);
    const { context } = createContext({ token: 'invalid-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
