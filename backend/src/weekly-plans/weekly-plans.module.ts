import { Module } from '@nestjs/common';
import { LoginModule } from '../login/login.module';
import { WeeklyPlansController } from './weekly-plans.controller';
import { WeeklyPlansService } from './weekly-plans.service';

@Module({
  imports: [LoginModule],
  controllers: [WeeklyPlansController],
  providers: [WeeklyPlansService],
})
export class WeeklyPlansModule {}
