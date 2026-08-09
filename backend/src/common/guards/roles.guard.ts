import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Restricción por rol para las acciones más delicadas.
 *
 * A diferencia de `PermissionsGuard`, aquí el SUPER_ADMIN **no** obtiene paso
 * automático: se comprueba su rol como el de cualquier otro. Así, un rol al que
 * alguien le asigne el permiso desde el módulo de Roles sigue sin poder entrar.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user) throw new ForbiddenException('Acceso denegado');

    if (!required.includes(user.roleName)) {
      throw new ForbiddenException(
        `Esta acción está reservada al rol ${required.join(' o ')}. Su rol es ${user.roleName}.`,
      );
    }

    return true;
  }
}
