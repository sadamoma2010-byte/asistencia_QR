import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditAction } from '../../common/enums';

import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/audit.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { buildExcel, sendExcel } from '../../common/utils/excel.util';
import { formatDateTime } from '../../common/utils/time.util';

const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  ACTIVATE: 'Activación',
  DEACTIVATE: 'Inactivación',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  ATTENDANCE: 'Asistencia',
};

@ApiTags('Auditoría')
@ApiBearerAuth('access-token')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Listar la bitácora de auditoría (paginado y filtrable)' })
  findAll(@Query() query: QueryAuditDto) {
    return this.auditService.findAll(query);
  }

  @Get('modules')
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Módulos presentes en la bitácora' })
  listModules() {
    return this.auditService.listModules();
  }

  @Get('export')
  @RequirePermissions('audit.export')
  @ApiOperation({ summary: 'Exportar la bitácora a Excel' })
  async export(@Query() query: QueryAuditDto, @Res() res: Response) {
    const rows = await this.auditService.findForExport(query);

    const buffer = await buildExcel({
      sheetName: 'Auditoría',
      title: 'Bitácora de auditoría',
      subtitle: `Generado el ${formatDateTime(new Date())} · ${rows.length} registro(s)`,
      columns: [
        { header: 'Fecha y hora', key: 'createdAt', width: 20, value: (r) => formatDateTime(r.createdAt) },
        { header: 'Usuario', key: 'userName', width: 26, value: (r) => r.userName ?? '—' },
        { header: 'Correo', key: 'userEmail', width: 28, value: (r) => r.userEmail ?? '—' },
        { header: 'Acción', key: 'action', width: 18, value: (r) => ACTION_LABEL[r.action] },
        { header: 'Módulo', key: 'module', width: 18 },
        { header: 'Descripción', key: 'description', width: 50 },
        { header: 'IP', key: 'ipAddress', width: 18, value: (r) => r.ipAddress ?? '—' },
        { header: 'Dispositivo', key: 'device', width: 32, value: (r) => r.device ?? '—' },
      ],
      rows,
    });

    sendExcel(res, buffer, 'auditoria');
  }

  @Get(':id')
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Detalle de un registro de auditoría' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditService.findOne(id);
  }
}
