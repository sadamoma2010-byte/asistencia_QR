import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { RecordStatus } from '../../../common/enums';

import { PaginationDto } from '../../../common/dto/pagination.dto';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TIME_MESSAGE = 'La hora debe tener el formato HH:mm (24 horas)';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Docente al que aplica el horario' })
  @IsUUID('4', { message: 'Debe seleccionar un docente válido' })
  teacherId!: string;

  @ApiProperty({ description: 'Jornada asociada' })
  @IsUUID('4', { message: 'Debe seleccionar una jornada válida' })
  shiftId!: string;

  @ApiPropertyOptional({
    description:
      'Asignatura que se dicta en esta franja. Debe estar entre las que dicta el docente. ' +
      'Envíe `null` para dejar el horario sin asignatura.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Debe seleccionar una asignatura válida' })
  subjectId?: string | null;

  @ApiPropertyOptional({
    description:
      'Día de la semana (0 = domingo … 6 = sábado). Envíe `null` u omítalo para aplicar a todos los días.',
    minimum: 0,
    maximum: 6,
    nullable: true,
    type: Number,
  })
  // El tipo unión evita que `enableImplicitConversion` convierta `null` en 0
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number | null;

  @ApiProperty({ example: '07:00' })
  @Matches(TIME_PATTERN, { message: `Hora de entrada inválida. ${TIME_MESSAGE}` })
  checkInTime!: string;

  @ApiProperty({ example: '13:00' })
  @Matches(TIME_PATTERN, { message: `Hora de salida inválida. ${TIME_MESSAGE}` })
  checkOutTime!: string;

  @ApiPropertyOptional({ description: 'Tolerancia en minutos', default: 10, minimum: 0, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'La tolerancia no puede ser negativa' })
  @Max(120, { message: 'La tolerancia no puede superar los 120 minutos' })
  toleranceMinutes?: number;

  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {}

export class QuerySchedulesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por docente' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por jornada' })
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por asignatura' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por día de la semana', minimum: 0, maximum: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;
}
