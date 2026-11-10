import { Module } from '@nestjs/common';
import { LoginModule } from '../login/login.module';
import {
  AdminExercisesController,
  ExercisesController,
} from './exercises.controller';
import { ExercisesService } from './exercises.service';

@Module({
  imports: [LoginModule],
  controllers: [ExercisesController, AdminExercisesController],
  providers: [ExercisesService],
})
export class ExercisesModule {}
