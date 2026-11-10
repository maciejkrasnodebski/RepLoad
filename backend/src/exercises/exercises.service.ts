import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';

const exerciseSelect = {
  id: true,
  name: true,
  description: true,
  exerciseType: true,
  equipment: true,
  muscleGroup: true,
  difficultyLevel: true,
  isActive: true,
  userId: true,
} satisfies Prisma.ExerciseSelect;

const polishLetterVariants: Record<string, string[]> = {
  a: ['a', 'ą'],
  c: ['c', 'ć'],
  e: ['e', 'ę'],
  l: ['l', 'ł'],
  n: ['n', 'ń'],
  o: ['o', 'ó'],
  s: ['s', 'ś'],
  z: ['z', 'ź', 'ż'],
  ą: ['a', 'ą'],
  ć: ['c', 'ć'],
  ę: ['e', 'ę'],
  ł: ['l', 'ł'],
  ń: ['n', 'ń'],
  ó: ['o', 'ó'],
  ś: ['s', 'ś'],
  ź: ['z', 'ź', 'ż'],
  ż: ['z', 'ź', 'ż'],
};

function searchVariants(query: string) {
  let variants = [''];
  for (const character of query.toLocaleLowerCase('pl-PL')) {
    const choices = polishLetterVariants[character] ?? [character];
    variants = variants.flatMap((variant) =>
      choices.map((choice) => `${variant}${choice}`),
    );
    if (variants.length > 64) variants = variants.slice(0, 64);
  }
  return [...new Set(variants)];
}

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, query: string) {
    if (typeof query !== 'string' || query.length > 100) {
      throw new BadRequestException(
        'Fraza wyszukiwania jest nieprawidłowa lub zbyt długa.',
      );
    }

    const trimmedQuery = query.trim();
    const variants = trimmedQuery ? searchVariants(trimmedQuery) : [];

    return this.prisma.exercise.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ userId: null }, { userId }] },
          ...(variants.length === 1
            ? [
                {
                  name: {
                    contains: variants[0],
                    mode: 'insensitive' as const,
                  },
                },
              ]
            : variants.length > 1
              ? [
                  {
                    OR: variants.map((variant) => ({
                      name: {
                        contains: variant,
                        mode: 'insensitive' as const,
                      },
                    })),
                  },
                ]
              : []),
        ],
      },
      select: exerciseSelect,
      orderBy: { name: 'asc' },
      take: 25,
    });
  }

  async listGlobal(query = '') {
    const trimmedQuery = typeof query === 'string' ? query.trim() : '';
    const variants = trimmedQuery ? searchVariants(trimmedQuery) : [];

    return this.prisma.exercise.findMany({
      where: {
        isActive: true,
        userId: null,
        ...(variants.length === 0
          ? {}
          : {
              AND: [
                ...(variants.length === 1
                  ? [
                      {
                        name: {
                          contains: variants[0],
                          mode: 'insensitive' as const,
                        },
                      },
                    ]
                  : [
                      {
                        OR: variants.map((variant) => ({
                          name: {
                            contains: variant,
                            mode: 'insensitive' as const,
                          },
                        })),
                      },
                    ]),
              ],
            }),
      },
      select: exerciseSelect,
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async globalStats() {
    const where = { isActive: true, userId: null };
    const [exerciseCount, muscleGroups] = await Promise.all([
      this.prisma.exercise.count({ where }),
      this.prisma.exercise.groupBy({ by: ['muscleGroup'], where }),
    ]);

    return {
      exerciseCount,
      muscleGroupCount: muscleGroups.filter(
        ({ muscleGroup }) => muscleGroup?.trim(),
      ).length,
    };
  }

  async create(userId: string, dto: CreateExerciseDto) {
    const name = this.normalizeName(dto.name);
    await this.ensureUniquePerUser(name, userId, false);

    try {
      return await this.prisma.exercise.create({
        data: {
          name,
          description: this.normalizeOptional(dto.description),
          exerciseType: dto.exerciseType?.trim() || 'Inne',
          equipment: this.normalizeOptional(dto.equipment),
          muscleGroup: this.normalizeOptional(dto.muscleGroup),
          difficultyLevel: this.normalizeOptional(dto.difficultyLevel),
          user: { connect: { id: userId } },
          isActive: true,
        },
        select: exerciseSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Masz już własne ćwiczenie o tej nazwie. Wybierz inną nazwę.',
        );
      }
      throw error;
    }
  }

  async createGlobal(dto: CreateExerciseDto) {
    const name = this.normalizeName(dto.name);
    await this.ensureUniquePerUser(name, null, true);

    try {
      return await this.prisma.exercise.create({
        data: {
          name,
          description: this.normalizeOptional(dto.description),
          exerciseType: dto.exerciseType?.trim() || 'Inne',
          equipment: this.normalizeOptional(dto.equipment),
          muscleGroup: this.normalizeOptional(dto.muscleGroup),
          difficultyLevel: this.normalizeOptional(dto.difficultyLevel),
          userId: null,
          isActive: true,
        },
        select: exerciseSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Globalne ćwiczenie o tej nazwie już istnieje.');
      }
      throw error;
    }
  }

  async updateGlobal(id: string, dto: CreateExerciseDto) {
    const name = this.normalizeName(dto.name);
    const existing = await this.prisma.exercise.findFirst({
      where: { id, userId: null, isActive: true },
      select: { id: true, name: true },
    });
    if (!existing) {
      throw new BadRequestException('Nie znaleziono aktywnego ćwiczenia globalnego.');
    }

    if (existing.name.toLowerCase() !== name.toLowerCase()) {
      await this.ensureUniquePerUser(name, null, true);
    }

    return this.prisma.exercise.update({
      where: { id },
      data: {
        name,
        description: this.normalizeOptional(dto.description),
        exerciseType: dto.exerciseType?.trim() || 'Inne',
        equipment: this.normalizeOptional(dto.equipment),
        muscleGroup: this.normalizeOptional(dto.muscleGroup),
        difficultyLevel: this.normalizeOptional(dto.difficultyLevel),
      },
      select: exerciseSelect,
    });
  }

  async deleteGlobal(id: string) {
    const item = await this.prisma.exercise.findFirst({
      where: { id, userId: null, isActive: true },
      select: { id: true },
    });

    if (!item) {
      throw new BadRequestException('Nie znaleziono aktywnego ćwiczenia globalnego.');
    }

    await this.prisma.exercise.update({
      where: { id },
      data: { isActive: false },
    });

    return { ok: true };
  }

  private normalizeName(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !trimmed.replace(/\s+/g, '').length) {
      throw new BadRequestException('Nazwa ćwiczenia nie może być pusta.');
    }
    return trimmed;
  }

  private normalizeOptional(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }

  private async ensureUniquePerUser(
    name: string,
    userId: string | null,
    isGlobal: boolean,
  ) {
    const duplicate = await this.prisma.exercise.findFirst({
      where: {
        isActive: true,
        ...(isGlobal
          ? { userId: null, name: { equals: name, mode: 'insensitive' } }
          : { userId, name: { equals: name, mode: 'insensitive' } }),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(
        isGlobal
          ? 'Globalne ćwiczenie o tej nazwie już istnieje.'
          : 'Masz już własne ćwiczenie o tej nazwie. Wybierz inną nazwę.',
      );
    }
  }
}
