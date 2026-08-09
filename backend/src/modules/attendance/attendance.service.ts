import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Schedule } from '@prisma/client';

import {
  AttendanceStatus,
  AttendanceType,
  AuditAction,
  RecordStatus,
} from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service';
import { buildOrderBy, buildSearchFilter } from '../../common/utils/query.util';
import { buildPaginatedResult } from '../../common/dto/paginated-result.dto';
import {
  DAY_NAMES,
  dateOnly,
  dayRange,
  diffMinutes,
  localDateKey,
  localDayOfWeek,
  localTimeKey,
} from '../../common/utils/time.util';
import type { AuthenticatedUser, RequestContext } from '../../common/types/authenticated-user';
import {
  BulkDeleteAttendanceDto,
  DeleteByTeacherDto,
  QueryAttendanceDto,
  RegisterAttendanceDto,
} from './dto/attendance.dto';

const MODULE = 'Asistencia';
const SORTABLE = ['registeredAt', 'date', 'type', 'status', 'minutesDiff'] as const;
const SEARCHABLE = ['teacher.firstName', 'teacher.lastName', 'teacher.code', 'teacher.document'] as const;
const EXPORT_LIMIT = 10000;

const INCLUDE = {
  teacher: { select: { id: true, code: true, firstName: true, lastName: true, document: true } },
  schedule: {
    select: {
      id: true,
      checkInTime: true,
      checkOutTime: true,
      toleranceMinutes: true,
      dayOfWeek: true,
      shift: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.AttendanceInclude;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  // ─────────────────────── Registro de marcación ───────────────────

  /**
   * Registra una entrada o salida aplicando las reglas de negocio:
   * RN001, RN002 (usuario/docente activo), RN003 (horario obligatorio),
   * RN004, RN005, RN006 (secuencia válida), RN007, RN008 (puntualidad)
   * y RN009 (auditoría).
   */
  async register(dto: RegisterAttendanceDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const now = new Date();
    const timezone = await this.settings.getString(SETTING_KEYS.TIMEZONE, 'America/Bogota');

    const teacherId = this.resolveTeacherId(dto, actor);

    // RN001 / RN002 — el docente debe existir y estar activo
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, deletedAt: null },
      include: { user: { select: { id: true, status: true } } },
    });
    if (!teacher) throw new NotFoundException('El docente no existe');

    if (teacher.status !== RecordStatus.ACTIVE) {
      throw new ForbiddenException(
        'RN002 · El docente se encuentra inactivo y no puede registrar asistencia',
      );
    }
    if (teacher.user && teacher.user.status !== RecordStatus.ACTIVE) {
      throw new ForbiddenException(
        'RN002 · La cuenta de usuario del docente está inactiva y no puede registrar asistencia',
      );
    }

    // RN003 — el docente debe tener un horario aplicable
    const schedule = await this.resolveSchedule(teacherId, now, dto.type, timezone);

    // RN004 / RN005 / RN006 — secuencia válida de marcaciones
    const dateKey = localDateKey(now, timezone);
    await this.assertValidSequence(teacherId, dto.type, dateKey);

    // RN007 / RN008 — evaluación de puntualidad
    const { status, minutesDiff, expectedTime } = this.evaluatePunctuality(
      schedule,
      dto.type,
      localTimeKey(now, timezone),
    );

    const created = await this.prisma.attendance.create({
      data: {
        teacherId,
        scheduleId: schedule.id,
        type: dto.type,
        status,
        date: dateOnly(dateKey),
        registeredAt: now,
        expectedTime,
        minutesDiff,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        device: ctx.device,
        notes: dto.notes ?? null,
        registeredById: actor.id,
      },
      include: INCLUDE,
    });

    // RN009 — auditoría
    await this.audit.log({
      action: AuditAction.ATTENDANCE,
      module: MODULE,
      description:
        `${dto.type === AttendanceType.CHECK_IN ? 'Registró entrada' : 'Registró salida'} de ` +
        `${teacher.firstName} ${teacher.lastName} (${teacher.code}) — ${this.statusLabel(status)}`,
      entityId: created.id,
      metadata: {
        type: dto.type,
        status,
        expectedTime,
        minutesDiff,
        scheduleId: schedule.id,
        onBehalf: actor.teacherId !== teacherId,
      },
      user: actor,
      context: ctx,
    });

    return {
      ...created,
      message: this.buildFeedback(dto.type, status, minutesDiff),
    };
  }

  private resolveTeacherId(dto: RegisterAttendanceDto, actor: AuthenticatedUser): string {
    // Un docente solo puede registrar su propia asistencia.
    const isSelfService =
      !actor.permissions.includes('attendance.create') && actor.roleName !== 'SUPER_ADMIN';

    if (isSelfService) {
      if (!actor.teacherId) {
        throw new ForbiddenException(
          'Su usuario no está vinculado a un docente. Contacte al administrador.',
        );
      }
      if (dto.teacherId && dto.teacherId !== actor.teacherId) {
        throw new ForbiddenException('Solo puede registrar su propia asistencia');
      }
      return actor.teacherId;
    }

    const teacherId = dto.teacherId ?? actor.teacherId;
    if (!teacherId) throw new BadRequestException('Debe indicar el docente a registrar');
    return teacherId;
  }

  /**
   * RN003 — Resuelve el horario aplicable a la marcación.
   * Se elige el horario activo del día cuya hora de referencia esté más cerca
   * del momento actual, dentro de la ventana de marcación configurada.
   */
  private async resolveSchedule(
    teacherId: string,
    now: Date,
    type: AttendanceType,
    timezone: string,
  ): Promise<Schedule> {
    const dayOfWeek = localDayOfWeek(now, timezone);

    const schedules = await this.prisma.schedule.findMany({
      where: {
        teacherId,
        deletedAt: null,
        status: RecordStatus.ACTIVE,
        OR: [{ dayOfWeek }, { dayOfWeek: null }],
        shift: { status: RecordStatus.ACTIVE, deletedAt: null },
      },
    });

    if (schedules.length === 0) {
      throw new BadRequestException(
        `RN003 · No tiene un horario activo asignado para hoy (${DAY_NAMES[dayOfWeek]}). ` +
          'Contacte al administrador.',
      );
    }

    const currentTime = localTimeKey(now, timezone);
    const windowMinutes = await this.settings.getNumber(SETTING_KEYS.ATTENDANCE_WINDOW, 180);

    const ranked = schedules
      .map((schedule) => ({
        schedule,
        distance: Math.abs(
          diffMinutes(
            currentTime,
            type === AttendanceType.CHECK_IN ? schedule.checkInTime : schedule.checkOutTime,
          ),
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    const closest = ranked[0];
    if (closest.distance > windowMinutes) {
      const reference =
        type === AttendanceType.CHECK_IN
          ? closest.schedule.checkInTime
          : closest.schedule.checkOutTime;
      throw new BadRequestException(
        `La marcación está fuera de la ventana permitida. Su horario más cercano es a las ${reference} ` +
          `y la ventana configurada es de ${windowMinutes} minutos.`,
      );
    }

    return closest.schedule;
  }

  /** RN004, RN005 y RN006 — coherencia de la secuencia entrada/salida del día. */
  private async assertValidSequence(teacherId: string, type: AttendanceType, dateKey: string) {
    const last = await this.prisma.attendance.findFirst({
      where: { teacherId, date: dateOnly(dateKey), deletedAt: null },
      orderBy: { registeredAt: 'desc' },
    });

    if (type === AttendanceType.CHECK_IN) {
      // RN004 — no se admiten dos entradas consecutivas
      if (last?.type === AttendanceType.CHECK_IN) {
        throw new ConflictException(
          'RN004 · Ya registró su entrada. Debe registrar la salida antes de una nueva entrada.',
        );
      }
      return;
    }

    // RN006 — no puede haber salida sin una entrada previa
    if (!last) {
      throw new ConflictException(
        'RN006 · No puede registrar la salida sin haber registrado la entrada.',
      );
    }
    // RN005 — no se admiten dos salidas consecutivas
    if (last.type === AttendanceType.CHECK_OUT) {
      throw new ConflictException(
        'RN005 · Ya registró su salida. Debe registrar una nueva entrada primero.',
      );
    }
  }

  /**
   * RN007 — si supera la tolerancia se marca TARDE.
   * RN008 — dentro del horario (incluida la tolerancia) se marca PUNTUAL.
   */
  private evaluatePunctuality(
    schedule: Schedule,
    type: AttendanceType,
    currentTime: string,
  ): { status: AttendanceStatus; minutesDiff: number; expectedTime: string } {
    const expectedTime =
      type === AttendanceType.CHECK_IN ? schedule.checkInTime : schedule.checkOutTime;
    const minutesDiff = diffMinutes(currentTime, expectedTime);

    if (type === AttendanceType.CHECK_IN) {
      return {
        status:
          minutesDiff > schedule.toleranceMinutes ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME,
        minutesDiff,
        expectedTime,
      };
    }

    // Salida anticipada: informativa, no bloquea el registro
    return {
      status:
        minutesDiff < -schedule.toleranceMinutes
          ? AttendanceStatus.EARLY_DEPARTURE
          : AttendanceStatus.ON_TIME,
      minutesDiff,
      expectedTime,
    };
  }

  private buildFeedback(type: AttendanceType, status: AttendanceStatus, minutesDiff: number): string {
    const action = type === AttendanceType.CHECK_IN ? 'Entrada registrada' : 'Salida registrada';

    if (status === AttendanceStatus.LATE) {
      return `${action} con ${minutesDiff} minuto(s) de retraso.`;
    }
    if (status === AttendanceStatus.EARLY_DEPARTURE) {
      return `${action} con ${Math.abs(minutesDiff)} minuto(s) de anticipación.`;
    }
    return `${action} a tiempo. ¡Gracias!`;
  }

  // ─────────────────────────── Consultas ───────────────────────────

  private buildWhere(query: QueryAttendanceDto): Prisma.AttendanceWhereInput {
    const or = buildSearchFilter(query.search, SEARCHABLE);
    const range = dayRange(query.dateFrom, query.dateTo);

    return {
      deletedAt: null,
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.shiftId ? { schedule: { shiftId: query.shiftId } } : {}),
      ...(range.gte || range.lte ? { date: range } : {}),
      ...(or ? { OR: or } : {}),
    };
  }

  async findAll(query: QueryAttendanceDto) {
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        include: INCLUDE,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE, 'registeredAt'),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const record = await this.prisma.attendance.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    if (!record) throw new NotFoundException('El registro de asistencia no existe');
    return record;
  }

  findForExport(query: QueryAttendanceDto) {
    return this.prisma.attendance.findMany({
      where: this.buildWhere(query),
      include: INCLUDE,
      orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE, 'registeredAt'),
      take: EXPORT_LIMIT,
    });
  }

  // ─────────────────────── Eliminación ─────────────────────────────

  /**
   * Elimina marcaciones seleccionadas mediante borrado lógico.
   *
   * La fila permanece en la base con `deletedAt`, de modo que la auditoría
   * sigue siendo verificable: se puede demostrar qué se eliminó y quién lo hizo.
   * Acción reservada al SUPER_ADMIN mediante `RolesGuard`.
   */
  async bulkDelete(dto: BulkDeleteAttendanceDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const records = await this.prisma.attendance.findMany({
      where: { id: { in: dto.ids }, deletedAt: null },
      include: {
        teacher: { select: { code: true, firstName: true, lastName: true } },
        schedule: { select: { shift: { select: { name: true } } } },
      },
    });

    if (records.length === 0) {
      throw new NotFoundException(
        'Las marcaciones seleccionadas no existen o ya fueron eliminadas',
      );
    }

    const timezone = await this.settings.getString(SETTING_KEYS.TIMEZONE, 'America/Bogota');

    await this.prisma.attendance.updateMany({
      where: { id: { in: records.map((r) => r.id) } },
      data: { deletedAt: new Date() },
    });

    // Se conserva el detalle de cada marcación: tras el borrado, la bitácora
    // es el único sitio donde queda constancia legible de lo eliminado.
    const detail = records.map((r) => ({
      id: r.id,
      docente: `${r.teacher.firstName} ${r.teacher.lastName}`,
      codigo: r.teacher.code,
      fecha: localDateKey(r.date, timezone),
      hora: localTimeKey(r.registeredAt, timezone),
      tipo: this.typeLabel(r.type),
      estado: this.statusLabel(r.status),
      jornada: r.schedule?.shift.name ?? null,
    }));

    await this.audit.log({
      action: AuditAction.DELETE,
      module: MODULE,
      description:
        `Eliminó ${records.length} marcación(es) de asistencia` +
        (dto.reason ? ` · Motivo: ${dto.reason}` : ''),
      entityId: records.length === 1 ? records[0].id : null,
      metadata: {
        cantidad: records.length,
        motivo: dto.reason ?? null,
        solicitadas: dto.ids.length,
        marcaciones: detail,
      },
      user: actor,
      context: ctx,
    });

    const omitted = dto.ids.length - records.length;
    return {
      deleted: records.length,
      message:
        `Se eliminaron ${records.length} marcación(es).` +
        (omitted > 0 ? ` ${omitted} ya no estaban disponibles.` : ''),
    };
  }

  /**
   * Elimina todas las marcaciones de los docentes indicados dentro de un periodo.
   * Es la acción que respalda la selección por filas del módulo de Reportes.
   */
  async deleteByTeachers(dto: DeleteByTeacherDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const range = dayRange(dto.dateFrom, dto.dateTo);
    const where: Prisma.AttendanceWhereInput = {
      deletedAt: null,
      teacherId: { in: dto.teacherIds },
      ...(range.gte || range.lte ? { date: range } : {}),
    };

    const [records, teachers] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        select: { id: true, teacherId: true },
      }),
      this.prisma.teacher.findMany({
        where: { id: { in: dto.teacherIds } },
        select: { id: true, code: true, firstName: true, lastName: true },
      }),
    ]);

    if (records.length === 0) {
      throw new NotFoundException(
        'Los docentes seleccionados no tienen marcaciones en el periodo indicado',
      );
    }

    await this.prisma.attendance.updateMany({
      where: { id: { in: records.map((r) => r.id) } },
      data: { deletedAt: new Date() },
    });

    const porDocente = teachers.map((t) => ({
      docente: `${t.firstName} ${t.lastName}`,
      codigo: t.code,
      eliminadas: records.filter((r) => r.teacherId === t.id).length,
    }));

    const periodo =
      dto.dateFrom && dto.dateTo
        ? `${dto.dateFrom} a ${dto.dateTo}`
        : dto.dateFrom
          ? `desde ${dto.dateFrom}`
          : dto.dateTo
            ? `hasta ${dto.dateTo}`
            : 'periodo completo';

    await this.audit.log({
      action: AuditAction.DELETE,
      module: MODULE,
      description:
        `Eliminó ${records.length} marcación(es) de ${teachers.length} docente(s) — ${periodo}` +
        (dto.reason ? ` · Motivo: ${dto.reason}` : ''),
      metadata: {
        cantidad: records.length,
        periodo,
        motivo: dto.reason ?? null,
        docentes: porDocente,
      },
      user: actor,
      context: ctx,
    });

    return {
      deleted: records.length,
      message: `Se eliminaron ${records.length} marcación(es) de ${teachers.length} docente(s).`,
    };
  }

  // ───────────────────── Panel docente (self) ──────────────────────

  /** Estado actual del docente autenticado: qué puede registrar ahora. */
  async getSelfStatus(actor: AuthenticatedUser) {
    if (!actor.teacherId) {
      throw new ForbiddenException('Su usuario no está vinculado a un docente');
    }

    const timezone = await this.settings.getString(SETTING_KEYS.TIMEZONE, 'America/Bogota');
    const now = new Date();
    const dateKey = localDateKey(now, timezone);
    const dayOfWeek = localDayOfWeek(now, timezone);

    const [teacher, todayRecords, schedules] = await Promise.all([
      this.prisma.teacher.findFirst({
        where: { id: actor.teacherId, deletedAt: null },
        select: { id: true, code: true, firstName: true, lastName: true, status: true },
      }),
      this.prisma.attendance.findMany({
        where: { teacherId: actor.teacherId, date: dateOnly(dateKey), deletedAt: null },
        include: INCLUDE,
        orderBy: { registeredAt: 'asc' },
      }),
      this.prisma.schedule.findMany({
        where: {
          teacherId: actor.teacherId,
          deletedAt: null,
          status: RecordStatus.ACTIVE,
          OR: [{ dayOfWeek }, { dayOfWeek: null }],
        },
        include: { shift: { select: { id: true, name: true } } },
        orderBy: { checkInTime: 'asc' },
      }),
    ]);

    const last = todayRecords.at(-1);
    const hasSchedule = schedules.length > 0;

    return {
      teacher,
      date: dateKey,
      dayName: DAY_NAMES[dayOfWeek],
      currentTime: localTimeKey(now, timezone),
      timezone,
      schedules,
      todayRecords,
      lastRecord: last ?? null,
      canCheckIn: hasSchedule && last?.type !== AttendanceType.CHECK_IN,
      canCheckOut: hasSchedule && last?.type === AttendanceType.CHECK_IN,
      blockedReason: !hasSchedule
        ? `RN003 · No tiene un horario activo asignado para hoy (${DAY_NAMES[dayOfWeek]})`
        : null,
    };
  }

  /** Historial reciente del docente autenticado. */
  async getSelfHistory(actor: AuthenticatedUser, query: QueryAttendanceDto) {
    if (!actor.teacherId) {
      throw new ForbiddenException('Su usuario no está vinculado a un docente');
    }
    // Se fuerza el filtro sobre la instancia para conservar el getter `skip`
    query.teacherId = actor.teacherId;
    return this.findAll(query);
  }

  // ──────────────────────────── Etiquetas ──────────────────────────

  // Reciben `string` porque en SQLite la columna es texto; la búsqueda es
  // defensiva para no romper la exportación ante un valor inesperado.
  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      [AttendanceStatus.ON_TIME]: 'Puntual',
      [AttendanceStatus.LATE]: 'Tarde',
      [AttendanceStatus.EARLY_DEPARTURE]: 'Salida anticipada',
    };
    return labels[status] ?? status;
  }

  typeLabel(type: string): string {
    return type === AttendanceType.CHECK_IN ? 'Entrada' : 'Salida';
  }
}
