import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../login/admin.guard';
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

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get('exercises')
  list(@Query('q') query = '') {
    return this.exercisesService.listGlobal(query);
  }

  @Post('exercises')
  create(@Body() dto: CreateExerciseDto) {
    return this.exercisesService.createGlobal(dto);
  }

  @Patch('exercises/:id')
  update(@Param('id') id: string, @Body() dto: CreateExerciseDto) {
    return this.exercisesService.updateGlobal(id, dto);
  }

  @Delete('exercises/:id')
  remove(@Param('id') id: string) {
    return this.exercisesService.deleteGlobal(id);
  }
}
