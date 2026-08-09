import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Exige uno o más permisos para acceder al endpoint (RBAC).
 * Basta con poseer **uno** de los permisos listados.
 *
 * @example @RequirePermissions('users.create')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
