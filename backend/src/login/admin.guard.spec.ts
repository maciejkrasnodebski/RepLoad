import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminGuard } from './admin.guard';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

function contextFor(userId?: string, staleRole?: string) {
  const request = userId
    ? { user: { sub: userId, username: 'test-user', role: staleRole } }
    : {};
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

describe('AdminGuard', () => {
  const userId = '00000000-0000-4000-8000-000000000017';
  const findUnique = jest.fn();
  const guard = new AdminGuard({
    user: { findUnique },
  } as never);

  beforeEach(() => {
    findUnique.mockReset();
  });

  it('checks the authenticated ID against the database, not the role on the request', async () => {
    findUnique.mockResolvedValue({ role: 'admin' });

    await expect(guard.canActivate(contextFor(userId, 'user'))).resolves.toBe(
      true,
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: userId },
      select: { role: true },
    });
  });

  it('observes role changes on the next access check', async () => {
    findUnique
      .mockResolvedValueOnce({ role: 'user' })
      .mockResolvedValueOnce({ role: 'admin' })
      .mockResolvedValueOnce({ role: 'user' });

    await expect(
      guard.canActivate(contextFor(userId, 'admin')),
    ).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(contextFor(userId, 'user'))).resolves.toBe(
      true,
    );
    await expect(
      guard.canActivate(contextFor(userId, 'admin')),
    ).rejects.toThrow(ForbiddenException);
    expect(findUnique).toHaveBeenCalledTimes(3);
  });

  it('fails closed when the database user is missing or has no admin role', async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ role: '' });

    await expect(guard.canActivate(contextFor(userId))).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(contextFor(userId))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('fails closed with a safe service error when the role lookup fails', async () => {
    findUnique.mockRejectedValue(new Error('database connection details'));

    const result = guard.canActivate(contextFor(userId));
    await expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(result).rejects.toMatchObject({
      message:
        'Nie można teraz zweryfikować uprawnień. Spróbuj ponownie później.',
    });
  });

  it('rejects a request without an authenticated user ID', async () => {
    await expect(guard.canActivate(contextFor())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });
});
