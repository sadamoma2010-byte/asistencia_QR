import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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

import { UsersService } from './users.service';
import { CreateUserDto, QueryUsersDto, ResetPasswordDto, UpdateUserDto } from './dto/users.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getRequestContext } from '../../common/utils/request.util';
import { buildExcel, sendExcel } from '../../common/utils/excel.util';
import { formatDateTime } from '../../common/utils/time.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('Usuarios')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Listar usuarios (paginado, búsqueda y filtros server side)' })
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get('export')
  @RequirePermissions('users.export')
  @ApiOperation({ summary: 'Exportar usuarios a Excel' })
  async export(@Query() query: QueryUsersDto, @Res() res: Response) {
    const rows = await this.usersService.findForExport(query);

    const buffer = await buildExcel({
      sheetName: 'Usuarios',
      title: 'Listado de usuarios',
      subtitle: `Generado el ${formatDateTime(new Date())} · ${rows.length} registro(s)`,
      columns: [
        { header: 'Nombres', key: 'firstName', width: 24 },
        { header: 'Apellidos', key: 'lastName', width: 24 },
        { header: 'Documento', key: 'document', width: 18 },
        { header: 'Correo', key: 'email', width: 30 },
        { header: 'Teléfono', key: 'phone', width: 16, value: (r) => r.phone ?? '—' },
        { header: 'Rol', key: 'role', width: 18, value: (r) => r.role.name },
        { header: 'Estado', key: 'status', width: 14, value: (r) => (r.status === 'ACTIVE' ? 'Activo' : 'Inactivo') },
        {
          header: 'Último ingreso',
          key: 'lastLoginAt',
          width: 20,
          value: (r) => (r.lastLoginAt ? formatDateTime(r.lastLoginAt) : 'Nunca'),
        },
        { header: 'Creado', key: 'createdAt', width: 20, value: (r) => formatDateTime(r.createdAt) },
      ],
      rows,
    });

    sendExcel(res, buffer, 'usuarios');
  }

  @Get(':id')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Detalle de un usuario' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermissions('users.create')
  @ApiOperation({ summary: 'Crear un usuario' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.usersService.create(dto, actor, getRequestContext(req));
  }

  @Patch(':id')
  @RequirePermissions('users.update')
  @ApiOperation({ summary: 'Actualizar un usuario' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.usersService.update(id, dto, actor, getRequestContext(req));
  }

  @Patch(':id/activate')
  @RequirePermissions('users.activate')
  @ApiOperation({ summary: 'Activar un usuario' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.usersService.setStatus(id, RecordStatus.ACTIVE, actor, getRequestContext(req));
  }

  @Patch(':id/deactivate')
  @RequirePermissions('users.deactivate')
  @ApiOperation({ summary: 'Inactivar un usuario' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.usersService.setStatus(id, RecordStatus.INACTIVE, actor, getRequestContext(req));
  }

  @Patch(':id/reset-password')
  @RequirePermissions('users.reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablecer la contraseña de un usuario' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.usersService.resetPassword(id, dto, actor, getRequestContext(req));
  }

  @Delete(':id')
  @RequirePermissions('users.delete')
  @ApiOperation({ summary: 'Eliminar un usuario (soft delete)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.usersService.remove(id, actor, getRequestContext(req));
  }
}
