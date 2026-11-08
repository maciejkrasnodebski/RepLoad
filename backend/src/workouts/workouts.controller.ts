import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthRequest } from '../login/jwt-auth.guard';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import {
  AddExerciseDto,
  AddSeriesDto,
  AutosaveWorkoutDto,
  StartWorkoutDto,
  UpdateExerciseDto,
  UpdateSeriesDto,
} from './dto/workout.dto';
import { WorkoutsService } from './workouts.service';

@UseGuards(JwtAuthGuard)
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Get('current')
  current(@Req() req: AuthRequest) {
    return this.workouts.current(req.user!.sub);
  }

  @Post('start')
  start(@Req() req: AuthRequest, @Body() dto: StartWorkoutDto) {
    return this.workouts.start(req.user!.sub, dto);
  }

  @Get('history')
  history(@Req() req: AuthRequest, @Query('limit') limit?: string) {
    return this.workouts.history(
      req.user!.sub,
      limit === undefined ? 50 : Number.parseInt(limit, 10),
    );
  }

  @Get('exercises/:exerciseId/previous')
  previousPerformance(
    @Req() req: AuthRequest,
    @Param('exerciseId', new ParseUUIDPipe({ version: '4' }))
    exerciseId: string,
  ) {
    return this.workouts.previousPerformance(req.user!.sub, exerciseId);
  }

  @Post(':sessionId/exercises')
  addExercise(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body() dto: AddExerciseDto,
  ) {
    return this.workouts.addExercise(req.user!.sub, sessionId, dto);
  }

  @Patch(':sessionId/autosave')
  autosave(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body() dto: AutosaveWorkoutDto,
  ) {
    return this.workouts.autosave(req.user!.sub, sessionId, dto);
  }

  @Patch(':sessionId/exercises/:entryId')
  updateExercise(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Param('entryId', new ParseUUIDPipe({ version: '4' })) entryId: string,
    @Body() dto: UpdateExerciseDto,
  ) {
    return this.workouts.updateExercise(req.user!.sub, sessionId, entryId, dto);
  }

  @Delete(':sessionId/exercises/:entryId')
  removeExercise(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Param('entryId', new ParseUUIDPipe({ version: '4' })) entryId: string,
  ) {
    return this.workouts.removeExercise(req.user!.sub, sessionId, entryId);
  }

  @Post(':sessionId/exercises/:entryId/series')
  addSeries(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Param('entryId', new ParseUUIDPipe({ version: '4' })) entryId: string,
    @Body() dto: AddSeriesDto,
  ) {
    return this.workouts.addSeries(req.user!.sub, sessionId, entryId, dto);
  }

  @Patch(':sessionId/series/:seriesId')
  updateSeries(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Param('seriesId', new ParseUUIDPipe({ version: '4' })) seriesId: string,
    @Body() dto: UpdateSeriesDto,
  ) {
    return this.workouts.updateSeries(req.user!.sub, sessionId, seriesId, dto);
  }

  @Delete(':sessionId/series/:seriesId')
  removeSeries(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Param('seriesId', new ParseUUIDPipe({ version: '4' })) seriesId: string,
  ) {
    return this.workouts.removeSeries(req.user!.sub, sessionId, seriesId);
  }

  @Post(':sessionId/finish')
  finish(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' }))
    sessionId: string,
  ) {
    return this.workouts.finish(req.user!.sub, sessionId);
  }

  @Post(':sessionId/cancel')
  cancel(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' }))
    sessionId: string,
  ) {
    return this.workouts.cancel(req.user!.sub, sessionId);
  }

  @Get(':sessionId')
  detail(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' }))
    sessionId: string,
  ) {
    return this.workouts.detail(req.user!.sub, sessionId);
  }

  @Delete(':sessionId')
  deleteHistoryEntry(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' }))
    sessionId: string,
  ) {
    return this.workouts.deleteHistoryEntry(req.user!.sub, sessionId);
  }
}
