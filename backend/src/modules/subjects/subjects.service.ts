import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditAction, RecordStatus } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildOrderBy, buildSearchFilter } from '../../common/utils/query.util';
import { buildPaginatedResult } from '../../common/dto/paginated-result.dto';
import type { AuthenticatedUser, RequestContext } from '../../common/types/authenticated-user';
import {
  AssignTeachersDto,
  CreateSubjectDto,
  QuerySubjectsDto,
  UpdateSubjectDto,
} from './dto/subjects.dto';

const MODULE = 'Asignaturas';
const SORTABLE = ['createdAt', 'code', 'name', 'weeklyHours', 'status'] as const;
const SEARCHABLE = ['code', 'name', 'description'] as const;
const EXPORT_LIMIT = 5000;

const INCLUDE = {
  // Los contadores excluyen los registros con borrado lógico: de lo contrario
  // la interfaz muestra horarios que en realidad ya no existen.
  _count: {
    select: {
      teachers: true,
      schedules: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.SubjectInclude;

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────── Consultas ───────────────────────────

  private buildWhere(query: QuerySubjectsDto): Prisma.SubjectWhereInput {
    const or = buildSearchFilter(query.search, SEARCHABLE);
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.teacherId ? { teachers: { some: { teacherId: query.teacherId } } } : {}),
      ...(or ? { OR: or } : {}),
    };
  }

  async findAll(query: QuerySubjectsDto) {
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.subject.findMany({
        where,
        include: INCLUDE,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE, 'name'),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.subject.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  /**
   * Catálogo simplificado para selects.
   * Con `teacherId` devuelve solo las asignaturas que dicta ese docente,
   * que es lo que necesita el formulario de horarios.
   */
  findOptions(teacherId?: string) {
    return this.prisma.subject.findMany({
      where: {
        deletedAt: null,
        status: RecordStatus.ACTIVE,
        ...(teacherId ? { teachers: { some: { teacherId } } } : {}),
      },
      select: { id: true, code: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...INCLUDE,
        teachers: {
          include: {
            teacher: {
              select: { id: true, code: true, firstName: true, lastName: true, status: true },
            },
          },
        },
      },
    });
    if (!subject) throw new NotFoundException('La asignatura no existe');

    return { ...subject, teachers: subject.teachers.map((ts) => ts.teacher) };
  }

  findForExport(query: QuerySubjectsDto) {
    return this.prisma.subject.findMany({
      where: this.buildWhere(query),
      include: INCLUDE,
      orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE, 'name'),
      take: EXPORT_LIMIT,
    });
  }

  /** Sugiere el siguiente código disponible con el formato ASG-000. */
  async suggestCode(): Promise<{ code: string }> {
    const last = await this.prisma.subject.findFirst({
      where: { code: { startsWith: 'ASG-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    const next = last ? Number(last.code.replace('ASG-', '')) + 1 : 1;
    return { code: `ASG-${String(Number.isNaN(next) ? 1 : next).padStart(3, '0')}` };
  }

  // ─────────────────────────── Mutaciones ──────────────────────────

  async create(dto: CreateSubjectDto, actor: AuthenticatedUser, ctx: RequestContext) {
    await this.assertCodeAvailable(dto.code);

    const created = await this.prisma.subject.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        weeklyHours: dto.weeklyHours ?? null,
        color: dto.color ?? '#4F46E5',
        status: dto.status ?? RecordStatus.ACTIVE,
      },
      include: INCLUDE,
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      module: MODULE,
      description: `Creó la asignatura ${created.code} — ${created.name}`,
      entityId: created.id,
      user: actor,
      context: ctx,
    });

    return created;
  }

  async update(id: string, dto: UpdateSubjectDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.subject.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('La asignatura no existe');

    if (dto.code && dto.code !== current.code) {
      await this.assertCodeAvailable(dto.code, id);
    }

    const updated = await this.prisma.subject.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.weeklyHours !== undefined ? { weeklyHours: dto.weeklyHours } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: INCLUDE,
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Actualizó la asignatura ${updated.code} — ${updated.name}`,
      entityId: id,
      metadata: { changes: dto },
      user: actor,
      context: ctx,
    });

    return updated;
  }

  /** Reemplaza el listado de docentes que dictan la asignatura. */
  async assignTeachers(
    id: string,
    dto: AssignTeachersDto,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    const subject = await this.prisma.subject.findFirst({ where: { id, deletedAt: null } });
    if (!subject) throw new NotFoundException('La asignatura no existe');

    const valid = await this.prisma.teacher.count({
      where: { id: { in: dto.teacherIds }, deletedAt: null },
    });
    if (valid !== dto.teacherIds.length) {
      throw new BadRequestException('Uno o más docentes seleccionados no existen');
    }

    // Un horario no puede quedar apuntando a una asignatura que el docente ya no dicta
    const orphaned = await this.prisma.schedule.count({
      where: {
        subjectId: id,
        deletedAt: null,
        NOT: { teacherId: { in: dto.teacherIds } },
      },
    });
    if (orphaned > 0) {
      throw new BadRequestException(
        `No es posible retirar esos docentes: ${orphaned} horario(s) siguen usando esta asignatura`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.teacherSubject.deleteMany({ where: { subjectId: id } }),
      ...(dto.teacherIds.length
        ? [
            this.prisma.teacherSubject.createMany({
              data: dto.teacherIds.map((teacherId) => ({ teacherId, subjectId: id })),
            }),
          ]
        : []),
    ]);

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Asignó ${dto.teacherIds.length} docente(s) a la asignatura ${subject.code}`,
      entityId: id,
      metadata: { teacherIds: dto.teacherIds },
      user: actor,
      context: ctx,
    });

    return this.findOne(id);
  }

  async setStatus(id: string, status: RecordStatus, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.subject.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('La asignatura no existe');

    if (status === RecordStatus.INACTIVE) {
      const schedules = await this.prisma.schedule.count({
        where: { subjectId: id, deletedAt: null, status: RecordStatus.ACTIVE },
      });
      if (schedules > 0) {
        throw new BadRequestException(
          `No es posible inactivar la asignatura: tiene ${schedules} horario(s) activo(s)`,
        );
      }
    }

    const updated = await this.prisma.subject.update({
      where: { id },
      data: { status },
      include: INCLUDE,
    });

    await this.audit.log({
      action: status === RecordStatus.ACTIVE ? AuditAction.ACTIVATE : AuditAction.DEACTIVATE,
      module: MODULE,
      description: `${status === RecordStatus.ACTIVE ? 'Activó' : 'Inactivó'} la asignatura ${current.code} — ${current.name}`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.subject.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('La asignatura no existe');

    const schedules = await this.prisma.schedule.count({
      where: { subjectId: id, deletedAt: null },
    });
    if (schedules > 0) {
      throw new BadRequestException(
        `No es posible eliminar la asignatura: tiene ${schedules} horario(s) asociado(s)`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.teacherSubject.deleteMany({ where: { subjectId: id } }),
      this.prisma.subject.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: RecordStatus.INACTIVE,
          code: `${current.code}.DEL.${Date.now()}`.slice(0, 40),
        },
      }),
    ]);

    await this.audit.log({
      action: AuditAction.DELETE,
      module: MODULE,
      description: `Eliminó la asignatura ${current.code} — ${current.name}`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return { message: 'Asignatura eliminada correctamente' };
  }

  // ────────────────────────── Validaciones ─────────────────────────

  private async assertCodeAvailable(code: string, excludeId?: string) {
    const existing = await this.prisma.subject.findFirst({
      where: { code, deletedAt: null, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    if (existing) throw new ConflictException('Ya existe una asignatura con ese código');
  }
}
