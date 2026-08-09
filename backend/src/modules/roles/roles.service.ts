import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditAction, RecordStatus } from '../../common/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildOrderBy, buildSearchFilter } from '../../common/utils/query.util';
import { buildPaginatedResult } from '../../common/dto/paginated-result.dto';
import type { AuthenticatedUser, RequestContext } from '../../common/types/authenticated-user';
import {
  AssignPermissionsDto,
  CreateRoleDto,
  QueryRolesDto,
  UpdateRoleDto,
} from './dto/roles.dto';

const MODULE = 'Roles';
const SORTABLE = ['createdAt', 'name', 'status'] as const;
const SEARCHABLE = ['name', 'description'] as const;
const EXPORT_LIMIT = 1000;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private buildWhere(query: QueryRolesDto): Prisma.RoleWhereInput {
    const or = buildSearchFilter(query.search, SEARCHABLE);
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(or ? { OR: or } : {}),
    };
  }

  async findAll(query: QueryRolesDto) {
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
        skip: query.skip,
        take: query.limit,
        include: {
          _count: { select: { users: true, permissions: true } },
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  /** Catálogo simplificado para selects del frontend. */
  findOptions() {
    return this.prisma.role.findMany({
      where: { deletedAt: null, status: RecordStatus.ACTIVE },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException('El rol no existe');

    return {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
      permissionIds: role.permissions.map((rp) => rp.permissionId),
    };
  }

  findForExport(query: QueryRolesDto) {
    return this.prisma.role.findMany({
      where: this.buildWhere(query),
      orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
      take: EXPORT_LIMIT,
      include: { _count: { select: { users: true, permissions: true } } },
    });
  }

  // ─────────────────────────── Mutaciones ──────────────────────────

  async create(dto: CreateRoleDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const existing = await this.prisma.role.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (existing) throw new ConflictException('Ya existe un rol con ese nombre');

    const created = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        status: dto.status ?? RecordStatus.ACTIVE,
        ...(dto.permissionIds?.length
          ? { permissions: { create: dto.permissionIds.map((permissionId) => ({ permissionId })) } }
          : {}),
      },
      include: { _count: { select: { users: true, permissions: true } } },
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      module: MODULE,
      description: `Creó el rol ${created.name}`,
      entityId: created.id,
      metadata: { permissions: dto.permissionIds?.length ?? 0 },
      user: actor,
      context: ctx,
    });

    return created;
  }

  async update(id: string, dto: UpdateRoleDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.role.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('El rol no existe');

    // Los roles del sistema conservan su nombre; sus permisos sí son configurables.
    if (current.isSystem && dto.name && dto.name !== current.name) {
      throw new BadRequestException('No es posible renombrar un rol del sistema');
    }
    if (dto.name && dto.name !== current.name) {
      const duplicated = await this.prisma.role.findFirst({
        where: { name: dto.name, deletedAt: null, NOT: { id } },
      });
      if (duplicated) throw new ConflictException('Ya existe un rol con ese nombre');
    }
    if (current.name === 'SUPER_ADMIN' && dto.status === RecordStatus.INACTIVE) {
      throw new BadRequestException('El rol SUPER_ADMIN no puede inactivarse');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (dto.permissionIds.length) {
          // Sin `skipDuplicates`: SQLite no lo admite. El borrado previo y la
          // validación @ArrayUnique del DTO ya garantizan que no haya repetidos.
          await tx.rolePermission.createMany({
            data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          });
        }
      }

      return tx.role.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description || null } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: { _count: { select: { users: true, permissions: true } } },
      });
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Actualizó el rol ${updated.name}`,
      entityId: id,
      metadata: { changes: dto },
      user: actor,
      context: ctx,
    });

    return updated;
  }

  async assignPermissions(
    id: string,
    dto: AssignPermissionsDto,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    const role = await this.prisma.role.findFirst({ where: { id, deletedAt: null } });
    if (!role) throw new NotFoundException('El rol no existe');

    const valid = await this.prisma.permission.count({
      where: { id: { in: dto.permissionIds }, deletedAt: null },
    });
    if (valid !== dto.permissionIds.length) {
      throw new BadRequestException('Uno o más permisos seleccionados no existen');
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      }),
    ]);

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Asignó ${dto.permissionIds.length} permiso(s) al rol ${role.name}`,
      entityId: id,
      metadata: { permissionIds: dto.permissionIds },
      user: actor,
      context: ctx,
    });

    return this.findOne(id);
  }

  async setStatus(id: string, status: RecordStatus, actor: AuthenticatedUser, ctx: RequestContext) {
    const role = await this.prisma.role.findFirst({ where: { id, deletedAt: null } });
    if (!role) throw new NotFoundException('El rol no existe');

    if (status === RecordStatus.INACTIVE) {
      if (role.name === 'SUPER_ADMIN') {
        throw new BadRequestException('El rol SUPER_ADMIN no puede inactivarse');
      }
      const users = await this.prisma.user.count({
        where: { roleId: id, deletedAt: null, status: RecordStatus.ACTIVE },
      });
      if (users > 0) {
        throw new BadRequestException(
          `No es posible inactivar el rol: tiene ${users} usuario(s) activo(s) asignado(s)`,
        );
      }
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: { status },
      include: { _count: { select: { users: true, permissions: true } } },
    });

    await this.audit.log({
      action: status === RecordStatus.ACTIVE ? AuditAction.ACTIVATE : AuditAction.DEACTIVATE,
      module: MODULE,
      description: `${status === RecordStatus.ACTIVE ? 'Activó' : 'Inactivó'} el rol ${role.name}`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser, ctx: RequestContext) {
    const role = await this.prisma.role.findFirst({ where: { id, deletedAt: null } });
    if (!role) throw new NotFoundException('El rol no existe');

    if (role.isSystem) {
      throw new BadRequestException('Los roles del sistema no pueden eliminarse');
    }

    const users = await this.prisma.user.count({ where: { roleId: id, deletedAt: null } });
    if (users > 0) {
      throw new BadRequestException(
        `No es posible eliminar el rol: tiene ${users} usuario(s) asignado(s)`,
      );
    }

    await this.prisma.role.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: RecordStatus.INACTIVE,
        name: `${role.name}_DEL_${Date.now()}`.slice(0, 60),
      },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      module: MODULE,
      description: `Eliminó el rol ${role.name}`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return { message: 'Rol eliminado correctamente' };
  }
}
