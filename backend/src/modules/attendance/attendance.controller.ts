import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AttendanceService } from './attendance.service';
import {
  BulkDeleteAttendanceDto,
  DeleteByTeacherDto,
  QueryAttendanceDto,
  RegisterAttendanceDto,
} from './dto/attendance.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getRequestContext } from '../../common/utils/request.util';
import { buildExcel, sendExcel } from '../../common/utils/excel.util';
import { formatDate, formatDateTime } from '../../common/utils/time.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('Asistencia')
@ApiBearerAuth('access-token')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ─────────────────────── Registro (QR) ───────────────────────────

  @Post('register')
  @RequirePermissions('attendance.self', 'attendance.create')
  @ApiOperation({
    summary: 'Registrar entrada o salida',
    description:
      'Aplica las reglas RN001–RN009. Un docente solo puede registrar su propia asistencia; ' +
      'quien posee el permiso attendance.create puede registrar en nombre de otro docente.',
  })
  @ApiResponse({ status: 201, description: 'Marcación registrada' })
  @ApiResponse({ status: 400, description: 'Sin horario aplicable o fuera de la ventana permitida' })
  @ApiResponse({ status: 403, description: 'Docente o usuario inactivo' })
  @ApiResponse({ status: 409, description: 'Secuencia de marcación inválida (RN004, RN005, RN006)' })
  register(
    @Body() dto: RegisterAttendanceDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.attendanceService.register(dto, actor, getRequestContext(req));
  }

  // ────────────────────────── Panel docente ────────────────────────

  @Get('me/status')
  @RequirePermissions('attendance.self', 'attendance.read')
  @ApiOperation({ summary: 'Estado de marcación del docente autenticado' })
  selfStatus(@CurrentUser() actor: AuthenticatedUser) {
    return this.attendanceService.getSelfStatus(actor);
  }

  @Get('me/history')
  @RequirePermissions('attendance.self', 'attendance.read')
  @ApiOperation({ summary: 'Historial de marcaciones del docente autenticado' })
  selfHistory(@CurrentUser() actor: AuthenticatedUser, @Query() query: QueryAttendanceDto) {
    return this.attendanceService.getSelfHistory(actor, query);
  }

  // ──────────────────────────── Consultas ──────────────────────────

  @Get()
  @RequirePermissions('attendance.read')
  @ApiOperation({ summary: 'Consultar asistencias (paginado y filtrable server side)' })
  findAll(@Query() query: QueryAttendanceDto) {
    return this.attendanceService.findAll(query);
  }

  @Get('export')
  @RequirePermissions('attendance.export')
  @ApiOperation({ summary: 'Exportar asistencias a Excel' })
  async export(@Query() query: QueryAttendanceDto, @Res() res: Response) {
    const rows = await this.attendanceService.findForExport(query);

    const buffer = await buildExcel({
      sheetName: 'Asistencia',
      title: 'Registro de asistencia docente',
      subtitle: `Generado el ${formatDateTime(new Date())} · ${rows.length} registro(s)`,
      columns: [
        { header: 'Fecha', key: 'date', width: 14, value: (r) => formatDate(r.date) },
        { header: 'Hora', key: 'registeredAt', width: 14, value: (r) => formatDateTime(r.registeredAt).slice(-5) },
        { header: 'Código', key: 'code', width: 14, value: (r) => r.teacher.code },
        {
          header: 'Docente',
          key: 'teacher',
          width: 32,
          value: (r) => `${r.teacher.firstName} ${r.teacher.lastName}`,
        },
        { header: 'Documento', key: 'document', width: 18, value: (r) => r.teacher.document },
        { header: 'Jornada', key: 'shift', width: 18, value: (r) => r.schedule?.shift.name ?? '—' },
        { header: 'Tipo', key: 'type', width: 14, value: (r) => this.attendanceService.typeLabel(r.type) },
        { header: 'Hora esperada', key: 'expectedTime', width: 16, value: (r) => r.expectedTime ?? '—' },
        {
          header: 'Estado',
          key: 'status',
          width: 20,
          value: (r) => this.attendanceService.statusLabel(r.status),
        },
        { header: 'Diferencia (min)', key: 'minutesDiff', width: 18 },
        { header: 'IP', key: 'ipAddress', width: 16, value: (r) => r.ipAddress ?? '—' },
        { header: 'Dispositivo', key: 'device', width: 30, value: (r) => r.device ?? '—' },
      ],
      rows,
    });

    sendExcel(res, buffer, 'asistencia');
  }

  // ────────────────────── Eliminación ──────────────────────────────

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('SUPER_ADMIN')
  @RequirePermissions('attendance.delete')
  @ApiOperation({
    summary: 'Eliminar marcaciones seleccionadas',
    description:
      'Reservado al SUPER_ADMIN. Aplica borrado lógico: la fila permanece en la base ' +
      'con su marca de eliminación y el detalle queda registrado en la auditoría.',
  })
  @ApiResponse({ status: 200, description: 'Marcaciones eliminadas' })
  @ApiResponse({ status: 403, description: 'Solo el SUPER_ADMIN puede eliminar marcaciones' })
  @ApiResponse({ status: 404, description: 'Ninguna de las marcaciones existe' })
  bulkDelete(
    @Body() dto: BulkDeleteAttendanceDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.attendanceService.bulkDelete(dto, actor, getRequestContext(req));
  }

  @Post('delete-by-teacher')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('SUPER_ADMIN')
  @RequirePermissions('attendance.delete')
  @ApiOperation({
    summary: 'Eliminar las marcaciones de los docentes indicados en un periodo',
    description: 'Respalda la selección por filas del módulo de Reportes. Reservado al SUPER_ADMIN.',
  })
  deleteByTeachers(
    @Body() dto: DeleteByTeacherDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.attendanceService.deleteByTeachers(dto, actor, getRequestContext(req));
  }

  @Get(':id')
  @RequirePermissions('attendance.read')
  @ApiOperation({ summary: 'Detalle de una marcación' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.attendanceService.findOne(id);
  }
}
