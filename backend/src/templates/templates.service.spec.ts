import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { TemplatesService } from './templates.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const exercise = {
  id: '550e8400-e29b-41d4-a716-446655440008',
  name: 'Przysiad',
  exerciseType: 'Siłowe',
  equipment: null,
  muscleGroup: 'Nogi',
  difficultyLevel: null,
};
const secondExerciseId = '550e8400-e29b-41d4-a716-446655440009';
const templateId = '550e8400-e29b-41d4-a716-446655440010';
const firstTemplateExerciseId = '550e8400-e29b-41d4-a716-446655440015';
const secondTemplateExerciseId = '550e8400-e29b-41d4-a716-446655440016';

const template = {
  id: templateId,
  name: 'Nogi',
  dayOfWeek: null,
  daysOfWeek: [],
  color: null,
  icon: null,
  createdAt: new Date('2026-11-02T12:00:00Z'),
  exercises: [{ order: 0, exercise }],
};

const database = {
  template: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  exercise: {
    findMany: jest.fn(),
  },
  templateExercise: {
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
};

describe('TemplatesService', () => {
  let service: TemplatesService;

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
    service = new TemplatesService(prisma);
  });

  it('lists only templates belonging to the authenticated user', async () => {
    database.template.findMany.mockResolvedValue([template]);

    await expect(
      service.list('00000000-0000-4000-8000-000000000042'),
    ).resolves.toEqual([
      {
        id: templateId,
        name: 'Nogi',
        dayOfWeek: null,
        daysOfWeek: [],
        color: null,
        icon: null,
        createdAt: template.createdAt,
        exercises: [
          {
            ...exercise,
            settings: {
              sets: null,
              reps: null,
              weight: null,
              durationSeconds: null,
              restSeconds: null,
              distance: null,
            },
          },
        ],
      },
    ]);
    expect(database.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: '00000000-0000-4000-8000-000000000042' },
      }),
    );
  });

  it('creates a template with the authenticated owner and ordered exercises', async () => {
    database.exercise.findMany.mockResolvedValue([{ id: exercise.id }]);
    database.template.create.mockResolvedValue(template);

    await service.create('00000000-0000-4000-8000-000000000042', {
      name: 'Nogi',
      dayOfWeek: null,
      daysOfWeek: [],
      exerciseIds: [exercise.id],
    });

    expect(database.template.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Nogi',
          dayOfWeek: null,
          color: null,
          icon: null,
          userId: '00000000-0000-4000-8000-000000000042',
          daysOfWeek: [],
          exercises: {
            create: [
              {
                order: 0,
                exercise: { connect: { id: exercise.id } },
              },
            ],
          },
        }),
      }),
    );
  });

  it('assigns one template to multiple weekdays without a legacy single day', async () => {
    database.template.create.mockResolvedValue({
      ...template,
      daysOfWeek: [0, 4],
      exercises: [],
    });

    await service.create('00000000-0000-4000-8000-000000000042', {
      name: 'PUSH',
      daysOfWeek: [0, 4],
      exerciseIds: [],
    });

    expect(database.template.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dayOfWeek: null,
          daysOfWeek: [0, 4],
        }),
      }),
    );
  });

  it('updates and clears multiple weekday assignments on the template', async () => {
    database.template.findFirst.mockResolvedValue({ id: template.id });
    database.template.update.mockResolvedValue({
      ...template,
      dayOfWeek: null,
      daysOfWeek: [0, 4],
      exercises: [],
    });

    await service.update('00000000-0000-4000-8000-000000000042', template.id, {
      daysOfWeek: [0, 4],
    });
    expect(database.template.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { daysOfWeek: [0, 4], dayOfWeek: null },
      }),
    );

    database.template.update.mockResolvedValue({
      ...template,
      dayOfWeek: null,
      daysOfWeek: [],
      exercises: [],
    });
    await service.update('00000000-0000-4000-8000-000000000042', template.id, {
      daysOfWeek: [],
    });
    expect(database.template.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { daysOfWeek: [], dayOfWeek: null },
      }),
    );
  });

  it('rejects adding exercises not owned by the user or global', async () => {
    database.exercise.findMany.mockResolvedValue([]);

    await expect(
      service.create('00000000-0000-4000-8000-000000000042', {
        name: 'Nogi',
        dayOfWeek: null,
        exerciseIds: [exercise.id],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(database.template.create).not.toHaveBeenCalled();
  });

  it('allows templates without exercises', async () => {
    database.template.create.mockResolvedValue({
      ...template,
      exercises: [],
    });

    await service.create('00000000-0000-4000-8000-000000000042', {
      name: 'Pusty plan',
      dayOfWeek: null,
      daysOfWeek: [],
      exerciseIds: [],
    });

    expect(database.exercise.findMany).not.toHaveBeenCalled();
    expect(database.template.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Pusty plan',
          dayOfWeek: null,
          daysOfWeek: [],
          color: null,
          icon: null,
          userId: '00000000-0000-4000-8000-000000000042',
          exercises: { create: [] },
        },
      }),
    );
  });

  it('replaces template exercises in the requested order', async () => {
    database.template.findFirst.mockResolvedValue({ id: template.id });
    database.exercise.findMany.mockResolvedValue([
      { id: secondExerciseId },
      { id: exercise.id },
    ]);
    database.templateExercise.findMany.mockResolvedValue([
      { id: firstTemplateExerciseId, exerciseId: exercise.id },
      { id: secondTemplateExerciseId, exerciseId: secondExerciseId },
    ]);
    database.templateExercise.update.mockResolvedValue({});
    database.templateExercise.deleteMany.mockResolvedValue({ count: 0 });
    database.template.update.mockResolvedValue({
      ...template,
      exercises: [],
    });

    await service.update('00000000-0000-4000-8000-000000000042', template.id, {
      exerciseIds: [secondExerciseId, exercise.id],
    });

    expect(database.templateExercise.update).toHaveBeenNthCalledWith(1, {
      where: { id: secondTemplateExerciseId },
      data: { order: 0 },
    });
    expect(database.templateExercise.update).toHaveBeenNthCalledWith(2, {
      where: { id: firstTemplateExerciseId },
      data: { order: 1 },
    });
    expect(database.templateExercise.create).not.toHaveBeenCalled();
    expect(database.templateExercise.deleteMany).toHaveBeenCalledWith({
      where: {
        templateId: template.id,
        id: { notIn: [secondTemplateExerciseId, firstTemplateExerciseId] },
      },
    });
  });

  it('creates duplicate exercise slots and preserves existing row IDs by occurrence', async () => {
    database.template.findFirst.mockResolvedValue({ id: template.id });
    database.exercise.findMany.mockResolvedValue([{ id: exercise.id }]);
    database.templateExercise.findMany.mockResolvedValue([
      { id: firstTemplateExerciseId, exerciseId: exercise.id },
    ]);
    database.templateExercise.update.mockResolvedValue({});
    database.templateExercise.create.mockResolvedValue({
      id: secondTemplateExerciseId,
    });
    database.templateExercise.deleteMany.mockResolvedValue({ count: 0 });
    database.template.update.mockResolvedValue({
      ...template,
      exercises: [],
    });

    await service.update('00000000-0000-4000-8000-000000000042', template.id, {
      exercises: [
        { exerciseId: exercise.id, sets: 3, reps: 8 },
        { exerciseId: exercise.id, sets: 2, reps: 12 },
      ],
    });

    expect(database.exercise.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [exercise.id] } }),
      }),
    );
    expect(database.templateExercise.update).toHaveBeenCalledWith({
      where: { id: firstTemplateExerciseId },
      data: { order: 0, sets: 3, reps: 8 },
    });
    expect(database.templateExercise.create).toHaveBeenCalledWith({
      data: {
        templateId: template.id,
        exerciseId: exercise.id,
        order: 1,
        sets: 2,
        reps: 12,
      },
    });
    expect(database.templateExercise.deleteMany).toHaveBeenCalledWith({
      where: {
        templateId: template.id,
        id: { notIn: [firstTemplateExerciseId] },
      },
    });
  });

  it('persists and returns per-exercise settings and template appearance', async () => {
    database.exercise.findMany.mockResolvedValue([{ id: exercise.id }]);
    database.template.create.mockResolvedValue({
      ...template,
      color: '#AABBCC',
      icon: 'dumbbell',
      exercises: [
        {
          order: 0,
          sets: 3,
          reps: 8,
          weight: 42.5,
          durationSeconds: null,
          restSeconds: 90,
          distance: null,
          exercise,
        },
      ],
    });

    await expect(
      service.create('00000000-0000-4000-8000-000000000042', {
        name: 'Nogi',
        color: '#AABBCC',
        icon: 'dumbbell',
        exercises: [
          {
            exerciseId: exercise.id,
            sets: 3,
            reps: 8,
            weight: 42.5,
            restSeconds: 90,
          },
        ],
      }),
    ).resolves.toMatchObject({
      color: '#AABBCC',
      icon: 'dumbbell',
      exercises: [
        {
          id: exercise.id,
          settings: {
            sets: 3,
            reps: 8,
            weight: 42.5,
            durationSeconds: null,
            restSeconds: 90,
            distance: null,
          },
        },
      ],
    });
    expect(database.template.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          color: '#AABBCC',
          icon: 'dumbbell',
          exercises: {
            create: [
              {
                order: 0,
                sets: 3,
                reps: 8,
                weight: 42.5,
                restSeconds: 90,
                exercise: { connect: { id: exercise.id } },
              },
            ],
          },
        }),
      }),
    );
  });

  it('does not disclose or update a template owned by another user', async () => {
    database.template.findFirst.mockResolvedValue(null);

    await expect(
      service.update(
        '00000000-0000-4000-8000-000000000042',
        'someone-elses-template',
        { name: 'Zmiana' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(database.template.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'someone-elses-template',
          userId: '00000000-0000-4000-8000-000000000042',
        },
      }),
    );
    expect(database.template.update).not.toHaveBeenCalled();
  });

  it('deletes only a template owned by the authenticated user', async () => {
    database.template.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      service.delete(
        '00000000-0000-4000-8000-000000000042',
        templateId,
      ),
    ).resolves.toEqual({ ok: true });
    expect(database.template.deleteMany).toHaveBeenCalledWith({
      where: {
        id: templateId,
        userId: '00000000-0000-4000-8000-000000000042',
      },
    });
  });

  it('rejects invalid weekday values and whitespace-only names', async () => {
    const dto = Object.assign(new CreateTemplateDto(), {
      name: '   ',
      dayOfWeek: 7,
      exerciseIds: [],
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'dayOfWeek']),
    );
  });

  it('rejects duplicate or out-of-range weekday assignments', async () => {
    const duplicateDays = plainToInstance(CreateTemplateDto, {
      name: 'PUSH',
      daysOfWeek: [0, 0],
      exerciseIds: [],
    });
    const invalidDays = plainToInstance(CreateTemplateDto, {
      name: 'PULL',
      daysOfWeek: [7],
      exerciseIds: [],
    });

    expect((await validate(duplicateDays)).map((error) => error.property)).toContain(
      'daysOfWeek',
    );
    expect((await validate(invalidDays)).map((error) => error.property)).toContain(
      'daysOfWeek',
    );
  });

  it('allows repeated exercise IDs in exercises payload but not legacy exerciseIds', async () => {
    const repeatedComposition = plainToInstance(CreateTemplateDto, {
      name: 'Powtórzenia',
      exercises: [
        { exerciseId: exercise.id, sets: 3 },
        { exerciseId: exercise.id, sets: 2 },
      ],
    });
    const repeatedLegacyIds = plainToInstance(CreateTemplateDto, {
      name: 'Legacy',
      exerciseIds: [exercise.id, exercise.id],
    });

    await expect(validate(repeatedComposition)).resolves.toHaveLength(0);
    const errors = await validate(repeatedLegacyIds);
    expect(errors.map((error) => error.property)).toContain('exerciseIds');
  });
});
