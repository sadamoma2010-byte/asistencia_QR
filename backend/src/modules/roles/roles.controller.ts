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

import { RolesService } from './roles.service';
import { AssignPermissionsDto, CreateRoleDto, QueryRolesDto, UpdateRoleDto } from './dto/roles.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getRequestContext } from '../../common/utils/request.util';
import { buildExcel, sendExcel } from '../../common/utils/excel.util';
import { formatDateTime } from '../../common/utils/time.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'Listar roles (paginado)' })
  findAll(@Query() query: QueryRolesDto) {
    return this.rolesService.findAll(query);
  }

  @Get('options')
  @RequirePermissions('roles.read', 'users.create', 'users.update')
  @ApiOperation({ summary: 'Catálogo de roles activos para selects' })
  findOptions() {
    return this.rolesService.findOptions();
  }

  @Get('export')
  @RequirePermissions('roles.export')
  @ApiOperation({ summary: 'Exportar roles a Excel' })
  async export(@Query() query: QueryRolesDto, @Res() res: Response) {
    const rows = await this.rolesService.findForExport(query);

    const buffer = await buildExcel({
      sheetName: 'Roles',
      title: 'Listado de roles',
      subtitle: `Generado el ${formatDateTime(new Date())} · ${rows.length} registro(s)`,
      columns: [
        { header: 'Rol', key: 'name', width: 24 },
        { header: 'Descripción', key: 'description', width: 46, value: (r) => r.description ?? '—' },
        { header: 'Usuarios', key: 'users', width: 12, value: (r) => r._count.users },
        { header: 'Permisos', key: 'permissions', width: 12, value: (r) => r._count.permissions },
        { header: 'Sistema', key: 'isSystem', width: 12, value: (r) => (r.isSystem ? 'Sí' : 'No') },
        { header: 'Estado', key: 'status', width: 14, value: (r) => (r.status === 'ACTIVE' ? 'Activo' : 'Inactivo') },
        { header: 'Creado', key: 'createdAt', width: 20, value: (r) => formatDateTime(r.createdAt) },
      ],
      rows,
    });

    sendExcel(res, buffer, 'roles');
  }

  @Get(':id')
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'Detalle de un rol con sus permisos' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @RequirePermissions('roles.create')
  @ApiOperation({ summary: 'Crear un rol' })
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    return this.rolesService.create(dto, actor, getRequestContext(req));
  }

  @Patch(':id')
  @RequirePermissions('roles.update')
  @ApiOperation({ summary: 'Actualizar un rol' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.rolesService.update(id, dto, actor, getRequestContext(req));
  }

  @Patch(':id/permissions')
  @RequirePermissions('roles.update')
  @ApiOperation({ summary: 'Reemplazar los permisos asignados al rol' })
  assignPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.rolesService.assignPermissions(id, dto, actor, getRequestContext(req));
  }

  @Patch(':id/activate')
  @RequirePermissions('roles.activate')
  @ApiOperation({ summary: 'Activar un rol' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.rolesService.setStatus(id, RecordStatus.ACTIVE, actor, getRequestContext(req));
  }

  @Patch(':id/deactivate')
  @RequirePermissions('roles.deactivate')
  @ApiOperation({ summary: 'Inactivar un rol' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.rolesService.setStatus(id, RecordStatus.INACTIVE, actor, getRequestContext(req));
  }

  @Delete(':id')
  @RequirePermissions('roles.delete')
  @ApiOperation({ summary: 'Eliminar un rol (soft delete)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.rolesService.remove(id, actor, getRequestContext(req));
  }
}
