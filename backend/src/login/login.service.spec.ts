import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service';
import { LoginService } from './login.service';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('password-hash'),
  hashSync: jest.fn().mockReturnValue('dummy-hash'),
}));
jest.mock('../generated/prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {},
  },
}));

describe('LoginService', () => {
  it('creates a server-side session and includes its ID in the signed token', async () => {
    const user = {
      id: '00000000-0000-4000-8000-000000000017',
      username: 'test-user',
      passwordHash: 'stored-hash',
      role: 'user',
    };
    const createSession = jest.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000018',
    });
    const signAsync = jest.fn().mockResolvedValue('signed-token');
    const service = new LoginService(
      {
        user: { findUnique: jest.fn().mockResolvedValue(user) },
        authSession: { create: createSession },
      } as unknown as PrismaService,
      { signAsync } as unknown as JwtService,
    );

    await expect(
      service.login({ username: 'test-user', password: 'password' }),
    ).resolves.toMatchObject({ token: 'signed-token' });
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(signAsync).toHaveBeenCalledWith({
      sub: user.id,
      username: user.username,
      sid: '00000000-0000-4000-8000-000000000018',
    });
  });

  it('revokes the server session associated with a verified token', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new LoginService(
      {
        authSession: { deleteMany },
      } as unknown as PrismaService,
      {
        verifyAsync: jest.fn().mockResolvedValue({
          sub: '00000000-0000-4000-8000-000000000017',
          sid: '00000000-0000-4000-8000-000000000018',
        }),
      } as unknown as JwtService,
    );

    await service.logout('signed-token');

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: '00000000-0000-4000-8000-000000000018',
        userId: '00000000-0000-4000-8000-000000000017',
      },
    });
  });

  it('clears invalid or expired tokens without attempting to revoke a session', async () => {
    const deleteMany = jest.fn();
    const service = new LoginService(
      {
        authSession: { deleteMany },
      } as unknown as PrismaService,
      {
        verifyAsync: jest
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('expired'), { name: 'TokenExpiredError' }),
          ),
      } as unknown as JwtService,
    );

    await expect(service.logout('expired-token')).resolves.toBeUndefined();
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
