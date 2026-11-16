import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
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

const USER_ID = '00000000-0000-4000-8000-000000000017';
const SESSION_ID = '00000000-0000-4000-8000-000000000018';

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
        sub: USER_ID,
        username: 'user',
        sid: SESSION_ID,
      }),
    } as unknown as JwtService;
    const findUser = jest.fn().mockResolvedValue(null);
    const prisma = {
      user: { findUnique: findUser },
      authSession: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(jwt, prisma);
    const { context } = createContext({ token: 'valid-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findUser).toHaveBeenCalledWith({
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
        sid: SESSION_ID,
      }),
    } as unknown as JwtService;
    const findUser = jest.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000017',
      username: 'current-name',
      role: 'user',
    });
    const findSession = jest.fn().mockResolvedValue({
      id: SESSION_ID,
      userId: USER_ID,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const prisma = {
      user: {
        findUnique: findUser,
      },
      authSession: {
        findUnique: findSession,
      },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(jwt, prisma);
    const { context, request } = createContext({ token: 'valid-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      sub: '00000000-0000-4000-8000-000000000017',
      username: 'current-name',
      role: 'user',
      sid: SESSION_ID,
    });
  });

  it('rejects a token with an invalid subject', async () => {
    const jwt = {
      verifyAsync: jest
        .fn()
        .mockResolvedValue({ sub: '17', username: 'user', sid: SESSION_ID }),
    } as unknown as JwtService;
    const findUser = jest.fn();
    const prisma = {
      user: { findUnique: findUser },
      authSession: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(jwt, prisma);
    const { context } = createContext({ token: 'invalid-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findUser).not.toHaveBeenCalled();
  });

  it('fails closed with a safe response when the user lookup fails', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: '00000000-0000-4000-8000-000000000017',
        username: 'user',
        sid: SESSION_ID,
      }),
    } as unknown as JwtService;
    const prisma = {
      user: {
        findUnique: jest.fn().mockRejectedValue(new Error('database details')),
      },
      authSession: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(jwt, prisma);
    const { context } = createContext({ token: 'valid-token' });

    const result = guard.canActivate(context);
    await expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(result).rejects.toMatchObject({
      message: 'Nie można teraz zweryfikować sesji. Spróbuj ponownie później.',
    });
  });

  it('rejects a token after its server-side session has been revoked', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: USER_ID,
        username: 'user',
        sid: SESSION_ID,
      }),
    } as unknown as JwtService;
    const findSession = jest.fn().mockResolvedValue(null);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: USER_ID,
          username: 'user',
          role: 'user',
        }),
      },
      authSession: { findUnique: findSession },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(jwt, prisma);
    const { context } = createContext({ token: 'revoked-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findSession).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      select: { id: true, userId: true, expiresAt: true },
    });
  });

  it('rejects a session belonging to another user or past its expiry', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: USER_ID,
        username: 'user',
        sid: SESSION_ID,
      }),
    } as unknown as JwtService;
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: USER_ID,
          username: 'user',
          role: 'user',
        }),
      },
      authSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: SESSION_ID,
          userId: '00000000-0000-4000-8000-000000000019',
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(jwt, prisma);
    const { context } = createContext({ token: 'wrong-owner-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('fails closed when the session lookup fails', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: USER_ID,
        username: 'user',
        sid: SESSION_ID,
      }),
    } as unknown as JwtService;
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: USER_ID,
          username: 'user',
          role: 'user',
        }),
      },
      authSession: {
        findUnique: jest.fn().mockRejectedValue(new Error('database details')),
      },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(jwt, prisma);
    const { context } = createContext({ token: 'valid-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
