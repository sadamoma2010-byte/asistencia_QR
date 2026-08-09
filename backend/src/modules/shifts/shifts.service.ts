import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditAction, RecordStatus } from '../../common/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildOrderBy, buildSearchFilter } from '../../common/utils/query.util';
import { buildPaginatedResult } from '../../common/dto/paginated-result.dto';
import type { AuthenticatedUser, RequestContext } from '../../common/types/authenticated-user';
import { CreateShiftDto, QueryShiftsDto, UpdateShiftDto } from './dto/shifts.dto';

const MODULE = 'Jornadas';
const SORTABLE = ['createdAt', 'name', 'status'] as const;
const SEARCHABLE = ['name', 'description'] as const;
const EXPORT_LIMIT = 1000;

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private buildWhere(query: QueryShiftsDto): Prisma.ShiftWhereInput {
    const or = buildSearchFilter(query.search, SEARCHABLE);
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(or ? { OR: or } : {}),
    };
  }

  async findAll(query: QueryShiftsDto) {
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.shift.findMany({
        where,
        include: { _count: { select: { schedules: { where: { deletedAt: null } } } } },
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.shift.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  findOptions() {
    return this.prisma.shift.findMany({
      where: { deletedAt: null, status: RecordStatus.ACTIVE },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { schedules: { where: { deletedAt: null } } } } },
    });
    if (!shift) throw new NotFoundException('La jornada no existe');
    return shift;
  }

  findForExport(query: QueryShiftsDto) {
    return this.prisma.shift.findMany({
      where: this.buildWhere(query),
      include: { _count: { select: { schedules: { where: { deletedAt: null } } } } },
      orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
      take: EXPORT_LIMIT,
    });
  }

  // ─────────────────────────── Mutaciones ──────────────────────────

  /**
   * Busca una jornada por nombre ignorando mayúsculas y acentos.
   * SQLite no ofrece comparación insensible fuera de ASCII, así que se
   * acota con `contains` y se resuelve la coincidencia exacta en memoria.
   */
  private async findByName(name: string, excludeId?: string) {
    const candidates = await this.prisma.shift.findMany({
      where: {
        name: { contains: name },
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true, name: true },
    });

    const normalize = (value: string) =>
      value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return candidates.find((c) => normalize(c.name) === normalize(name)) ?? null;
  }

  async create(dto: CreateShiftDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const existing = await this.findByName(dto.name);
    if (existing) throw new ConflictException('Ya existe una jornada con ese nombre');

    const created = await this.prisma.shift.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        status: dto.status ?? RecordStatus.ACTIVE,
      },
      include: { _count: { select: { schedules: { where: { deletedAt: null } } } } },
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      module: MODULE,
      description: `Creó la jornada ${created.name}`,
      entityId: created.id,
      user: actor,
      context: ctx,
    });

    return created;
  }

  async update(id: string, dto: UpdateShiftDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.shift.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('La jornada no existe');

    if (dto.name && dto.name.toLowerCase() !== current.name.toLowerCase()) {
      const duplicated = await this.findByName(dto.name, id);
      if (duplicated) throw new ConflictException('Ya existe una jornada con ese nombre');
    }

    const updated = await this.prisma.shift.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { _count: { select: { schedules: { where: { deletedAt: null } } } } },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Actualizó la jornada ${updated.name}`,
      entityId: id,
      metadata: { changes: dto },
      user: actor,
      context: ctx,
    });

    return updated;
  }

  async setStatus(id: string, status: RecordStatus, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.shift.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('La jornada no existe');

    if (status === RecordStatus.INACTIVE) {
      const schedules = await this.prisma.schedule.count({
        where: { shiftId: id, deletedAt: null, status: RecordStatus.ACTIVE },
      });
      if (schedules > 0) {
        throw new BadRequestException(
          `No es posible inactivar la jornada: tiene ${schedules} horario(s) activo(s)`,
        );
      }
    }

    const updated = await this.prisma.shift.update({
      where: { id },
      data: { status },
      include: { _count: { select: { schedules: { where: { deletedAt: null } } } } },
    });

    await this.audit.log({
      action: status === RecordStatus.ACTIVE ? AuditAction.ACTIVATE : AuditAction.DEACTIVATE,
      module: MODULE,
      description: `${status === RecordStatus.ACTIVE ? 'Activó' : 'Inactivó'} la jornada ${current.name}`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.shift.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('La jornada no existe');

    const schedules = await this.prisma.schedule.count({ where: { shiftId: id, deletedAt: null } });
    if (schedules > 0) {
      throw new BadRequestException(
        `No es posible eliminar la jornada: tiene ${schedules} horario(s) asociado(s)`,
      );
    }

    await this.prisma.shift.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: RecordStatus.INACTIVE,
        name: `${current.name} (eliminada ${Date.now()})`.slice(0, 80),
      },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      module: MODULE,
      description: `Eliminó la jornada ${current.name}`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return { message: 'Jornada eliminada correctamente' };
  }
}
