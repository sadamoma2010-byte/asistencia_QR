import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { RecordStatus } from '../../../common/enums';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateSubjectDto {
  @ApiProperty({ example: 'MAT-101' })
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'El código solo admite letras, números y guion' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  code!: string;

  @ApiProperty({ example: 'Matemáticas' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(120)
  @Transform(trim)
  name!: string;

  @ApiPropertyOptional({ example: 'Álgebra y geometría para grado décimo' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(trim)
  description?: string;

  @ApiPropertyOptional({ description: 'Intensidad horaria semanal', minimum: 1, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'La intensidad debe ser al menos 1 hora' })
  @Max(60, { message: 'La intensidad no puede superar 60 horas' })
  weeklyHours?: number;

  @ApiPropertyOptional({ example: '#4F46E5', description: 'Color de identificación (hex)' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe tener el formato #RRGGBB' })
  color?: string;

  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}

export class QuerySubjectsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por docente que la dicta' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;
}

export class AssignTeachersDto {
  @ApiProperty({ type: [String], description: 'Listado completo de docentes que dictan la asignatura' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  teacherIds!: string[];
}

export class AssignSubjectsDto {
  @ApiProperty({ type: [String], description: 'Listado completo de asignaturas del docente' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  subjectIds!: string[];
}
