import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoginModule } from './login/login.module';
import { PrismaModule } from './prisma/prisma.module';
import { ExercisesModule } from './exercises/exercises.module';
import { TemplatesModule } from './templates/templates.module';
import { WeeklyPlansModule } from './weekly-plans/weekly-plans.module';
import { WorkoutsModule } from './workouts/workouts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LoginModule,
    ExercisesModule,
    TemplatesModule,
    WeeklyPlansModule,
    WorkoutsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
