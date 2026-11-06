import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import type { TemplateExerciseInputDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

const templateInclude = {
  exercises: {
    orderBy: { order: 'asc' },
    include: {
      exercise: {
        select: {
          id: true,
          name: true,
          exerciseType: true,
          equipment: true,
          muscleGroup: true,
          difficultyLevel: true,
        },
      },
    },
  },
} satisfies Prisma.TemplateInclude;

type TemplateWithExercises = Prisma.TemplateGetPayload<{
  include: typeof templateInclude;
}>;

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const templates = await this.prisma.template.findMany({
      where: { userId },
      include: templateInclude,
      orderBy: { createdAt: 'desc' },
    });
    return templates.map((template) => this.toResponse(template));
  }

  async get(userId: string, id: string) {
    const template = await this.prisma.template.findFirst({
      where: { id, userId },
      include: templateInclude,
    });
    if (!template) throw new NotFoundException('Nie znaleziono szablonu.');
    return this.toResponse(template);
  }

  async create(userId: string, dto: CreateTemplateDto) {
    return this.prisma.$transaction(async (transaction) => {
      const exercises = this.resolveExerciseInputs(dto);
      this.assertOneExerciseInputFormat(dto);
      await this.assertAccessibleExercises(
        transaction,
        userId,
        exercises.map(({ exerciseId }) => exerciseId),
      );

      const template = await transaction.template.create({
        data: {
          name: dto.name.trim(),
          dayOfWeek: dto.dayOfWeek ?? null,
          color: dto.color ?? null,
          icon: dto.icon ?? null,
          userId,
          exercises: {
            create: exercises.map((exercise, order) => ({
              order,
              ...this.prescriptionData(exercise),
              exercise: { connect: { id: exercise.exerciseId } },
            })),
          },
        },
        include: templateInclude,
      });
      return this.toResponse(template);
    });
  }

  async update(userId: string, id: string, dto: UpdateTemplateDto) {
    return this.prisma.$transaction(async (transaction) => {
      this.assertOneExerciseInputFormat(dto);
      const existing = await transaction.template.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Nie znaleziono szablonu.');

      if (dto.exerciseIds !== undefined || dto.exercises !== undefined) {
        const exercises = this.resolveExerciseInputs(dto);
        await this.assertAccessibleExercises(
          transaction,
          userId,
          exercises.map(({ exerciseId }) => exerciseId),
        );

        const existingRows = await transaction.templateExercise.findMany({
          where: { templateId: id },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
          select: { id: true, exerciseId: true },
        });
        const rowsByExercise = new Map<number, typeof existingRows>();
        for (const row of existingRows) {
          const rows = rowsByExercise.get(row.exerciseId) ?? [];
          rows.push(row);
          rowsByExercise.set(row.exerciseId, rows);
        }

        const retainedIds: number[] = [];
        for (const [order, exercise] of exercises.entries()) {
          const existingRow = rowsByExercise.get(exercise.exerciseId)?.shift();
          const data = {
            order,
            ...this.prescriptionData(exercise),
          };
          if (existingRow) {
            retainedIds.push(existingRow.id);
            await transaction.templateExercise.update({
              where: { id: existingRow.id },
              data,
            });
          } else {
            await transaction.templateExercise.create({
              data: {
                templateId: id,
                exerciseId: exercise.exerciseId,
                ...data,
              },
            });
          }
        }

        await transaction.templateExercise.deleteMany({
          where: {
            templateId: id,
            ...(retainedIds.length > 0 ? { id: { notIn: retainedIds } } : {}),
          },
        });
      }

      const data: Prisma.TemplateUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name.trim();
      if (dto.dayOfWeek !== undefined) data.dayOfWeek = dto.dayOfWeek;
      if (dto.color !== undefined) data.color = dto.color;
      if (dto.icon !== undefined) data.icon = dto.icon;

      const template = await transaction.template.update({
        where: { id },
        data,
        include: templateInclude,
      });
      return this.toResponse(template);
    });
  }

  async delete(userId: string, id: string) {
    const result = await this.prisma.template.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0)
      throw new NotFoundException('Nie znaleziono szablonu.');
    return { ok: true };
  }

  private async assertAccessibleExercises(
    transaction: Prisma.TransactionClient,
    userId: string,
    exerciseIds: number[],
  ) {
    if (exerciseIds.length === 0) return;
    const uniqueExerciseIds = [...new Set(exerciseIds)];

    const accessible = await transaction.exercise.findMany({
      where: {
        id: { in: uniqueExerciseIds },
        OR: [{ userId: null }, { userId }],
      },
      select: { id: true },
    });
    if (accessible.length !== uniqueExerciseIds.length) {
      throw new BadRequestException(
        'Lista zawiera nieistniejące lub niedostępne ćwiczenie.',
      );
    }
  }

  private resolveExerciseInputs(
    dto: Pick<CreateTemplateDto, 'exerciseIds' | 'exercises'>,
  ): TemplateExerciseInputDto[] {
    return (
      dto.exercises ??
      (dto.exerciseIds ?? []).map((exerciseId) => ({ exerciseId }))
    );
  }

  private assertOneExerciseInputFormat(
    dto: Pick<CreateTemplateDto, 'exerciseIds' | 'exercises'>,
  ) {
    if (dto.exercises !== undefined && dto.exerciseIds !== undefined) {
      throw new BadRequestException('Use exerciseIds or exercises, not both.');
    }
  }

  private prescriptionData(exercise: TemplateExerciseInputDto) {
    return {
      ...(exercise.sets != null ? { sets: exercise.sets } : {}),
      ...(exercise.reps != null ? { reps: exercise.reps } : {}),
      ...(exercise.weight != null ? { weight: exercise.weight } : {}),
      ...(exercise.durationSeconds != null
        ? { durationSeconds: exercise.durationSeconds }
        : {}),
      ...(exercise.restSeconds != null
        ? { restSeconds: exercise.restSeconds }
        : {}),
      ...(exercise.distance != null ? { distance: exercise.distance } : {}),
    };
  }

  private toResponse(template: TemplateWithExercises) {
    return {
      id: template.id,
      name: template.name,
      dayOfWeek: template.dayOfWeek,
      color: template.color,
      icon: template.icon,
      createdAt: template.createdAt,
      exercises: template.exercises.map(({ exercise, ...assignment }) => ({
        ...exercise,
        settings: {
          sets: assignment.sets ?? null,
          reps: assignment.reps ?? null,
          weight: assignment.weight ?? null,
          durationSeconds: assignment.durationSeconds ?? null,
          restSeconds: assignment.restSeconds ?? null,
          distance: assignment.distance ?? null,
        },
      })),
    };
  }
}
