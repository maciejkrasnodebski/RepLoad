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
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesService } from './templates.service';

@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  list(@Req() req: AuthRequest) {
    return this.templatesService.list(req.user!.sub);
  }

  @Get(':id')
  get(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.templatesService.get(req.user!.sub, id);
  }

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(req.user!.sub, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(req.user!.sub, id, dto);
  }

  @Delete(':id')
  delete(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.templatesService.delete(req.user!.sub, id);
  }
}
