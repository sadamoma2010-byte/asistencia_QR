import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AttendanceStatus,
  AttendanceType,
  asAttendanceStatus,
  asAttendanceType,
} from '../../common/enums';
import type { Response } from 'express';

import { ReportsService } from './reports.service';
import { QueryReportDto } from './dto/reports.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { buildExcel, sendExcel } from '../../common/utils/excel.util';
import { formatDate, formatDateTime } from '../../common/utils/time.util';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  ON_TIME: 'Puntual',
  LATE: 'Tarde',
  EARLY_DEPARTURE: 'Salida anticipada',
};

const TYPE_LABEL: Record<AttendanceType, string> = {
  CHECK_IN: 'Entrada',
  CHECK_OUT: 'Salida',
};

@ApiTags('Reportes')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions('dashboard.read', 'reports.read')
  @ApiOperation({ summary: 'KPIs del dashboard administrativo' })
  getDashboard() {
    return this.reportsService.getDashboard();
  }

  @Get('attendance')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Reporte consolidado de asistencia por docente' })
  getTeacherReport(@Query() query: QueryReportDto) {
    return this.reportsService.getTeacherReport(query);
  }

  @Get('export')
  @RequirePermissions('reports.export')
  @ApiOperation({ summary: 'Exportar el reporte consolidado a Excel' })
  async exportSummary(@Query() query: QueryReportDto, @Res() res: Response) {
    const rows = await this.reportsService.buildTeacherRows(query);
    const period = this.describePeriod(query);

    const buffer = await buildExcel({
      sheetName: 'Consolidado',
      title: 'Reporte consolidado de asistencia docente',
      subtitle: `${period} · Generado el ${formatDateTime(new Date())} · ${rows.length} docente(s)`,
      columns: [
        { header: 'Código', key: 'code', width: 14 },
        { header: 'Docente', key: 'fullName', width: 32 },
        { header: 'Documento', key: 'document', width: 18 },
        { header: 'Jornada(s)', key: 'shifts', width: 22 },
        { header: 'Registros', key: 'totalRecords', width: 12 },
        { header: 'Entradas', key: 'checkIns', width: 12 },
        { header: 'Salidas', key: 'checkOuts', width: 12 },
        { header: 'Puntuales', key: 'onTime', width: 12 },
        { header: 'Tardanzas', key: 'late', width: 12 },
        { header: 'Salidas anticipadas', key: 'earlyDeparture', width: 20 },
        { header: 'Minutos de retraso', key: 'totalLateMinutes', width: 20 },
        { header: '% Puntualidad', key: 'punctualityRate', width: 16, value: (r) => `${r.punctualityRate}%` },
      ],
      rows,
    });

    sendExcel(res, buffer, 'reporte_asistencia');
  }

  @Get('export/detail')
  @RequirePermissions('reports.export')
  @ApiOperation({ summary: 'Exportar el detalle de marcaciones a Excel' })
  async exportDetail(@Query() query: QueryReportDto, @Res() res: Response) {
    const rows = await this.reportsService.findDetailForExport(query);
    const period = this.describePeriod(query);

    const buffer = await buildExcel({
      sheetName: 'Detalle',
      title: 'Detalle de marcaciones',
      subtitle: `${period} · Generado el ${formatDateTime(new Date())} · ${rows.length} registro(s)`,
      columns: [
        { header: 'Fecha', key: 'date', width: 14, value: (r) => formatDate(r.date) },
        {
          header: 'Hora registro',
          key: 'registeredAt',
          width: 16,
          value: (r) => formatDateTime(r.registeredAt).slice(-5),
        },
        { header: 'Código', key: 'code', width: 14, value: (r) => r.teacher.code },
        {
          header: 'Docente',
          key: 'teacher',
          width: 32,
          value: (r) => `${r.teacher.firstName} ${r.teacher.lastName}`,
        },
        { header: 'Documento', key: 'document', width: 18, value: (r) => r.teacher.document },
        { header: 'Jornada', key: 'shift', width: 18, value: (r) => r.schedule?.shift.name ?? '—' },
        { header: 'Tipo', key: 'type', width: 12, value: (r) => TYPE_LABEL[asAttendanceType(r.type)] },
        { header: 'Hora esperada', key: 'expectedTime', width: 16, value: (r) => r.expectedTime ?? '—' },
        {
          header: 'Tolerancia (min)',
          key: 'tolerance',
          width: 18,
          value: (r) => r.schedule?.toleranceMinutes ?? '—',
        },
        { header: 'Diferencia (min)', key: 'minutesDiff', width: 18 },
        {
          header: 'Estado',
          key: 'status',
          width: 20,
          value: (r) => STATUS_LABEL[asAttendanceStatus(r.status)],
        },
        { header: 'IP', key: 'ipAddress', width: 16, value: (r) => r.ipAddress ?? '—' },
        { header: 'Dispositivo', key: 'device', width: 30, value: (r) => r.device ?? '—' },
        { header: 'Observación', key: 'notes', width: 30, value: (r) => r.notes ?? '—' },
      ],
      rows,
    });

    sendExcel(res, buffer, 'detalle_asistencia');
  }

  private describePeriod(query: QueryReportDto): string {
    if (query.dateFrom && query.dateTo) return `Periodo ${query.dateFrom} a ${query.dateTo}`;
    if (query.dateFrom) return `Desde ${query.dateFrom}`;
    if (query.dateTo) return `Hasta ${query.dateTo}`;
    return 'Periodo completo';
  }
}
