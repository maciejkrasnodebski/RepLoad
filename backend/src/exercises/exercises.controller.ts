import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthRequest } from '../login/jwt-auth.guard';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { ExercisesService } from './exercises.service';

@UseGuards(JwtAuthGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  search(@Req() req: AuthRequest, @Query('q') query = '') {
    return this.exercisesService.search(req.user!.sub, query);
  }

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateExerciseDto) {
    return this.exercisesService.create(req.user!.sub, dto);
  }
}
