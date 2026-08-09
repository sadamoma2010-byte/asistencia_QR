import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecordStatus } from '../../common/enums';
import type { Request, Response } from 'express';

import { SchedulesService } from './schedules.service';
import { CreateScheduleDto, QuerySchedulesDto, UpdateScheduleDto } from './dto/schedules.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getRequestContext } from '../../common/utils/request.util';
import { buildExcel, sendExcel } from '../../common/utils/excel.util';
import { formatDateTime } from '../../common/utils/time.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('Horarios')
@ApiBearerAuth('access-token')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @RequirePermissions('schedules.read')
  @ApiOperation({ summary: 'Listar horarios (paginado, búsqueda y filtros server side)' })
  findAll(@Query() query: QuerySchedulesDto) {
    return this.schedulesService.findAll(query);
  }

  @Get('export')
  @RequirePermissions('schedules.export')
  @ApiOperation({ summary: 'Exportar horarios a Excel' })
  async export(@Query() query: QuerySchedulesDto, @Res() res: Response) {
    const rows = await this.schedulesService.findForExport(query);

    const buffer = await buildExcel({
      sheetName: 'Horarios',
      title: 'Listado de horarios',
      subtitle: `Generado el ${formatDateTime(new Date())} · ${rows.length} registro(s)`,
      columns: [
        { header: 'Código docente', key: 'code', width: 16, value: (r) => r.teacher.code },
        {
          header: 'Docente',
          key: 'teacher',
          width: 32,
          value: (r) => `${r.teacher.firstName} ${r.teacher.lastName}`,
        },
        { header: 'Jornada', key: 'shift', width: 18, value: (r) => r.shift.name },
        {
          header: 'Asignatura',
          key: 'subject',
          width: 28,
          value: (r) => (r.subject ? `${r.subject.code} · ${r.subject.name}` : '—'),
        },
        { header: 'Día', key: 'dayName', width: 18 },
        { header: 'Entrada', key: 'checkInTime', width: 12 },
        { header: 'Salida', key: 'checkOutTime', width: 12 },
        { header: 'Tolerancia (min)', key: 'toleranceMinutes', width: 18 },
        { header: 'Estado', key: 'status', width: 14, value: (r) => (r.status === 'ACTIVE' ? 'Activo' : 'Inactivo') },
      ],
      rows,
    });

    sendExcel(res, buffer, 'horarios');
  }

  @Get('teacher/:teacherId')
  @RequirePermissions('schedules.read', 'attendance.read')
  @ApiOperation({ summary: 'Horarios activos de un docente' })
  findByTeacher(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
    return this.schedulesService.findByTeacher(teacherId);
  }

  @Get(':id')
  @RequirePermissions('schedules.read')
  @ApiOperation({ summary: 'Detalle de un horario' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulesService.findOne(id);
  }

  @Post()
  @RequirePermissions('schedules.create')
  @ApiOperation({ summary: 'Crear un horario' })
  create(
    @Body() dto: CreateScheduleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.schedulesService.create(dto, actor, getRequestContext(req));
  }

  @Patch(':id')
  @RequirePermissions('schedules.update')
  @ApiOperation({ summary: 'Actualizar un horario' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.schedulesService.update(id, dto, actor, getRequestContext(req));
  }

  @Patch(':id/activate')
  @RequirePermissions('schedules.activate')
  @ApiOperation({ summary: 'Activar un horario' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.schedulesService.setStatus(id, RecordStatus.ACTIVE, actor, getRequestContext(req));
  }

  @Patch(':id/deactivate')
  @RequirePermissions('schedules.deactivate')
  @ApiOperation({ summary: 'Inactivar un horario' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.schedulesService.setStatus(id, RecordStatus.INACTIVE, actor, getRequestContext(req));
  }

  @Delete(':id')
  @RequirePermissions('schedules.delete')
  @ApiOperation({ summary: 'Eliminar un horario (soft delete)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.schedulesService.remove(id, actor, getRequestContext(req));
  }
}
