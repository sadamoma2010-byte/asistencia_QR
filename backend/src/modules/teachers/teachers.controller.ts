import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { TeachersService } from './teachers.service';
import { CreateTeacherDto, QueryTeachersDto, UpdateTeacherDto } from './dto/teachers.dto';
import { AssignSubjectsDto } from '../subjects/dto/subjects.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getRequestContext } from '../../common/utils/request.util';
import { buildExcel, sendExcel } from '../../common/utils/excel.util';
import { formatDateTime } from '../../common/utils/time.util';
import { MAX_PHOTO_BYTES, imageFileFilter } from '../../common/utils/upload.util';
import { RecordStatus } from '../../common/enums';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('Docentes')
@ApiBearerAuth('access-token')
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  @RequirePermissions('teachers.read')
  @ApiOperation({ summary: 'Listar docentes (paginado, búsqueda y filtros server side)' })
  findAll(@Query() query: QueryTeachersDto) {
    return this.teachersService.findAll(query);
  }

  @Get('options')
  @RequirePermissions('teachers.read', 'schedules.create', 'attendance.create', 'reports.read')
  @ApiOperation({ summary: 'Catálogo de docentes activos para selects' })
  findOptions() {
    return this.teachersService.findOptions();
  }

  @Get('next-code')
  @RequirePermissions('teachers.create')
  @ApiOperation({ summary: 'Sugerir el siguiente código de docente disponible' })
  suggestCode() {
    return this.teachersService.suggestCode();
  }

  @Get('export')
  @RequirePermissions('teachers.export')
  @ApiOperation({ summary: 'Exportar docentes a Excel' })
  async export(@Query() query: QueryTeachersDto, @Res() res: Response) {
    const rows = await this.teachersService.findForExport(query);

    const buffer = await buildExcel({
      sheetName: 'Docentes',
      title: 'Listado de docentes',
      subtitle: `Generado el ${formatDateTime(new Date())} · ${rows.length} registro(s)`,
      columns: [
        { header: 'Código', key: 'code', width: 14 },
        { header: 'Nombres', key: 'firstName', width: 24 },
        { header: 'Apellidos', key: 'lastName', width: 24 },
        { header: 'Documento', key: 'document', width: 18 },
        { header: 'Correo', key: 'email', width: 30 },
        { header: 'Teléfono', key: 'phone', width: 16, value: (r) => r.phone ?? '—' },
        {
          header: 'Asignaturas',
          key: 'subjects',
          width: 40,
          value: (r) => r.subjects.map((s) => s.name).join(', ') || '—',
        },
        { header: 'Horarios', key: 'schedules', width: 12, value: (r) => r._count.schedules },
        { header: 'Cuenta', key: 'user', width: 28, value: (r) => r.user?.email ?? 'Sin cuenta' },
        {
          header: 'Estado',
          key: 'status',
          width: 14,
          value: (r) => (r.status === 'ACTIVE' ? 'Activo' : 'Inactivo'),
        },
      ],
      rows,
    });

    sendExcel(res, buffer, 'docentes');
  }

  @Get(':id')
  @RequirePermissions('teachers.read')
  @ApiOperation({ summary: 'Detalle de un docente con sus asignaturas y horarios' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.findOne(id);
  }

  @Post()
  @RequirePermissions('teachers.create')
  @ApiOperation({ summary: 'Crear un docente' })
  create(
    @Body() dto: CreateTeacherDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.teachersService.create(dto, actor, getRequestContext(req));
  }

  @Patch(':id')
  @RequirePermissions('teachers.update')
  @ApiOperation({ summary: 'Actualizar un docente' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.teachersService.update(id, dto, actor, getRequestContext(req));
  }

  @Patch(':id/subjects')
  @RequirePermissions('teachers.update')
  @ApiOperation({ summary: 'Reemplazar las asignaturas que dicta el docente' })
  assignSubjects(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSubjectsDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.teachersService.assignSubjects(id, dto, actor, getRequestContext(req));
  }

  @Post(':id/photo')
  @RequirePermissions('teachers.update')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: MAX_PHOTO_BYTES },
      fileFilter: imageFileFilter,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { photo: { type: 'string', format: 'binary' } },
      required: ['photo'],
    },
  })
  @ApiOperation({
    summary: 'Subir la fotografía del docente',
    description:
      'Acepta JPG, PNG, WEBP o GIF de hasta 5 MB. La imagen se recorta en cuadrado, ' +
      'se reduce a 512 px y se guarda en formato WEBP.',
  })
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (!photo) throw new BadRequestException('Debe adjuntar una imagen en el campo «photo»');
    return this.teachersService.setPhoto(id, photo.buffer, actor, getRequestContext(req));
  }

  @Delete(':id/photo')
  @RequirePermissions('teachers.update')
  @ApiOperation({ summary: 'Quitar la fotografía del docente' })
  deletePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.teachersService.clearPhoto(id, actor, getRequestContext(req));
  }

  @Patch(':id/activate')
  @RequirePermissions('teachers.activate')
  @ApiOperation({ summary: 'Activar un docente' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.teachersService.setStatus(id, RecordStatus.ACTIVE, actor, getRequestContext(req));
  }

  @Patch(':id/deactivate')
  @RequirePermissions('teachers.deactivate')
  @ApiOperation({ summary: 'Inactivar un docente' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.teachersService.setStatus(id, RecordStatus.INACTIVE, actor, getRequestContext(req));
  }

  @Delete(':id')
  @RequirePermissions('teachers.delete')
  @ApiOperation({ summary: 'Eliminar un docente (soft delete)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.teachersService.remove(id, actor, getRequestContext(req));
  }
}
