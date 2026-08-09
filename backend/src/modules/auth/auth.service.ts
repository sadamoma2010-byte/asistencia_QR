import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuditAction, RecordStatus } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser, RequestContext } from '../../common/types/authenticated-user';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

const MODULE = 'Autenticación';
const GENERIC_ERROR = 'Credenciales incorrectas';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────────── Login ─────────────────────────────

  async login(dto: LoginDto, ctx: RequestContext) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        teacher: { select: { id: true, code: true, status: true } },
      },
    });

    // Respuesta uniforme: no se revela si el correo existe.
    if (!user) throw new UnauthorizedException(GENERIC_ERROR);

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(
        `Cuenta bloqueada temporalmente por intentos fallidos. Intente en ${minutes} minuto(s).`,
      );
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      await this.registerFailedAttempt(user);
      throw new UnauthorizedException(GENERIC_ERROR);
    }

    // RN001 / RN002 — solo un usuario activo puede operar
    if (user.status !== RecordStatus.ACTIVE) {
      throw new ForbiddenException('El usuario se encuentra inactivo. Contacte al administrador.');
    }
    if (user.role.status !== RecordStatus.ACTIVE || user.role.deletedAt) {
      throw new ForbiddenException('El rol asignado se encuentra inactivo.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const permissions = user.role.permissions
      .filter((rp) => rp.permission.status === RecordStatus.ACTIVE && !rp.permission.deletedAt)
      .map((rp) => rp.permission.code);

    const tokens = await this.issueTokens(user, ctx);

    await this.audit.log({
      action: AuditAction.LOGIN,
      module: MODULE,
      description: `Inicio de sesión de ${user.firstName} ${user.lastName}`,
      entityId: user.id,
      user: { id: user.id, email: user.email, fullName: `${user.firstName} ${user.lastName}` },
      context: ctx,
    });

    return {
      ...tokens,
      user: this.toProfile(user, permissions),
    };
  }

  private async registerFailedAttempt(user: User): Promise<void> {
    const max = this.config.get<number>('security.loginMaxAttempts', 5);
    const lockMinutes = this.config.get<number>('security.loginLockMinutes', 15);
    const attempts = user.failedLoginAttempts + 1;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= max ? new Date(Date.now() + lockMinutes * 60_000) : null,
      },
    });
  }

  // ──────────────────────────── Tokens ─────────────────────────────

  private async issueTokens(
    user: Pick<User, 'id' | 'email'> & { role: { name: string } },
    ctx: RequestContext,
  ): Promise<AuthTokens> {
    const basePayload = { sub: user.id, email: user.email, role: user.role.name };

    const accessToken = await this.jwt.signAsync(
      { ...basePayload, type: 'access' } satisfies JwtPayload,
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { ...basePayload, type: 'refresh' } satisfies JwtPayload,
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
      },
    );

    // El refresh token se persiste hasheado; nunca en claro.
    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        expiresAt: new Date(decoded.exp * 1000),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get<string>('jwt.accessExpiresIn', '15m'),
    };
  }

  async refresh(refreshToken: string, ctx: RequestContext) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Sesión expirada. Inicie sesión nuevamente.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token no válido para esta operación');
    }

    const stored = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    let matched: (typeof stored)[number] | undefined;
    for (const candidate of stored) {
      if (await bcrypt.compare(refreshToken, candidate.tokenHash)) {
        matched = candidate;
        break;
      }
    }
    if (!matched) throw new UnauthorizedException('Sesión no válida. Inicie sesión nuevamente.');

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, status: RecordStatus.ACTIVE },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        teacher: { select: { id: true, code: true, status: true } },
      },
    });
    if (!user) throw new UnauthorizedException('El usuario ya no está habilitado');

    // Rotación: el token usado se revoca de inmediato.
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    const permissions = user.role.permissions
      .filter((rp) => rp.permission.status === RecordStatus.ACTIVE && !rp.permission.deletedAt)
      .map((rp) => rp.permission.code);

    const tokens = await this.issueTokens(user, ctx);
    return { ...tokens, user: this.toProfile(user, permissions) };
  }

  async logout(user: AuthenticatedUser, _refreshToken: string | undefined, ctx: RequestContext) {
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      action: AuditAction.LOGOUT,
      module: MODULE,
      description: `Cierre de sesión de ${user.fullName}`,
      entityId: user.id,
      user,
      context: ctx,
    });

    return { message: 'Sesión cerrada correctamente' };
  }

  // ──────────────────────────── Perfil ─────────────────────────────

  async profile(userId: string) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        teacher: { select: { id: true, code: true, status: true } },
      },
    });

    const permissions = user.role.permissions
      .filter((rp) => rp.permission.status === RecordStatus.ACTIVE && !rp.permission.deletedAt)
      .map((rp) => rp.permission.code);

    return this.toProfile(user, permissions);
  }

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto, ctx: RequestContext) {
    const record = await this.prisma.user.findFirstOrThrow({
      where: { id: user.id, deletedAt: null },
    });

    const valid = await bcrypt.compare(dto.currentPassword, record.password);
    if (!valid) throw new BadRequestException('La contraseña actual no es correcta');

    if (await bcrypt.compare(dto.newPassword, record.password)) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    const rounds = this.config.get<number>('security.bcryptRounds', 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(dto.newPassword, rounds),
        mustChangePassword: false,
      },
    });

    // Se invalidan todas las sesiones activas por seguridad.
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `${user.fullName} actualizó su contraseña`,
      entityId: user.id,
      user,
      context: ctx,
    });

    return { message: 'Contraseña actualizada correctamente. Inicie sesión nuevamente.' };
  }

  // ──────────────────────────── Helpers ────────────────────────────

  private toProfile(
    user: User & {
      role: { id: string; name: string; description: string | null };
      teacher?: { id: string; code: string; status: string } | null;
    },
    permissions: string[],
  ) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      document: user.document,
      phone: user.phone,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      role: { id: user.role.id, name: user.role.name, description: user.role.description },
      permissions,
      teacher: user.teacher ?? null,
    };
  }
}
