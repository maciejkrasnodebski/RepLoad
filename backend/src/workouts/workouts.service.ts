import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddExerciseDto,
  AddSeriesDto,
  AutosaveWorkoutDto,
  StartWorkoutDto,
  SeriesInputDto,
  UpdateExerciseDto,
  UpdateSeriesDto,
} from './dto/workout.dto';

const sessionInclude = {
  exercises: {
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    include: { series: { orderBy: [{ order: 'asc' }, { id: 'asc' }] } },
  },
} satisfies Prisma.WorkoutSessionInclude;

type SessionWithEntries = Prisma.WorkoutSessionGetPayload<{
  include: typeof sessionInclude;
}>;

const templateInclude = {
  exercises: {
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    include: {
      exercise: { select: { id: true, name: true, exerciseType: true } },
    },
  },
} satisfies Prisma.TemplateInclude;

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async current(userId: string) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: sessionInclude,
    });
    return session ? this.toResponse(session) : null;
  }

  async start(userId: string, dto: StartWorkoutDto) {
    let templateId = dto.templateId;
    if (dto.weeklyPlanId !== undefined) {
      if (dto.dayOfWeek === undefined) {
        throw new BadRequestException(
          'dayOfWeek is required when starting from a weekly plan.',
        );
      }
      const planDay = await this.prisma.weeklyPlanDay.findFirst({
        where: {
          weeklyPlanId: dto.weeklyPlanId,
          dayOfWeek: dto.dayOfWeek,
          weeklyPlan: { userId },
        },
        select: { templateId: true, isRestDay: true },
      });
      if (!planDay) throw new NotFoundException('Nie znaleziono planu.');
      if (planDay.isRestDay || !planDay.templateId) {
        throw new BadRequestException('The selected plan day has no workout.');
      }
      if (templateId && templateId !== planDay.templateId) {
        throw new BadRequestException(
          'templateId does not match the selected weekly-plan day.',
        );
      }
      templateId = planDay.templateId;
    }

    let template: Prisma.TemplateGetPayload<{
      include: typeof templateInclude;
    }> | null = null;
    if (templateId) {
      template = await this.prisma.template.findFirst({
        where: { id: templateId, userId },
        include: templateInclude,
      });
      if (!template) throw new NotFoundException('Nie znaleziono szablonu.');
    }

    try {
      const session = await this.prisma.$transaction(async (transaction) => {
        const active = await transaction.workoutSession.findFirst({
          where: { userId, status: 'ACTIVE' },
          include: sessionInclude,
        });
        if (active) return active;

        return transaction.workoutSession.create({
          data: {
            userId,
            templateId: template?.id,
            templateName: template?.name,
            name: dto.name?.trim() || null,
            exercises: template
              ? {
                  create: template.exercises.map((item, order) => ({
                    exerciseId: item.exerciseId,
                    name: item.exercise.name,
                    exerciseType: item.exercise.exerciseType,
                    order,
                    series: {
                      create: Array.from(
                        { length: item.sets ?? 1 },
                        (_, seriesOrder) => ({
                          order: seriesOrder,
                          reps: item.reps,
                          weight:
                            item.weight == null
                              ? undefined
                              : new Prisma.Decimal(item.weight).toDecimalPlaces(
                                  2,
                                ),
                          durationSeconds: item.durationSeconds,
                          distance:
                            item.distance == null
                              ? undefined
                              : new Prisma.Decimal(
                                  item.distance,
                                ).toDecimalPlaces(2),
                          restSeconds: item.restSeconds,
                        }),
                      ),
                    },
                  })),
                }
              : undefined,
          },
          include: sessionInclude,
        });
      });
      return this.toResponse(session);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const active = await this.prisma.workoutSession.findFirst({
          where: { userId, status: 'ACTIVE' },
          include: sessionInclude,
        });
        if (active) return this.toResponse(active);
      }
      throw error;
    }
  }

  async addExercise(userId: string, sessionId: string, dto: AddExerciseDto) {
    const session = await this.requireActive(userId, sessionId);
    let linked: { id: number; name: string; exerciseType: string } | null =
      null;
    if (dto.exerciseId !== undefined) {
      linked = await this.prisma.exercise.findFirst({
        where: {
          id: dto.exerciseId,
          OR: [{ userId: null }, { userId }],
        },
        select: { id: true, name: true, exerciseType: true },
      });
      if (!linked)
        throw new NotFoundException('Nie znaleziono dostępnego ćwiczenia.');
    }
    const name = dto.name?.trim() || linked?.name;
    if (!name) {
      throw new BadRequestException('Provide exerciseId or a non-empty name.');
    }
    const order =
      dto.order ??
      (await this.nextOrder(
        this.prisma.workoutSessionExercise,
        'sessionId',
        session.id,
      ));
    const entry = await this.prisma.workoutSessionExercise.create({
      data: {
        sessionId,
        exerciseId: linked?.id,
        name,
        exerciseType: linked?.exerciseType,
        order,
      },
      include: { series: true },
    });
    return this.exerciseResponse(entry);
  }

  async updateExercise(
    userId: string,
    sessionId: string,
    exerciseEntryId: number,
    dto: UpdateExerciseDto,
  ) {
    await this.requireActive(userId, sessionId);
    const result = await this.prisma.workoutSessionExercise.updateMany({
      where: { id: exerciseEntryId, sessionId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });
    if (!result.count) throw new NotFoundException('Exercise not found.');
    const entry = await this.prisma.workoutSessionExercise.findFirstOrThrow({
      where: { id: exerciseEntryId, sessionId },
      include: { series: { orderBy: [{ order: 'asc' }, { id: 'asc' }] } },
    });
    return this.exerciseResponse(entry);
  }

  async removeExercise(
    userId: string,
    sessionId: string,
    exerciseEntryId: number,
  ) {
    await this.requireActive(userId, sessionId);
    const result = await this.prisma.workoutSessionExercise.deleteMany({
      where: { id: exerciseEntryId, sessionId },
    });
    if (!result.count) throw new NotFoundException('Exercise not found.');
    return { ok: true };
  }

  async addSeries(
    userId: string,
    sessionId: string,
    exerciseEntryId: number,
    dto: AddSeriesDto,
  ) {
    await this.requireActive(userId, sessionId);
    const exercise = await this.prisma.workoutSessionExercise.findFirst({
      where: { id: exerciseEntryId, sessionId },
      select: { id: true },
    });
    if (!exercise) throw new NotFoundException('Exercise not found.');
    const order =
      dto.order ??
      (await this.nextOrder(
        this.prisma.workoutSeries,
        'sessionExerciseId',
        exerciseEntryId,
      ));
    const series = await this.prisma.workoutSeries.create({
      data: {
        sessionExerciseId: exerciseEntryId,
        ...this.seriesData(dto),
        order,
      },
    });
    return this.seriesResponse(series);
  }

  async updateSeries(
    userId: string,
    sessionId: string,
    seriesId: number,
    dto: UpdateSeriesDto,
  ) {
    await this.requireActive(userId, sessionId);
    const result = await this.prisma.workoutSeries.updateMany({
      where: { id: seriesId, sessionExercise: { sessionId } },
      data: {
        ...this.seriesData(dto),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });
    if (!result.count) throw new NotFoundException('Series not found.');
    const series = await this.prisma.workoutSeries.findFirstOrThrow({
      where: { id: seriesId, sessionExercise: { sessionId } },
    });
    return this.seriesResponse(series);
  }

  async removeSeries(userId: string, sessionId: string, seriesId: number) {
    await this.requireActive(userId, sessionId);
    const result = await this.prisma.workoutSeries.deleteMany({
      where: { id: seriesId, sessionExercise: { sessionId } },
    });
    if (!result.count) throw new NotFoundException('Series not found.');
    return { ok: true };
  }

  async autosave(userId: string, sessionId: string, dto: AutosaveWorkoutDto) {
    await this.requireActive(userId, sessionId);
    await this.prisma.$transaction(async (transaction) => {
      if (dto.name !== undefined) {
        await transaction.workoutSession.updateMany({
          where: { id: sessionId, userId, status: 'ACTIVE' },
          data: { name: dto.name.trim() || null },
        });
      }
      for (const [index, exercise] of (dto.exercises ?? []).entries()) {
        let exerciseId = exercise.id;
        if (exerciseId !== undefined) {
          const existing = await transaction.workoutSessionExercise.findFirst({
            where: { id: exerciseId, sessionId },
            select: { id: true },
          });
          if (!existing) throw new NotFoundException('Exercise not found.');
          await transaction.workoutSessionExercise.update({
            where: { id: exerciseId },
            data: {
              ...(exercise.name !== undefined
                ? { name: exercise.name.trim() }
                : {}),
              ...(exercise.order !== undefined
                ? { order: exercise.order }
                : {}),
            },
          });
        } else {
          if (!exercise.name?.trim()) {
            throw new BadRequestException(
              'New exercises in autosave require a name.',
            );
          }
          const created = await transaction.workoutSessionExercise.create({
            data: {
              sessionId,
              name: exercise.name.trim(),
              order: exercise.order ?? index,
            },
          });
          exerciseId = created.id;
        }

        for (const [seriesIndex, series] of (exercise.series ?? []).entries()) {
          if (series.id !== undefined) {
            const existing = await transaction.workoutSeries.findFirst({
              where: {
                id: series.id,
                sessionExerciseId: exerciseId,
              },
              select: { id: true },
            });
            if (!existing) throw new NotFoundException('Series not found.');
            await transaction.workoutSeries.update({
              where: { id: series.id },
              data: {
                ...this.seriesData(series),
                ...(series.order !== undefined ? { order: series.order } : {}),
              },
            });
          } else {
            await transaction.workoutSeries.create({
              data: {
                sessionExerciseId: exerciseId,
                ...this.seriesData(series),
                order: series.order ?? seriesIndex,
              },
            });
          }
        }
      }
    });
    return this.getOwnedSession(userId, sessionId);
  }

  async finish(userId: string, sessionId: string) {
    const session = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.workoutSession.findFirst({
        where: { id: sessionId, userId },
        include: sessionInclude,
      });
      if (!existing) throw new NotFoundException('Workout not found.');
      if (existing.status === 'CANCELLED') {
        throw new ConflictException('Cancelled workouts cannot be finished.');
      }
      if (existing.status === 'ACTIVE') {
        await transaction.workoutSeries.deleteMany({
          where: {
            sessionExercise: { sessionId },
            isDone: false,
          },
        });
        await transaction.workoutSession.updateMany({
          where: { id: sessionId, userId, status: 'ACTIVE' },
          data: { status: 'COMPLETED', endedAt: new Date() },
        });
      }
      return transaction.workoutSession.findFirstOrThrow({
        where: { id: sessionId, userId },
        include: sessionInclude,
      });
    });
    return this.toResponse(session);
  }

  async cancel(userId: string, sessionId: string) {
    const existing = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: { status: true },
    });
    if (!existing) throw new NotFoundException('Workout not found.');
    if (existing.status === 'COMPLETED') {
      throw new ConflictException('Completed workouts cannot be cancelled.');
    }
    if (existing.status === 'ACTIVE') {
      await this.prisma.workoutSession.updateMany({
        where: { id: sessionId, userId, status: 'ACTIVE' },
        data: { status: 'CANCELLED', endedAt: new Date() },
      });
    }
    return this.getOwnedSession(userId, sessionId);
  }

  async history(userId: string, limit = 50) {
    const sessions = await this.prisma.workoutSession.findMany({
      where: { userId, status: { in: ['COMPLETED', 'CANCELLED'] } },
      include: sessionInclude,
      orderBy: { startedAt: 'desc' },
      take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50,
    });
    return sessions.map((session) => this.toResponse(session));
  }

  async detail(userId: string, sessionId: string) {
    return this.getOwnedSession(userId, sessionId);
  }

  async previousPerformance(userId: string, exerciseId: number) {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id: exerciseId, OR: [{ userId: null }, { userId }] },
      select: { id: true },
    });
    if (!exercise) throw new NotFoundException('Exercise not found.');
    const entries = await this.prisma.workoutSessionExercise.findMany({
      where: {
        exerciseId,
        session: { userId, status: 'COMPLETED' },
      },
      include: {
        session: { select: { id: true, name: true, startedAt: true } },
        series: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
      },
      orderBy: { session: { startedAt: 'desc' } },
      take: 100,
    });
    const latestSessionId = entries[0]?.sessionId;
    const latest = entries.filter(
      (entry) => entry.sessionId === latestSessionId,
    );
    return {
      exerciseId,
      sessions: latest.map((entry) => ({
        sessionId: entry.session.id,
        sessionName: entry.session.name,
        startedAt: entry.session.startedAt,
        exerciseName: entry.name,
        series: entry.series.map((series) => this.seriesResponse(series)),
      })),
    };
  }

  private async requireActive(userId: string, sessionId: string) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Active workout not found.');
    return session;
  }

  private async getOwnedSession(userId: string, sessionId: string) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      include: sessionInclude,
    });
    if (!session) throw new NotFoundException('Workout not found.');
    return this.toResponse(session);
  }

  private async nextOrder(
    delegate: {
      aggregate: (args: {
        where: Record<string, unknown>;
        _max: { order: true };
      }) => Promise<{ _max: { order: number | null } }>;
    },
    field: string,
    parentId: string | number,
  ) {
    const result = await delegate.aggregate({
      where: { [field]: parentId },
      _max: { order: true },
    });
    return (result._max.order ?? -1) + 1;
  }

  private seriesData(dto: Partial<SeriesInputDto>) {
    return {
      ...(dto.reps !== undefined ? { reps: dto.reps } : {}),
      ...(dto.weight !== undefined
        ? {
            weight:
              dto.weight === null
                ? null
                : new Prisma.Decimal(dto.weight).toDecimalPlaces(2),
          }
        : {}),
      ...(dto.durationSeconds !== undefined
        ? { durationSeconds: dto.durationSeconds }
        : {}),
      ...(dto.distance !== undefined
        ? {
            distance:
              dto.distance === null
                ? null
                : new Prisma.Decimal(dto.distance).toDecimalPlaces(2),
          }
        : {}),
      ...(dto.restSeconds !== undefined
        ? { restSeconds: dto.restSeconds }
        : {}),
      ...(dto.rpe !== undefined
        ? {
            rpe:
              dto.rpe === null
                ? null
                : new Prisma.Decimal(dto.rpe).toDecimalPlaces(1),
          }
        : {}),
      ...(dto.rir !== undefined ? { rir: dto.rir } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.isDone !== undefined ? { isDone: dto.isDone } : {}),
    };
  }

  private seriesResponse(series: {
    id: number;
    order: number;
    reps: number | null;
    weight: Prisma.Decimal | null;
    durationSeconds: number | null;
    distance: Prisma.Decimal | null;
    restSeconds: number | null;
    rpe: Prisma.Decimal | null;
    rir: number | null;
    notes: string | null;
    isDone: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...series,
      weight: series.weight?.toFixed(2) ?? null,
      distance: series.distance?.toFixed(2) ?? null,
      rpe: series.rpe?.toFixed(1) ?? null,
    };
  }

  private exerciseResponse(exercise: SessionWithEntries['exercises'][number]) {
    return {
      id: exercise.id,
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      exerciseType: exercise.exerciseType,
      order: exercise.order,
      series: exercise.series.map((series) => this.seriesResponse(series)),
    };
  }

  private toResponse(session: SessionWithEntries) {
    return {
      id: session.id,
      name: session.name,
      templateId: session.templateId,
      templateName: session.templateName,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      exercises: session.exercises.map((exercise) =>
        this.exerciseResponse(exercise),
      ),
    };
  }
}
