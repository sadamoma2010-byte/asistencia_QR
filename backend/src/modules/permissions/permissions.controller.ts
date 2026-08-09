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

import { PermissionsService } from './permissions.service';
import {
  CreatePermissionDto,
  QueryPermissionsDto,
  UpdatePermissionDto,
} from './dto/permissions.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getRequestContext } from '../../common/utils/request.util';
import { buildExcel, sendExcel } from '../../common/utils/excel.util';
import { formatDateTime } from '../../common/utils/time.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('Permisos')
@ApiBearerAuth('access-token')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Listar permisos (paginado)' })
  findAll(@Query() query: QueryPermissionsDto) {
    return this.permissionsService.findAll(query);
  }

  @Get('grouped')
  @RequirePermissions('permissions.read', 'roles.read')
  @ApiOperation({ summary: 'Permisos activos agrupados por módulo (matriz de asignación)' })
  findGrouped() {
    return this.permissionsService.findGrouped();
  }

  @Get('modules')
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Módulos disponibles en el catálogo de permisos' })
  listModules() {
    return this.permissionsService.listModules();
  }

  @Get('export')
  @RequirePermissions('permissions.export')
  @ApiOperation({ summary: 'Exportar permisos a Excel' })
  async export(@Query() query: QueryPermissionsDto, @Res() res: Response) {
    const rows = await this.permissionsService.findForExport(query);

    const buffer = await buildExcel({
      sheetName: 'Permisos',
      title: 'Catálogo de permisos',
      subtitle: `Generado el ${formatDateTime(new Date())} · ${rows.length} registro(s)`,
      columns: [
        { header: 'Código', key: 'code', width: 26 },
        { header: 'Nombre', key: 'name', width: 34 },
        { header: 'Módulo', key: 'module', width: 18 },
        { header: 'Descripción', key: 'description', width: 44, value: (r) => r.description ?? '—' },
        { header: 'Roles', key: 'roles', width: 10, value: (r) => r._count.roles },
        { header: 'Estado', key: 'status', width: 14, value: (r) => (r.status === 'ACTIVE' ? 'Activo' : 'Inactivo') },
      ],
      rows,
    });

    sendExcel(res, buffer, 'permisos');
  }

  @Get(':id')
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Detalle de un permiso' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.findOne(id);
  }

  @Post()
  @RequirePermissions('permissions.create')
  @ApiOperation({ summary: 'Crear un permiso' })
  create(
    @Body() dto: CreatePermissionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.permissionsService.create(dto, actor, getRequestContext(req));
  }

  @Patch(':id')
  @RequirePermissions('permissions.update')
  @ApiOperation({ summary: 'Actualizar un permiso' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.permissionsService.update(id, dto, actor, getRequestContext(req));
  }

  @Patch(':id/activate')
  @RequirePermissions('permissions.activate')
  @ApiOperation({ summary: 'Activar un permiso' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.permissionsService.setStatus(id, RecordStatus.ACTIVE, actor, getRequestContext(req));
  }

  @Patch(':id/deactivate')
  @RequirePermissions('permissions.deactivate')
  @ApiOperation({ summary: 'Inactivar un permiso' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.permissionsService.setStatus(
      id,
      RecordStatus.INACTIVE,
      actor,
      getRequestContext(req),
    );
  }

  @Delete(':id')
  @RequirePermissions('permissions.delete')
  @ApiOperation({ summary: 'Eliminar un permiso (soft delete)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.permissionsService.remove(id, actor, getRequestContext(req));
  }
}
