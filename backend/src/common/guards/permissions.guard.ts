import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Control de acceso basado en roles (RBAC) mediante permisos granulares.
 * El rol SUPER_ADMIN siempre tiene acceso.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user) throw new ForbiddenException('Acceso denegado');

    if (user.roleName === 'SUPER_ADMIN') return true;

    const granted = required.some((permission) => user.permissions.includes(permission));
    if (!granted) {
      throw new ForbiddenException(
        `No cuenta con los permisos necesarios para esta acción (${required.join(' o ')})`,
      );
    }

    return true;
  }
}
