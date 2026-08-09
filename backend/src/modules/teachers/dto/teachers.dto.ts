import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { RecordStatus } from '../../../common/enums';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateTeacherDto {
  @ApiProperty({ example: 'DOC-0001' })
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'El código solo admite letras, números y guion' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  code!: string;

  @ApiProperty({ example: 'Carlos Andrés' })
  @IsString()
  @IsNotEmpty({ message: 'Los nombres son obligatorios' })
  @MaxLength(120)
  @Transform(trim)
  firstName!: string;

  @ApiProperty({ example: 'Ramírez Loaiza' })
  @IsString()
  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  @MaxLength(120)
  @Transform(trim)
  lastName!: string;

  @ApiProperty({ example: '1088456712' })
  @IsString()
  @IsNotEmpty({ message: 'El documento es obligatorio' })
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9.-]+$/, { message: 'El documento solo admite letras, números, punto y guion' })
  @Transform(trim)
  document!: string;

  @ApiProperty({ example: 'carlos.ramirez@datly.local' })
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(180)
  @Transform(lower)
  email!: string;

  @ApiPropertyOptional({ example: '3109876543' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+()\s-]*$/, { message: 'El teléfono solo admite números y los signos + ( ) -' })
  @Transform(trim)
  phone?: string;

  @ApiPropertyOptional({ description: 'Cuenta de acceso vinculada al docente' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Asignaturas que dicta el docente. Deben pertenecer a la misma institución.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  subjectIds?: string[];

  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

}

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {}

export class QueryTeachersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por jornada asignada en su horario' })
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por asignatura que dicta' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}
