import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWeeklyPlanDto } from './dto/create-weekly-plan.dto';
import {
  UpdateWeeklyPlanAssignmentDto,
  UpdateWeeklyPlanDto,
} from './dto/update-weekly-plan.dto';

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

const weeklyPlanInclude = {
  days: {
    orderBy: { dayOfWeek: 'asc' },
    include: { template: { include: templateInclude } },
  },
} satisfies Prisma.WeeklyPlanInclude;

type WeeklyPlanWithDays = Prisma.WeeklyPlanGetPayload<{
  include: typeof weeklyPlanInclude;
}>;

@Injectable()
export class WeeklyPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const plans = await this.prisma.weeklyPlan.findMany({
      where: { userId },
      include: weeklyPlanInclude,
      orderBy: { createdAt: 'asc' },
    });
    return plans.map((plan) => this.toResponse(plan));
  }

  async create(userId: string, dto: CreateWeeklyPlanDto) {
    const plan = await this.prisma.weeklyPlan.create({
      data: {
        name: dto.name.trim(),
        userId,
        days: {
          create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
            dayOfWeek,
            templateId: null,
            isRestDay: false,
          })),
        },
      },
      include: weeklyPlanInclude,
    });
    return this.toResponse(plan);
  }

  async update(userId: string, id: string, dto: UpdateWeeklyPlanDto) {
    if (dto.assignments) this.assertUniqueDays(dto.assignments);

    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.weeklyPlan.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Nie znaleziono planu.');

      const templateIds = [
        ...new Set(
          (dto.assignments ?? [])
            .map((assignment) => assignment.templateId)
            .filter(
              (templateId): templateId is string =>
                typeof templateId === 'string',
            ),
        ),
      ];
      if (templateIds.length > 0) {
        const accessibleTemplates = await transaction.template.findMany({
          where: { id: { in: templateIds }, userId },
          select: { id: true },
        });
        if (accessibleTemplates.length !== templateIds.length) {
          throw new BadRequestException(
            'Lista zawiera nieistniejący lub niedostępny szablon.',
          );
        }
      }

      if (dto.name !== undefined) {
        await transaction.weeklyPlan.update({
          where: { id },
          data: { name: dto.name.trim() },
        });
      }

      for (const assignment of dto.assignments ?? []) {
        await transaction.weeklyPlanDay.upsert({
          where: {
            weeklyPlanId_dayOfWeek: {
              weeklyPlanId: id,
              dayOfWeek: assignment.dayOfWeek,
            },
          },
          create: {
            weeklyPlanId: id,
            ...this.assignmentData(assignment),
          },
          update: this.assignmentData(assignment),
        });
      }

      const plan = await transaction.weeklyPlan.findFirstOrThrow({
        where: { id, userId },
        include: weeklyPlanInclude,
      });
      return this.toResponse(plan);
    });
  }

  async delete(userId: string, id: string) {
    const result = await this.prisma.weeklyPlan.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0)
      throw new NotFoundException('Nie znaleziono planu.');
    return { ok: true };
  }

  private assertUniqueDays(assignments: UpdateWeeklyPlanAssignmentDto[]) {
    if (
      new Set(assignments.map(({ dayOfWeek }) => dayOfWeek)).size !==
      assignments.length
    ) {
      throw new BadRequestException(
        'Każdy dzień można zadeklarować najwyżej raz.',
      );
    }
  }

  private assignmentData(assignment: UpdateWeeklyPlanAssignmentDto) {
    return {
      dayOfWeek: assignment.dayOfWeek,
      templateId: assignment.templateId,
      isRestDay: assignment.isRestDay,
    };
  }

  private toResponse(plan: WeeklyPlanWithDays) {
    return {
      id: plan.id,
      name: plan.name,
      days: Array.from({ length: 7 }, (_, dayOfWeek) => {
        const assignment = plan.days.find((day) => day.dayOfWeek === dayOfWeek);
        return {
          dayOfWeek,
          templateId: assignment?.templateId ?? null,
          template: assignment?.template
            ? this.toTemplateResponse(assignment.template)
            : null,
          isRestDay: assignment?.isRestDay ?? false,
        };
      }),
    };
  }

  private toTemplateResponse(
    template: WeeklyPlanWithDays['days'][number]['template'],
  ) {
    if (!template) return null;
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
