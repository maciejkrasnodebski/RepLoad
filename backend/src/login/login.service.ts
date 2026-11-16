import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_DURATION_MS } from './login.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class LoginService {
  // Służy do porównania, gdy użytkownik nie istnieje (wyrównuje czas odpowiedzi)
  private readonly dummyHash = bcrypt.hashSync('dummy-password', BCRYPT_ROUNDS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const username = this.normalize(dto.username);

    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new ConflictException('Ta nazwa użytkownika jest już zajęta.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: { username, passwordHash },
        select: { id: true, username: true, role: true },
      });
      return { user, token: await this.sign(user) };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Ta nazwa użytkownika jest już zajęta.');
      }
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const username = this.normalize(dto.username);

    const user = await this.prisma.user.findUnique({ where: { username } });
    const valid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? this.dummyHash,
    );

    if (!user || !valid) {
      throw new UnauthorizedException(
        'Nieprawidłowa nazwa użytkownika lub hasło.',
      );
    }

    const safeUser = { id: user.id, username: user.username, role: user.role };
    return { user: safeUser, token: await this.sign(safeUser) };
  }

  async logout(token?: string) {
    if (!token) return;

    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(token);
    } catch (error) {
      if (
        error instanceof Error &&
        ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(
          error.name,
        )
      ) {
        return;
      }
      throw error;
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('sub' in payload) ||
      typeof payload.sub !== 'string' ||
      !('sid' in payload) ||
      typeof payload.sid !== 'string'
    ) {
      return;
    }

    await this.prisma.authSession.deleteMany({
      where: { id: payload.sid, userId: payload.sub },
    });
  }

  private normalize(username: string) {
    return username.trim().toLowerCase();
  }

  private async sign(user: { id: string; username: string; role: string }) {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const session = await this.prisma.authSession.create({
      data: { userId: user.id, expiresAt },
      select: { id: true },
    });
    return this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      sid: session.id,
    });
  }
}
