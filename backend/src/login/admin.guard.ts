import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthRequest } from './jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }

    let user: { role: string } | null;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
    } catch (error) {
      this.logger.error(
        'Database role verification failed; administrator access denied.',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Nie można teraz zweryfikować uprawnień. Spróbuj ponownie później.',
      );
    }

    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('Brak uprawnień administratora.');
    }

    return true;
  }
}
