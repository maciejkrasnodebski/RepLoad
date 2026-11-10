import type { PrismaService } from '../prisma/prisma.service';
import { ExercisesService } from './exercises.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../generated/prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {},
  },
}));

describe('ExercisesService', () => {
  it('searches only global and authenticated-user exercises', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ExercisesService({
      exercise: { findMany, findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await service.search('00000000-0000-4000-8000-000000000017', 'squat');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          AND: [
            {
              OR: [
                { userId: null },
                { userId: '00000000-0000-4000-8000-000000000017' },
              ],
            },
            {
              OR: [
                { name: { contains: 'squat', mode: 'insensitive' } },
                { name: { contains: 'squąt', mode: 'insensitive' } },
                { name: { contains: 'śquat', mode: 'insensitive' } },
                { name: { contains: 'śquąt', mode: 'insensitive' } },
              ],
            },
          ],
        }),
        take: 25,
      }),
    );
  });

  it('searches Polish exercise names regardless of diacritics in the query', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ExercisesService({
      exercise: { findMany },
    } as unknown as PrismaService);

    await service.search('00000000-0000-4000-8000-000000000017', 'laczka');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { name: { contains: 'łączka', mode: 'insensitive' } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it('assigns newly created exercises to the authenticated user', async () => {
    const create = jest.fn().mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440010',
      name: 'Przysiad',
      description: null,
      exerciseType: 'Inne',
      equipment: null,
      muscleGroup: null,
      difficultyLevel: null,
    });
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new ExercisesService({
      exercise: { create, findFirst },
    } as unknown as PrismaService);

    await service.create('00000000-0000-4000-8000-000000000017', {
      name: ' Przysiad ',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Przysiad',
          user: { connect: { id: '00000000-0000-4000-8000-000000000017' } },
          exerciseType: 'Inne',
          description: null,
          equipment: null,
          muscleGroup: null,
          difficultyLevel: null,
          isActive: true,
        }),
      }),
    );
  });
});
