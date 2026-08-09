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

import { ShiftsService } from './shifts.service';
import { CreateShiftDto, QueryShiftsDto, UpdateShiftDto } from './dto/shifts.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getRequestContext } from '../../common/utils/request.util';
import { buildExcel, sendExcel } from '../../common/utils/excel.util';
import { formatDateTime } from '../../common/utils/time.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('Jornadas')
@ApiBearerAuth('access-token')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @RequirePermissions('shifts.read')
  @ApiOperation({ summary: 'Listar jornadas (paginado)' })
  findAll(@Query() query: QueryShiftsDto) {
    return this.shiftsService.findAll(query);
  }

  @Get('options')
  @RequirePermissions('shifts.read', 'schedules.create', 'reports.read')
  @ApiOperation({ summary: 'Catálogo de jornadas activas para selects' })
  findOptions() {
    return this.shiftsService.findOptions();
  }

  @Get('export')
  @RequirePermissions('shifts.export')
  @ApiOperation({ summary: 'Exportar jornadas a Excel' })
  async export(@Query() query: QueryShiftsDto, @Res() res: Response) {
    const rows = await this.shiftsService.findForExport(query);

    const buffer = await buildExcel({
      sheetName: 'Jornadas',
      title: 'Listado de jornadas',
      subtitle: `Generado el ${formatDateTime(new Date())} · ${rows.length} registro(s)`,
      columns: [
        { header: 'Jornada', key: 'name', width: 24 },
        { header: 'Descripción', key: 'description', width: 48, value: (r) => r.description ?? '—' },
        { header: 'Horarios', key: 'schedules', width: 12, value: (r) => r._count.schedules },
        { header: 'Estado', key: 'status', width: 14, value: (r) => (r.status === 'ACTIVE' ? 'Activa' : 'Inactiva') },
        { header: 'Creada', key: 'createdAt', width: 20, value: (r) => formatDateTime(r.createdAt) },
      ],
      rows,
    });

    sendExcel(res, buffer, 'jornadas');
  }

  @Get(':id')
  @RequirePermissions('shifts.read')
  @ApiOperation({ summary: 'Detalle de una jornada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.shiftsService.findOne(id);
  }

  @Post()
  @RequirePermissions('shifts.create')
  @ApiOperation({ summary: 'Crear una jornada' })
  create(@Body() dto: CreateShiftDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    return this.shiftsService.create(dto, actor, getRequestContext(req));
  }

  @Patch(':id')
  @RequirePermissions('shifts.update')
  @ApiOperation({ summary: 'Actualizar una jornada' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.shiftsService.update(id, dto, actor, getRequestContext(req));
  }

  @Patch(':id/activate')
  @RequirePermissions('shifts.activate')
  @ApiOperation({ summary: 'Activar una jornada' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.shiftsService.setStatus(id, RecordStatus.ACTIVE, actor, getRequestContext(req));
  }

  @Patch(':id/deactivate')
  @RequirePermissions('shifts.deactivate')
  @ApiOperation({ summary: 'Inactivar una jornada' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.shiftsService.setStatus(id, RecordStatus.INACTIVE, actor, getRequestContext(req));
  }

  @Delete(':id')
  @RequirePermissions('shifts.delete')
  @ApiOperation({ summary: 'Eliminar una jornada (soft delete)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.shiftsService.remove(id, actor, getRequestContext(req));
  }
}
