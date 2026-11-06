import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthRequest } from '../login/jwt-auth.guard';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { CreateWeeklyPlanDto } from './dto/create-weekly-plan.dto';
import { UpdateWeeklyPlanDto } from './dto/update-weekly-plan.dto';
import { WeeklyPlansService } from './weekly-plans.service';

@UseGuards(JwtAuthGuard)
@Controller('weekly-plans')
export class WeeklyPlansController {
  constructor(private readonly weeklyPlansService: WeeklyPlansService) {}

  @Get()
  list(@Req() req: AuthRequest) {
    return this.weeklyPlansService.list(req.user!.sub);
  }

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateWeeklyPlanDto) {
    return this.weeklyPlansService.create(req.user!.sub, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateWeeklyPlanDto,
  ) {
    return this.weeklyPlansService.update(req.user!.sub, id, dto);
  }

  @Delete(':id')
  delete(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.weeklyPlansService.delete(req.user!.sub, id);
  }
}
