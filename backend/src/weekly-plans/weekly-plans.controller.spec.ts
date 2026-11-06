import type { AuthRequest } from '../login/jwt-auth.guard';
import { WeeklyPlansController } from './weekly-plans.controller';
import type { WeeklyPlansService } from './weekly-plans.service';

jest.mock('../login/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {},
}));
jest.mock('./weekly-plans.service', () => ({
  WeeklyPlansService: class WeeklyPlansService {},
}));

describe('WeeklyPlansController', () => {
  const service = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const controller = new WeeklyPlansController(
    service as unknown as WeeklyPlansService,
  );
  const request = {
    user: {
      sub: '00000000-0000-4000-8000-000000000042',
      username: 'test-user',
    },
  } as AuthRequest;

  beforeEach(() => jest.clearAllMocks());

  it('passes the authenticated owner to list and create', async () => {
    const dto = { name: 'Semaine' };
    service.list.mockResolvedValue([]);
    service.create.mockResolvedValue({ id: 'plan-1' });

    await expect(controller.list(request)).resolves.toEqual([]);
    await expect(controller.create(request, dto)).resolves.toEqual({
      id: 'plan-1',
    });
    expect(service.list).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000042',
    );
    expect(service.create).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000042',
      dto,
    );
  });

  it('passes the plan ID, authenticated owner, and DTO to update/delete', async () => {
    const dto = { name: 'New name' };
    service.update.mockResolvedValue({ id: 'plan-1', name: 'New name' });
    service.delete.mockResolvedValue({ ok: true });

    await controller.update(request, 'plan-1', dto);
    await controller.delete(request, 'plan-1');

    expect(service.update).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000042',
      'plan-1',
      dto,
    );
    expect(service.delete).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000042',
      'plan-1',
    );
  });
});
