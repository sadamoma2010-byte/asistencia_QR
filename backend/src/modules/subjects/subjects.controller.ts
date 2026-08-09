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
import type { Request, Response } from 'express';

import { SubjectsService } from './subjects.service';
import {
  AssignTeachersDto,
  CreateSubjectDto,
  QuerySubjectsDto,
  UpdateSubjectDto,
} from './dto/subjects.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getRequestContext } from '../../common/utils/request.util';
import { buildExcel, sendExcel } from '../../common/utils/excel.util';
import { formatDateTime } from '../../common/utils/time.util';
import { RecordStatus } from '../../common/enums';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('Asignaturas')
@ApiBearerAuth('access-token')
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @RequirePermissions('subjects.read')
  @ApiOperation({ summary: 'Listar asignaturas (paginado, búsqueda y filtros server side)' })
  findAll(@Query() query: QuerySubjectsDto) {
    return this.subjectsService.findAll(query);
  }

  @Get('options')
  @RequirePermissions('subjects.read', 'teachers.update', 'schedules.create', 'schedules.update')
  @ApiOperation({
    summary: 'Catálogo de asignaturas activas para selects',
    description: 'Con `teacherId` devuelve solo las asignaturas que dicta ese docente.',
  })
  findOptions(@Query('teacherId') teacherId?: string) {
    return this.subjectsService.findOptions(teacherId);
  }

  @Get('next-code')
  @RequirePermissions('subjects.create')
  @ApiOperation({ summary: 'Sugerir el siguiente código de asignatura disponible' })
  suggestCode() {
    return this.subjectsService.suggestCode();
  }

  @Get('export')
  @RequirePermissions('subjects.export')
  @ApiOperation({ summary: 'Exportar asignaturas a Excel' })
  async export(@Query() query: QuerySubjectsDto, @Res() res: Response) {
    const rows = await this.subjectsService.findForExport(query);

    const buffer = await buildExcel({
      sheetName: 'Asignaturas',
      title: 'Listado de asignaturas',
      subtitle: `Generado el ${formatDateTime(new Date())} · ${rows.length} registro(s)`,
      columns: [
        { header: 'Código', key: 'code', width: 16 },
        { header: 'Asignatura', key: 'name', width: 32 },
        { header: 'Descripción', key: 'description', width: 44, value: (r) => r.description ?? '—' },
        {
          header: 'Horas/semana',
          key: 'weeklyHours',
          width: 16,
          value: (r) => r.weeklyHours ?? '—',
        },
        { header: 'Docentes', key: 'teachers', width: 12, value: (r) => r._count.teachers },
        { header: 'Horarios', key: 'schedules', width: 12, value: (r) => r._count.schedules },
        {
          header: 'Estado',
          key: 'status',
          width: 14,
          value: (r) => (r.status === 'ACTIVE' ? 'Activa' : 'Inactiva'),
        },
      ],
      rows,
    });

    sendExcel(res, buffer, 'asignaturas');
  }

  @Get(':id')
  @RequirePermissions('subjects.read')
  @ApiOperation({ summary: 'Detalle de una asignatura con sus docentes' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectsService.findOne(id);
  }

  @Post()
  @RequirePermissions('subjects.create')
  @ApiOperation({ summary: 'Crear una asignatura' })
  create(
    @Body() dto: CreateSubjectDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.subjectsService.create(dto, actor, getRequestContext(req));
  }

  @Patch(':id')
  @RequirePermissions('subjects.update')
  @ApiOperation({ summary: 'Actualizar una asignatura' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.subjectsService.update(id, dto, actor, getRequestContext(req));
  }

  @Patch(':id/teachers')
  @RequirePermissions('subjects.update')
  @ApiOperation({ summary: 'Reemplazar los docentes que dictan la asignatura' })
  assignTeachers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTeachersDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.subjectsService.assignTeachers(id, dto, actor, getRequestContext(req));
  }

  @Patch(':id/activate')
  @RequirePermissions('subjects.activate')
  @ApiOperation({ summary: 'Activar una asignatura' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.subjectsService.setStatus(id, RecordStatus.ACTIVE, actor, getRequestContext(req));
  }

  @Patch(':id/deactivate')
  @RequirePermissions('subjects.deactivate')
  @ApiOperation({ summary: 'Inactivar una asignatura' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.subjectsService.setStatus(id, RecordStatus.INACTIVE, actor, getRequestContext(req));
  }

  @Delete(':id')
  @RequirePermissions('subjects.delete')
  @ApiOperation({ summary: 'Eliminar una asignatura (soft delete)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.subjectsService.remove(id, actor, getRequestContext(req));
  }
}
