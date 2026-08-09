import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditAction, RecordStatus } from '../../common/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildOrderBy, buildSearchFilter } from '../../common/utils/query.util';
import { buildPaginatedResult } from '../../common/dto/paginated-result.dto';
import { DAY_NAMES, timeToMinutes } from '../../common/utils/time.util';
import type { AuthenticatedUser, RequestContext } from '../../common/types/authenticated-user';
import { CreateScheduleDto, QuerySchedulesDto, UpdateScheduleDto } from './dto/schedules.dto';

const MODULE = 'Horarios';
const SORTABLE = ['createdAt', 'dayOfWeek', 'checkInTime', 'checkOutTime', 'status'] as const;
const SEARCHABLE = [
  'teacher.firstName',
  'teacher.lastName',
  'teacher.code',
  'shift.name',
  'subject.name',
  'subject.code',
] as const;
const EXPORT_LIMIT = 5000;

const INCLUDE = {
  teacher: { select: { id: true, code: true, firstName: true, lastName: true, status: true } },
  shift: { select: { id: true, name: true, status: true } },
  subject: { select: { id: true, code: true, name: true, color: true } },
} satisfies Prisma.ScheduleInclude;

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private buildWhere(query: QuerySchedulesDto): Prisma.ScheduleWhereInput {
    const or = buildSearchFilter(query.search, SEARCHABLE);
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.shiftId ? { shiftId: query.shiftId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.dayOfWeek !== undefined ? { dayOfWeek: query.dayOfWeek } : {}),
      ...(or ? { OR: or } : {}),
    };
  }

  async findAll(query: QuerySchedulesDto) {
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.schedule.findMany({
        where,
        include: INCLUDE,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.schedule.count({ where }),
    ]);

    return buildPaginatedResult(
      items.map((s) => ({ ...s, dayName: this.dayLabel(s.dayOfWeek) })),
      total,
      query.page,
      query.limit,
    );
  }

  async findOne(id: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    if (!schedule) throw new NotFoundException('El horario no existe');
    return { ...schedule, dayName: this.dayLabel(schedule.dayOfWeek) };
  }

  /** Horarios activos de un docente (usado por el panel docente). */
  findByTeacher(teacherId: string) {
    return this.prisma.schedule.findMany({
      where: { teacherId, deletedAt: null, status: RecordStatus.ACTIVE },
      include: INCLUDE,
      orderBy: [{ dayOfWeek: 'asc' }, { checkInTime: 'asc' }],
    });
  }

  async findForExport(query: QuerySchedulesDto) {
    const rows = await this.prisma.schedule.findMany({
      where: this.buildWhere(query),
      include: INCLUDE,
      orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
      take: EXPORT_LIMIT,
    });
    return rows.map((s) => ({ ...s, dayName: this.dayLabel(s.dayOfWeek) }));
  }

  // ─────────────────────────── Mutaciones ──────────────────────────

  async create(dto: CreateScheduleDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const dayOfWeek = dto.dayOfWeek ?? null;
    const subjectId = dto.subjectId ?? null;

    await this.assertReferences(dto.teacherId, dto.shiftId);
    await this.assertSubjectBelongsToTeacher(dto.teacherId, subjectId);
    this.assertTimeRange(dto.checkInTime, dto.checkOutTime);
    await this.assertNoOverlap(dto.teacherId, dayOfWeek, dto.checkInTime, dto.checkOutTime);

    const created = await this.prisma.schedule.create({
      data: {
        teacherId: dto.teacherId,
        shiftId: dto.shiftId,
        subjectId,
        dayOfWeek,
        checkInTime: dto.checkInTime,
        checkOutTime: dto.checkOutTime,
        toleranceMinutes: dto.toleranceMinutes ?? 10,
        status: dto.status ?? RecordStatus.ACTIVE,
      },
      include: INCLUDE,
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      module: MODULE,
      description:
        `Creó el horario de ${created.teacher.firstName} ${created.teacher.lastName} ` +
        `(${created.shift.name}, ${this.dayLabel(created.dayOfWeek)} ${created.checkInTime}–${created.checkOutTime})`,
      entityId: created.id,
      user: actor,
      context: ctx,
    });

    return { ...created, dayName: this.dayLabel(created.dayOfWeek) };
  }

  async update(id: string, dto: UpdateScheduleDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.schedule.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('El horario no existe');

    const teacherId = dto.teacherId ?? current.teacherId;
    const shiftId = dto.shiftId ?? current.shiftId;
    const dayOfWeek = dto.dayOfWeek !== undefined ? dto.dayOfWeek : current.dayOfWeek;
    const checkInTime = dto.checkInTime ?? current.checkInTime;
    const checkOutTime = dto.checkOutTime ?? current.checkOutTime;
    const subjectId = dto.subjectId !== undefined ? dto.subjectId : current.subjectId;

    await this.assertReferences(teacherId, shiftId);
    await this.assertSubjectBelongsToTeacher(teacherId, subjectId);
    this.assertTimeRange(checkInTime, checkOutTime);
    await this.assertNoOverlap(teacherId, dayOfWeek, checkInTime, checkOutTime, id);

    const updated = await this.prisma.schedule.update({
      where: { id },
      data: {
        teacherId,
        shiftId,
        subjectId,
        dayOfWeek,
        checkInTime,
        checkOutTime,
        ...(dto.toleranceMinutes !== undefined ? { toleranceMinutes: dto.toleranceMinutes } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: INCLUDE,
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Actualizó el horario de ${updated.teacher.firstName} ${updated.teacher.lastName} (${updated.shift.name})`,
      entityId: id,
      metadata: { changes: dto },
      user: actor,
      context: ctx,
    });

    return { ...updated, dayName: this.dayLabel(updated.dayOfWeek) };
  }

  async setStatus(id: string, status: RecordStatus, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.schedule.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    if (!current) throw new NotFoundException('El horario no existe');

    const updated = await this.prisma.schedule.update({
      where: { id },
      data: { status },
      include: INCLUDE,
    });

    await this.audit.log({
      action: status === RecordStatus.ACTIVE ? AuditAction.ACTIVATE : AuditAction.DEACTIVATE,
      module: MODULE,
      description:
        `${status === RecordStatus.ACTIVE ? 'Activó' : 'Inactivó'} el horario de ` +
        `${current.teacher.firstName} ${current.teacher.lastName} (${current.shift.name})`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return { ...updated, dayName: this.dayLabel(updated.dayOfWeek) };
  }

  async remove(id: string, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.schedule.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    if (!current) throw new NotFoundException('El horario no existe');

    await this.prisma.schedule.update({
      where: { id },
      data: { deletedAt: new Date(), status: RecordStatus.INACTIVE },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      module: MODULE,
      description: `Eliminó el horario de ${current.teacher.firstName} ${current.teacher.lastName} (${current.shift.name})`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return { message: 'Horario eliminado correctamente' };
  }

  // ────────────────────────── Validaciones ─────────────────────────

  private async assertReferences(teacherId: string, shiftId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, deletedAt: null },
    });
    if (!teacher) throw new BadRequestException('El docente seleccionado no existe');

    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, deletedAt: null, status: RecordStatus.ACTIVE },
    });
    if (!shift) throw new BadRequestException('La jornada seleccionada no existe o está inactiva');
  }

  /**
   * La asignatura del horario debe estar entre las que dicta el docente.
   * Evita franjas que declaren una materia que ese docente no imparte.
   */
  private async assertSubjectBelongsToTeacher(teacherId: string, subjectId: string | null) {
    if (!subjectId) return;

    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, deletedAt: null },
      select: { id: true, name: true, status: true },
    });
    if (!subject) throw new BadRequestException('La asignatura seleccionada no existe');
    if (subject.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException(`La asignatura ${subject.name} está inactiva`);
    }

    const assigned = await this.prisma.teacherSubject.findUnique({
      where: { teacherId_subjectId: { teacherId, subjectId } },
    });
    if (!assigned) {
      throw new BadRequestException(
        `El docente no dicta la asignatura ${subject.name}. Asígnesela primero en su ficha.`,
      );
    }
  }

  private assertTimeRange(checkInTime: string, checkOutTime: string) {
    if (timeToMinutes(checkOutTime) <= timeToMinutes(checkInTime)) {
      throw new BadRequestException('La hora de salida debe ser posterior a la hora de entrada');
    }
  }

  /** Un docente no puede tener dos horarios que se crucen el mismo día. */
  private async assertNoOverlap(
    teacherId: string,
    dayOfWeek: number | null,
    checkInTime: string,
    checkOutTime: string,
    excludeId?: string,
  ) {
    const siblings = await this.prisma.schedule.findMany({
      where: {
        teacherId,
        deletedAt: null,
        status: RecordStatus.ACTIVE,
        // `null` aplica a todos los días, por lo que siempre entra en la comparación
        ...(dayOfWeek === null ? {} : { OR: [{ dayOfWeek }, { dayOfWeek: null }] }),
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      include: { shift: { select: { name: true } } },
    });

    const start = timeToMinutes(checkInTime);
    const end = timeToMinutes(checkOutTime);

    const conflict = siblings.find((s) => {
      const otherStart = timeToMinutes(s.checkInTime);
      const otherEnd = timeToMinutes(s.checkOutTime);
      return start < otherEnd && otherStart < end;
    });

    if (conflict) {
      throw new ConflictException(
        `El docente ya tiene un horario que se cruza (${conflict.shift.name}, ` +
          `${this.dayLabel(conflict.dayOfWeek)} ${conflict.checkInTime}–${conflict.checkOutTime})`,
      );
    }
  }

  private dayLabel(dayOfWeek: number | null): string {
    return dayOfWeek === null ? 'Todos los días' : DAY_NAMES[dayOfWeek];
  }
}
