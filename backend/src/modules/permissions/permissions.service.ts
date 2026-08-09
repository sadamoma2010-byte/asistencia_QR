import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditAction, RecordStatus } from '../../common/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildOrderBy, buildSearchFilter } from '../../common/utils/query.util';
import { buildPaginatedResult } from '../../common/dto/paginated-result.dto';
import type { AuthenticatedUser, RequestContext } from '../../common/types/authenticated-user';
import {
  CreatePermissionDto,
  QueryPermissionsDto,
  UpdatePermissionDto,
} from './dto/permissions.dto';

const MODULE = 'Permisos';
const SORTABLE = ['createdAt', 'code', 'name', 'module', 'status'] as const;
const SEARCHABLE = ['code', 'name', 'module', 'description'] as const;
const EXPORT_LIMIT = 2000;

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private buildWhere(query: QueryPermissionsDto): Prisma.PermissionWhereInput {
    const or = buildSearchFilter(query.search, SEARCHABLE);
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.module ? { module: query.module } : {}),
      ...(or ? { OR: or } : {}),
    };
  }

  async findAll(query: QueryPermissionsDto) {
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.permission.findMany({
        where,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
        skip: query.skip,
        take: query.limit,
        include: { _count: { select: { roles: true } } },
      }),
      this.prisma.permission.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  /** Permisos activos agrupados por módulo, para la matriz de asignación a roles. */
  async findGrouped() {
    const permissions = await this.prisma.permission.findMany({
      where: { deletedAt: null, status: RecordStatus.ACTIVE },
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, name: true, module: true, description: true },
    });

    const groups = new Map<string, typeof permissions>();
    for (const permission of permissions) {
      const bucket = groups.get(permission.module) ?? [];
      bucket.push(permission);
      groups.set(permission.module, bucket);
    }

    return [...groups.entries()].map(([module, items]) => ({ module, permissions: items }));
  }

  async listModules(): Promise<string[]> {
    const rows = await this.prisma.permission.findMany({
      where: { deletedAt: null },
      distinct: ['module'],
      select: { module: true },
      orderBy: { module: 'asc' },
    });
    return rows.map((r) => r.module);
  }

  async findOne(id: string) {
    const permission = await this.prisma.permission.findFirst({
      where: { id, deletedAt: null },
      include: { roles: { include: { role: { select: { id: true, name: true } } } } },
    });
    if (!permission) throw new NotFoundException('El permiso no existe');

    return { ...permission, roles: permission.roles.map((rp) => rp.role) };
  }

  findForExport(query: QueryPermissionsDto) {
    return this.prisma.permission.findMany({
      where: this.buildWhere(query),
      orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
      take: EXPORT_LIMIT,
      include: { _count: { select: { roles: true } } },
    });
  }

  // ─────────────────────────── Mutaciones ──────────────────────────

  async create(dto: CreatePermissionDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const existing = await this.prisma.permission.findFirst({
      where: { code: dto.code, deletedAt: null },
    });
    if (existing) throw new ConflictException('Ya existe un permiso con ese código');

    const created = await this.prisma.permission.create({
      data: {
        code: dto.code,
        name: dto.name,
        module: dto.module,
        description: dto.description ?? null,
        status: dto.status ?? RecordStatus.ACTIVE,
      },
      include: { _count: { select: { roles: true } } },
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      module: MODULE,
      description: `Creó el permiso ${created.code}`,
      entityId: created.id,
      user: actor,
      context: ctx,
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdatePermissionDto,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    const current = await this.prisma.permission.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('El permiso no existe');

    if (current.isSystem && dto.code && dto.code !== current.code) {
      throw new BadRequestException('No es posible cambiar el código de un permiso del sistema');
    }
    if (dto.code && dto.code !== current.code) {
      const duplicated = await this.prisma.permission.findFirst({
        where: { code: dto.code, deletedAt: null, NOT: { id } },
      });
      if (duplicated) throw new ConflictException('Ya existe un permiso con ese código');
    }

    const updated = await this.prisma.permission.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.module !== undefined ? { module: dto.module } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { _count: { select: { roles: true } } },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Actualizó el permiso ${updated.code}`,
      entityId: id,
      metadata: { changes: dto },
      user: actor,
      context: ctx,
    });

    return updated;
  }

  async setStatus(id: string, status: RecordStatus, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.permission.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('El permiso no existe');

    const updated = await this.prisma.permission.update({
      where: { id },
      data: { status },
      include: { _count: { select: { roles: true } } },
    });

    await this.audit.log({
      action: status === RecordStatus.ACTIVE ? AuditAction.ACTIVATE : AuditAction.DEACTIVATE,
      module: MODULE,
      description: `${status === RecordStatus.ACTIVE ? 'Activó' : 'Inactivó'} el permiso ${current.code}`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.permission.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('El permiso no existe');

    if (current.isSystem) {
      throw new BadRequestException('Los permisos del sistema no pueden eliminarse');
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { permissionId: id } }),
      this.prisma.permission.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: RecordStatus.INACTIVE,
          code: `${current.code}.del.${Date.now()}`.slice(0, 80),
        },
      }),
    ]);

    await this.audit.log({
      action: AuditAction.DELETE,
      module: MODULE,
      description: `Eliminó el permiso ${current.code}`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return { message: 'Permiso eliminado correctamente' };
  }
}
