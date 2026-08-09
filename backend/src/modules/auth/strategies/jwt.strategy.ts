import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { RecordStatus } from '../../../common/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token no válido para esta operación');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        teacher: { select: { id: true, status: true } },
      },
    });

    if (!user) throw new UnauthorizedException('La sesión ya no es válida');

    // RN002 — un usuario inactivo no puede operar en el sistema
    if (user.status !== RecordStatus.ACTIVE) {
      throw new UnauthorizedException('El usuario se encuentra inactivo');
    }
    if (user.role.status !== RecordStatus.ACTIVE || user.role.deletedAt) {
      throw new UnauthorizedException('El rol asignado se encuentra inactivo');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions: user.role.permissions
        .filter((rp) => rp.permission.status === RecordStatus.ACTIVE && !rp.permission.deletedAt)
        .map((rp) => rp.permission.code),
      teacherId: user.teacher?.id ?? null,
    };
  }
}
