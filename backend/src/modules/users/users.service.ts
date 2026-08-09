import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { AuditAction, RecordStatus } from '../../common/enums';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildOrderBy, buildSearchFilter } from '../../common/utils/query.util';
import { buildPaginatedResult } from '../../common/dto/paginated-result.dto';
import type { AuthenticatedUser, RequestContext } from '../../common/types/authenticated-user';
import { CreateUserDto, QueryUsersDto, ResetPasswordDto, UpdateUserDto } from './dto/users.dto';

const MODULE = 'Usuarios';
const SORTABLE = ['createdAt', 'firstName', 'lastName', 'email', 'document', 'status', 'role.name'] as const;
const SEARCHABLE = ['firstName', 'lastName', 'email', 'document', 'phone'] as const;
const EXPORT_LIMIT = 5000;

const SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  document: true,
  email: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
  roleId: true,
  role: { select: { id: true, name: true, description: true } },
  teacher: { select: { id: true, code: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────── Consultas ───────────────────────────

  private buildWhere(query: QueryUsersDto): Prisma.UserWhereInput {
    const or = buildSearchFilter(query.search, SEARCHABLE);
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(or ? { OR: or } : {}),
    };
  }

  async findAll(query: QueryUsersDto) {
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: SELECT,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: SELECT });
    if (!user) throw new NotFoundException('El usuario no existe');
    return user;
  }

  findForExport(query: QueryUsersDto) {
    return this.prisma.user.findMany({
      where: this.buildWhere(query),
      select: SELECT,
      orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
      take: EXPORT_LIMIT,
    });
  }

  // ─────────────────────────── Mutaciones ──────────────────────────

  async create(dto: CreateUserDto, actor: AuthenticatedUser, ctx: RequestContext) {
    await this.assertUnique(dto.email, dto.document);
    await this.assertRoleExists(dto.roleId);

    const rounds = this.config.get<number>('security.bcryptRounds', 12);
    const created = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        document: dto.document,
        email: dto.email,
        phone: dto.phone ?? null,
        password: await bcrypt.hash(dto.password, rounds),
        roleId: dto.roleId,
        status: dto.status ?? RecordStatus.ACTIVE,
      },
      select: SELECT,
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      module: MODULE,
      description: `Creó el usuario ${created.firstName} ${created.lastName} (${created.email})`,
      entityId: created.id,
      metadata: { role: created.role.name, status: created.status },
      user: actor,
      context: ctx,
    });

    return created;
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.findOne(id);

    if (dto.email || dto.document) {
      await this.assertUnique(dto.email, dto.document, id);
    }
    if (dto.roleId && dto.roleId !== current.roleId) {
      await this.assertRoleExists(dto.roleId);
      await this.assertNotLastSuperAdmin(id, 'cambiar el rol de');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.document !== undefined ? { document: dto.document } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      select: SELECT,
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Actualizó el usuario ${updated.firstName} ${updated.lastName} (${updated.email})`,
      entityId: id,
      metadata: { changes: dto },
      user: actor,
      context: ctx,
    });

    return updated;
  }

  async setStatus(
    id: string,
    status: RecordStatus,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    const current = await this.findOne(id);

    if (status === RecordStatus.INACTIVE) {
      if (id === actor.id) throw new BadRequestException('No puede inactivar su propio usuario');
      await this.assertNotLastSuperAdmin(id, 'inactivar');
    }

    const updated = await this.prisma.user.update({ where: { id }, data: { status }, select: SELECT });

    // Al inactivar se revocan las sesiones vigentes (RN002)
    if (status === RecordStatus.INACTIVE) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.log({
      action: status === RecordStatus.ACTIVE ? AuditAction.ACTIVATE : AuditAction.DEACTIVATE,
      module: MODULE,
      description: `${status === RecordStatus.ACTIVE ? 'Activó' : 'Inactivó'} al usuario ${current.firstName} ${current.lastName}`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.findOne(id);

    if (id === actor.id) throw new BadRequestException('No puede eliminar su propio usuario');
    await this.assertNotLastSuperAdmin(id, 'eliminar');

    // Soft delete: el correo y el documento se liberan para reutilización
    const stamp = Date.now();
    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: RecordStatus.INACTIVE,
        email: `${current.email}.deleted.${stamp}`,
        document: `${current.document}.del.${stamp}`.slice(0, 30),
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      module: MODULE,
      description: `Eliminó el usuario ${current.firstName} ${current.lastName} (${current.email})`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return { message: 'Usuario eliminado correctamente' };
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    const current = await this.findOne(id);
    const rounds = this.config.get<number>('security.bcryptRounds', 12);

    await this.prisma.user.update({
      where: { id },
      data: {
        password: await bcrypt.hash(dto.newPassword, rounds),
        mustChangePassword: dto.mustChangePassword ?? true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Restableció la contraseña de ${current.firstName} ${current.lastName}`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return { message: 'Contraseña restablecida correctamente' };
  }

  // ──────────────────────────── Validaciones ───────────────────────

  private async assertUnique(email?: string, document?: string, excludeId?: string) {
    const conditions: Prisma.UserWhereInput[] = [];
    if (email) conditions.push({ email });
    if (document) conditions.push({ document });
    if (conditions.length === 0) return;

    const existing = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: conditions,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { email: true, document: true },
    });

    if (existing) {
      throw new ConflictException(
        existing.email === email
          ? 'Ya existe un usuario con ese correo'
          : 'Ya existe un usuario con ese documento',
      );
    }
  }

  private async assertRoleExists(roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, deletedAt: null, status: RecordStatus.ACTIVE },
    });
    if (!role) throw new BadRequestException('El rol seleccionado no existe o está inactivo');
  }

  /** Impide dejar al sistema sin un SUPER_ADMIN activo. */
  private async assertNotLastSuperAdmin(userId: string, action: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { role: { select: { name: true } } },
    });
    if (user?.role.name !== 'SUPER_ADMIN') return;

    const remaining = await this.prisma.user.count({
      where: {
        deletedAt: null,
        status: RecordStatus.ACTIVE,
        role: { name: 'SUPER_ADMIN' },
        NOT: { id: userId },
      },
    });

    if (remaining === 0) {
      throw new BadRequestException(
        `No es posible ${action} al único Super Administrador activo del sistema`,
      );
    }
  }
}
