import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AddSeriesDto } from './dto/workout.dto';
import { WorkoutsService } from './workouts.service';

jest.mock('../generated/prisma/client', () => {
  class Decimal {
    private value: number;
    constructor(value: number | string) {
      this.value = Number(value);
    }
    toDecimalPlaces(places: number) {
      this.value = Number(this.value.toFixed(places));
      return this;
    }
    toFixed(places: number) {
      return this.value.toFixed(places);
    }
  }
  return {
    Prisma: {
      Decimal,
      PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {},
    },
  };
});

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const userId = '00000000-0000-4000-8000-000000000042';
const sessionExerciseId = '550e8400-e29b-41d4-a716-446655440001';
const seriesId = '550e8400-e29b-41d4-a716-446655440002';
const session = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  userId,
  name: null,
  templateId: null,
  templateName: null,
  status: 'ACTIVE',
  startedAt: new Date('2026-11-06T12:00:00Z'),
  endedAt: null,
  createdAt: new Date('2026-11-06T12:00:00Z'),
  updatedAt: new Date('2026-11-06T12:00:00Z'),
  exercises: [],
};

const database = {
  workoutSession: {
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  workoutSessionExercise: {
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    create: jest.fn(),
  },
  workoutSeries: {
    aggregate: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    findFirstOrThrow: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('WorkoutsService', () => {
  let service: WorkoutsService;

  beforeEach(() => {
    jest.clearAllMocks();
    const transaction = database as never;
    const prisma = {
      ...database,
      $transaction: jest.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    } as unknown as PrismaService;
    service = new WorkoutsService(prisma);
  });

  it('accepts at most two decimal places for weight and distance', async () => {
    const valid = plainToInstance(AddSeriesDto, {
      weight: 42.55,
      distance: 1.25,
    });
    const invalid = plainToInstance(AddSeriesDto, {
      weight: 42.555,
      distance: 1.255,
    });

    await expect(validate(valid, { whitelist: true })).resolves.toHaveLength(0);
    await expect(
      validate(invalid, { whitelist: true }),
    ).resolves.not.toHaveLength(0);
  });

  it('recovers the current active session for the authenticated UUID', async () => {
    database.workoutSession.findFirst.mockResolvedValue(session);

    await expect(service.current(userId)).resolves.toMatchObject({
      id: session.id,
      status: 'ACTIVE',
      exercises: [],
    });
    expect(database.workoutSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, status: 'ACTIVE' },
      }),
    );
  });

  it('resumes instead of creating a second active session', async () => {
    database.workoutSession.findFirst.mockResolvedValue(session);

    await expect(service.start(userId, {})).resolves.toMatchObject({
      id: session.id,
    });
    expect(database.workoutSession.create).not.toHaveBeenCalled();
  });

  it('stores and returns two-decimal series measurements', async () => {
    database.workoutSession.findFirst.mockResolvedValue({ id: session.id });
    database.workoutSessionExercise.findFirst.mockResolvedValue({
      id: sessionExerciseId,
    });
    database.workoutSeries.aggregate.mockResolvedValue({
      _max: { order: 0 },
    });
    database.workoutSeries.create.mockResolvedValue({
      id: seriesId,
      order: 1,
      reps: 8,
      weight: new Prisma.Decimal('42.50'),
      durationSeconds: null,
      distance: new Prisma.Decimal('1.25'),
      restSeconds: 90,
      rpe: new Prisma.Decimal('8.5'),
      rir: 1,
      notes: null,
      isDone: true,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });

    const result = await service.addSeries(userId, session.id, sessionExerciseId, {
      reps: 8,
      weight: 42.5,
      distance: 1.25,
      restSeconds: 90,
      rpe: 8.5,
      rir: 1,
      isDone: true,
    });

    expect(database.workoutSeries.create).toHaveBeenCalledWith({
      data: {
        sessionExerciseId,
        order: 1,
        reps: 8,
        weight: new Prisma.Decimal('42.50'),
        distance: new Prisma.Decimal('1.25'),
        restSeconds: 90,
        rpe: new Prisma.Decimal('8.5'),
        rir: 1,
        isDone: true,
      },
    });
    expect(result).toMatchObject({
      weight: '42.50',
      distance: '1.25',
      rpe: '8.5',
    });
  });

  it('does not change the completion timestamp when finish is retried', async () => {
    const completed = {
      ...session,
      status: 'COMPLETED',
      endedAt: new Date('2026-11-06T12:30:00Z'),
    };
    database.workoutSession.findFirst.mockResolvedValue(completed);
    database.workoutSession.findFirstOrThrow.mockResolvedValue(completed);

    await expect(service.finish(userId, session.id)).resolves.toMatchObject({
      status: 'COMPLETED',
      endedAt: completed.endedAt,
    });
    expect(database.workoutSession.updateMany).not.toHaveBeenCalled();
    expect(database.workoutSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: session.id, userId },
      }),
    );
  });

  it('removes unchecked draft series when a workout is completed', async () => {
    const completed = {
      ...session,
      status: 'COMPLETED',
      endedAt: new Date('2026-11-06T12:30:00Z'),
    };
    database.workoutSession.findFirst.mockResolvedValue(session);
    database.workoutSeries.deleteMany.mockResolvedValue({ count: 2 });
    database.workoutSession.updateMany.mockResolvedValue({ count: 1 });
    database.workoutSession.findFirstOrThrow.mockResolvedValue(completed);

    await service.finish(userId, session.id);

    expect(database.workoutSeries.deleteMany).toHaveBeenCalledWith({
      where: {
        sessionExercise: { sessionId: session.id },
        isDone: false,
      },
    });
    expect(database.workoutSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: session.id, userId, status: 'ACTIVE' },
        data: { status: 'COMPLETED', endedAt: expect.any(Date) },
      }),
    );
  });

  it('scopes history to the authenticated user and returns completed history', async () => {
    const completed = { ...session, status: 'COMPLETED' };
    database.workoutSession.findMany.mockResolvedValue([completed]);

    await expect(service.history(userId)).resolves.toMatchObject([
      { id: session.id, status: 'COMPLETED' },
    ]);
    expect(database.workoutSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, status: { in: ['COMPLETED', 'CANCELLED'] } },
      }),
    );
  });

  it('cannot mutate a series belonging to another user session', async () => {
    database.workoutSession.findFirst.mockResolvedValue({ id: session.id });
    database.workoutSeries.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateSeries(
        userId,
        session.id,
        '550e8400-e29b-41d4-a716-446655440004',
        { reps: 5 },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(database.workoutSeries.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: '550e8400-e29b-41d4-a716-446655440004',
          sessionExercise: { sessionId: session.id },
        },
      }),
    );
  });
});
