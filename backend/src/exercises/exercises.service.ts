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

  async create(userId: string, dto: CreateExerciseDto) {
    try {
      return await this.prisma.exercise.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          exerciseType: dto.exerciseType?.trim() || 'Inne',
          equipment: dto.equipment?.trim() || null,
          muscleGroup: dto.muscleGroup?.trim() || null,
          difficultyLevel: dto.difficultyLevel?.trim() || null,
          user: { connect: { id: userId } },
        },
        select: exerciseSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ćwiczenie o tej nazwie już istnieje.');
      }
      throw error;
    }
  }
}
