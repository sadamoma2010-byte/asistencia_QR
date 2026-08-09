import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AttendanceStatus, AttendanceType, RecordStatus } from '../../common/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service';
import { buildPaginatedResult } from '../../common/dto/paginated-result.dto';
import { dateOnly, dayRange, localDateKey } from '../../common/utils/time.util';
import { QueryReportDto } from './dto/reports.dto';

const REPORT_EXPORT_LIMIT = 5000;

export interface TeacherReportRow {
  teacherId: string;
  code: string;
  fullName: string;
  document: string;
  shifts: string;
  totalRecords: number;
  checkIns: number;
  checkOuts: number;
  onTime: number;
  late: number;
  earlyDeparture: number;
  totalLateMinutes: number;
  punctualityRate: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // ─────────────────────── Dashboard (KPIs) ────────────────────────

  async getDashboard() {
    const timezone = await this.settings.getString(SETTING_KEYS.TIMEZONE, 'America/Bogota');
    const today = dateOnly(localDateKey(new Date(), timezone));

    const weekStart = new Date(today);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);

    const [
      totalTeachers,
      activeTeachers,
      recordsToday,
      lateToday,
      checkInsToday,
      openCheckIns,
      weekly,
      recent,
      topLate,
    ] = await Promise.all([
      this.prisma.teacher.count({ where: { deletedAt: null } }),
      this.prisma.teacher.count({ where: { deletedAt: null, status: RecordStatus.ACTIVE } }),
      this.prisma.attendance.count({ where: { date: today, deletedAt: null } }),
      this.prisma.attendance.count({
        where: { date: today, deletedAt: null, status: AttendanceStatus.LATE },
      }),
      this.prisma.attendance.findMany({
        where: { date: today, deletedAt: null, type: AttendanceType.CHECK_IN },
        distinct: ['teacherId'],
        select: { teacherId: true },
      }),
      this.prisma.attendance.count({
        where: { date: today, deletedAt: null, type: AttendanceType.CHECK_IN },
      }),
      this.prisma.attendance.groupBy({
        by: ['date', 'status'],
        where: { date: { gte: weekStart, lte: today }, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.attendance.findMany({
        where: { deletedAt: null },
        orderBy: { registeredAt: 'desc' },
        take: 8,
        include: {
          teacher: { select: { id: true, code: true, firstName: true, lastName: true } },
          schedule: { select: { shift: { select: { name: true } } } },
        },
      }),
      this.prisma.attendance.groupBy({
        by: ['teacherId'],
        where: { date: { gte: weekStart, lte: today }, deletedAt: null, status: AttendanceStatus.LATE },
        _count: { _all: true },
        orderBy: { _count: { teacherId: 'desc' } },
        take: 5,
      }),
    ]);

    const checkOutsToday = await this.prisma.attendance.count({
      where: { date: today, deletedAt: null, type: AttendanceType.CHECK_OUT },
    });

    const attendancesToday = checkInsToday.length;
    const onTimeToday = recordsToday - lateToday;

    // Serie de los últimos 7 días
    const trend: { date: string; onTime: number; late: number; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - i);
      const key = day.toISOString().slice(0, 10);

      const dayRows = weekly.filter((w) => w.date.toISOString().slice(0, 10) === key);
      const late = dayRows.find((r) => r.status === AttendanceStatus.LATE)?._count._all ?? 0;
      const total = dayRows.reduce((sum, r) => sum + r._count._all, 0);

      trend.push({ date: key, onTime: total - late, late, total });
    }

    // Nombres de los docentes con más tardanzas
    const topLateTeachers = topLate.length
      ? await this.prisma.teacher
          .findMany({
            where: { id: { in: topLate.map((t) => t.teacherId) } },
            select: { id: true, code: true, firstName: true, lastName: true },
          })
          .then((teachers) =>
            topLate.map((row) => {
              const teacher = teachers.find((t) => t.id === row.teacherId);
              return {
                teacherId: row.teacherId,
                code: teacher?.code ?? '—',
                fullName: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Docente eliminado',
                lateCount: row._count._all,
              };
            }),
          )
      : [];

    return {
      date: localDateKey(new Date(), timezone),
      kpis: {
        totalTeachers,
        activeTeachers,
        attendancesToday,
        lateToday,
        recordsToday,
        onTimeToday,
        checkInsToday: openCheckIns,
        checkOutsToday,
        punctualityRate: recordsToday > 0 ? Math.round((onTimeToday / recordsToday) * 100) : 100,
        coverageRate:
          activeTeachers > 0 ? Math.round((attendancesToday / activeTeachers) * 100) : 0,
        pendingCheckOut: Math.max(0, openCheckIns - checkOutsToday),
      },
      trend,
      recent,
      topLateTeachers,
    };
  }

  // ──────────────────── Reporte consolidado ────────────────────────

  private buildWhere(query: QueryReportDto): Prisma.AttendanceWhereInput {
    const range = dayRange(query.dateFrom, query.dateTo);
    return {
      deletedAt: null,
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.shiftId ? { schedule: { shiftId: query.shiftId } } : {}),
      ...(range.gte || range.lte ? { date: range } : {}),
    };
  }

  /** Reporte agregado por docente, con paginación en memoria sobre el agrupado. */
  async getTeacherReport(query: QueryReportDto) {
    const rows = await this.buildTeacherRows(query);
    const start = (query.page - 1) * query.limit;
    return buildPaginatedResult(
      rows.slice(start, start + query.limit),
      rows.length,
      query.page,
      query.limit,
    );
  }

  async buildTeacherRows(query: QueryReportDto): Promise<TeacherReportRow[]> {
    const records = await this.prisma.attendance.findMany({
      where: this.buildWhere(query),
      take: REPORT_EXPORT_LIMIT,
      include: {
        teacher: { select: { id: true, code: true, firstName: true, lastName: true, document: true } },
        schedule: { select: { shift: { select: { name: true } } } },
      },
    });

    const grouped = new Map<string, TeacherReportRow & { shiftSet: Set<string> }>();

    for (const record of records) {
      const key = record.teacherId;
      const entry =
        grouped.get(key) ??
        ({
          teacherId: key,
          code: record.teacher.code,
          fullName: `${record.teacher.firstName} ${record.teacher.lastName}`,
          document: record.teacher.document,
          shifts: '',
          shiftSet: new Set<string>(),
          totalRecords: 0,
          checkIns: 0,
          checkOuts: 0,
          onTime: 0,
          late: 0,
          earlyDeparture: 0,
          totalLateMinutes: 0,
          punctualityRate: 0,
        } as TeacherReportRow & { shiftSet: Set<string> });

      entry.totalRecords += 1;
      if (record.type === AttendanceType.CHECK_IN) entry.checkIns += 1;
      else entry.checkOuts += 1;

      if (record.status === AttendanceStatus.LATE) {
        entry.late += 1;
        entry.totalLateMinutes += Math.max(0, record.minutesDiff);
      } else if (record.status === AttendanceStatus.EARLY_DEPARTURE) {
        entry.earlyDeparture += 1;
      } else {
        entry.onTime += 1;
      }

      if (record.schedule?.shift.name) entry.shiftSet.add(record.schedule.shift.name);
      grouped.set(key, entry);
    }

    return [...grouped.values()]
      .map(({ shiftSet, ...row }) => ({
        ...row,
        shifts: [...shiftSet].sort().join(', ') || '—',
        punctualityRate:
          row.totalRecords > 0 ? Math.round((row.onTime / row.totalRecords) * 100) : 0,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  }

  /** Detalle plano de marcaciones para la exportación. */
  findDetailForExport(query: QueryReportDto) {
    return this.prisma.attendance.findMany({
      where: this.buildWhere(query),
      orderBy: [{ date: 'desc' }, { registeredAt: 'desc' }],
      take: REPORT_EXPORT_LIMIT,
      include: {
        teacher: { select: { code: true, firstName: true, lastName: true, document: true } },
        schedule: {
          select: {
            checkInTime: true,
            checkOutTime: true,
            toleranceMinutes: true,
            shift: { select: { name: true } },
          },
        },
      },
    });
  }
}
