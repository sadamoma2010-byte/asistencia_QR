import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restringe el endpoint a roles concretos, con independencia de los permisos.
 *
 * Se usa para acciones donde no basta con poder asignar un permiso desde el
 * módulo de Roles: por ejemplo, la eliminación de marcaciones de asistencia,
 * que debe quedar reservada al SUPER_ADMIN.
 *
 * @example @RequireRoles('SUPER_ADMIN')
 */
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
