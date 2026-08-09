import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AttendanceStatus, AttendanceType } from '../../../common/enums';

import { BasePaginationDto } from '../../../common/dto/pagination.dto';

export class RegisterAttendanceDto {
  @ApiProperty({ enum: AttendanceType, description: 'CHECK_IN = entrada · CHECK_OUT = salida' })
  @IsEnum(AttendanceType, { message: 'El tipo de marcación no es válido' })
  type!: AttendanceType;

  @ApiPropertyOptional({
    description:
      'Docente a registrar. Si se omite, se usa el docente vinculado al usuario autenticado.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Debe seleccionar un docente válido' })
  teacherId?: string;

  @ApiPropertyOptional({ description: 'Observación opcional de la marcación' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;
}

export class BulkDeleteAttendanceDto {
  @ApiProperty({
    type: [String],
    description: 'Identificadores de las marcaciones a eliminar (borrado lógico)',
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Debe seleccionar al menos una marcación' })
  @ArrayMaxSize(500, { message: 'No se pueden eliminar más de 500 marcaciones a la vez' })
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids!: string[];

  @ApiPropertyOptional({ description: 'Motivo de la eliminación, se guarda en la auditoría' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason?: string;
}

export class DeleteByTeacherDto {
  @ApiProperty({
    type: [String],
    description: 'Docentes cuyas marcaciones se eliminarán dentro del periodo indicado',
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Debe seleccionar al menos un docente' })
  @ArrayUnique()
  @IsUUID('4', { each: true })
  teacherIds!: string[];

  @ApiPropertyOptional({ description: 'Fecha inicial (YYYY-MM-DD)' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Fecha final (YYYY-MM-DD)' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Motivo de la eliminación, se guarda en la auditoría' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason?: string;
}

export class QueryAttendanceDto extends BasePaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por docente' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por jornada' })
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @ApiPropertyOptional({ enum: AttendanceType, description: 'Entrada o salida' })
  @IsOptional()
  @IsEnum(AttendanceType)
  type?: AttendanceType;

  @ApiPropertyOptional({ enum: AttendanceStatus, description: 'Puntual, tarde o salida anticipada' })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ description: 'Fecha inicial (YYYY-MM-DD)', example: '2026-08-01' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Fecha final (YYYY-MM-DD)', example: '2026-08-31' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}
