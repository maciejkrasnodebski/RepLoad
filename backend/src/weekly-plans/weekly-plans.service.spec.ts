import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { UpdateWeeklyPlanDto } from './dto/update-weekly-plan.dto';
import { WeeklyPlansService } from './weekly-plans.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const emptyDays = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  templateId: null,
  template: null,
  isRestDay: false,
}));

const plan = {
  id: 'plan-1',
  name: 'Semaine',
  userId: '00000000-0000-4000-8000-000000000042',
  createdAt: new Date('2026-11-06T12:00:00Z'),
  days: emptyDays.map((day) => ({ ...day, id: day.dayOfWeek + 1 })),
};

const database = {
  weeklyPlan: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  weeklyPlanDay: {
    upsert: jest.fn(),
  },
  template: {
    findMany: jest.fn(),
  },
};

describe('WeeklyPlansService', () => {
  let service: WeeklyPlansService;

  beforeEach(() => {
    jest.clearAllMocks();
    const transaction = database as unknown as Prisma.TransactionClient;
    const prisma = {
      ...database,
      $transaction: jest.fn(
        (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          callback(transaction),
      ),
    } as unknown as PrismaService;
    service = new WeeklyPlansService(prisma);
  });

  it('lists only the authenticated user plans with all seven day slots', async () => {
    database.weeklyPlan.findMany.mockResolvedValue([plan]);

    await expect(
      service.list('00000000-0000-4000-8000-000000000042'),
    ).resolves.toEqual([{ id: plan.id, name: plan.name, days: emptyDays }]);
    expect(database.weeklyPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: '00000000-0000-4000-8000-000000000042' },
      }),
    );
  });

  it('creates a plan with seven initially unassigned days', async () => {
    database.weeklyPlan.create.mockResolvedValue(plan);

    await service.create('00000000-0000-4000-8000-000000000042', {
      name: '  Semaine  ',
    });

    expect(database.weeklyPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Semaine',
          userId: '00000000-0000-4000-8000-000000000042',
          days: {
            create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
              dayOfWeek,
              templateId: null,
              isRestDay: false,
            })),
          },
        },
      }),
    );
  });

  it('updates one day to an explicit rest day without touching other days', async () => {
    database.weeklyPlan.findFirst.mockResolvedValue({ id: plan.id });
    database.weeklyPlanDay.upsert.mockResolvedValue({});
    database.weeklyPlan.findFirstOrThrow.mockResolvedValue({
      ...plan,
      days: plan.days.map((day) =>
        day.dayOfWeek === 3 ? { ...day, isRestDay: true } : day,
      ),
    });

    const result = await service.update(
      '00000000-0000-4000-8000-000000000042',
      plan.id,
      {
        assignments: [{ dayOfWeek: 3, templateId: null, isRestDay: true }],
      },
    );

    expect(result.days[3]).toEqual({
      dayOfWeek: 3,
      templateId: null,
      template: null,
      isRestDay: true,
    });
    expect(database.weeklyPlanDay.upsert).toHaveBeenCalledWith({
      where: {
        weeklyPlanId_dayOfWeek: { weeklyPlanId: plan.id, dayOfWeek: 3 },
      },
      create: {
        weeklyPlanId: plan.id,
        dayOfWeek: 3,
        templateId: null,
        isRestDay: true,
      },
      update: { dayOfWeek: 3, templateId: null, isRestDay: true },
    });
  });

  it('allows the same owned template to be assigned to multiple days', async () => {
    database.weeklyPlan.findFirst.mockResolvedValue({ id: plan.id });
    database.template.findMany.mockResolvedValue([{ id: 'template-1' }]);
    database.weeklyPlanDay.upsert.mockResolvedValue({});
    database.weeklyPlan.findFirstOrThrow.mockResolvedValue(plan);

    await service.update('00000000-0000-4000-8000-000000000042', plan.id, {
      assignments: [
        { dayOfWeek: 1, templateId: 'template-1', isRestDay: false },
        { dayOfWeek: 4, templateId: 'template-1', isRestDay: false },
      ],
    });

    expect(database.template.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['template-1'] },
        userId: '00000000-0000-4000-8000-000000000042',
      },
      select: { id: true },
    });
    expect(database.weeklyPlanDay.upsert).toHaveBeenCalledTimes(2);
  });

  it('rejects assignments to templates not owned by the user', async () => {
    database.weeklyPlan.findFirst.mockResolvedValue({ id: plan.id });
    database.template.findMany.mockResolvedValue([]);

    await expect(
      service.update('00000000-0000-4000-8000-000000000042', plan.id, {
        assignments: [
          { dayOfWeek: 1, templateId: 'foreign-template', isRestDay: false },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(database.weeklyPlanDay.upsert).not.toHaveBeenCalled();
  });

  it('does not disclose plans owned by another user', async () => {
    database.weeklyPlan.findFirst.mockResolvedValue(null);

    await expect(
      service.update('00000000-0000-4000-8000-000000000042', 'foreign-plan', {
        name: 'Nope',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(database.weeklyPlanDay.upsert).not.toHaveBeenCalled();
  });

  it('deletes only a plan owned by the user', async () => {
    database.weeklyPlan.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      service.delete('00000000-0000-4000-8000-000000000042', plan.id),
    ).resolves.toEqual({ ok: true });
    expect(database.weeklyPlan.deleteMany).toHaveBeenCalledWith({
      where: {
        id: plan.id,
        userId: '00000000-0000-4000-8000-000000000042',
      },
    });
  });

  it('validates day ranges and rest-day/template consistency', async () => {
    const valid = plainToInstance(UpdateWeeklyPlanDto, {
      assignments: [
        { dayOfWeek: 0, templateId: null, isRestDay: true },
        { dayOfWeek: 6, templateId: 'template-1', isRestDay: false },
      ],
    });
    const invalid = plainToInstance(UpdateWeeklyPlanDto, {
      assignments: [
        { dayOfWeek: 7, templateId: 'template-1', isRestDay: true },
        { dayOfWeek: 1, isRestDay: false },
      ],
    });

    await expect(validate(valid, { whitelist: true })).resolves.toHaveLength(0);
    const errors = await validate(invalid, { whitelist: true });
    expect(errors).toHaveLength(1);
    expect(errors[0].children?.length).toBeGreaterThan(0);
  });
});
