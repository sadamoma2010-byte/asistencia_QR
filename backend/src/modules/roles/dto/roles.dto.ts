import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { RecordStatus } from '../../../common/enums';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateRoleDto {
  @ApiProperty({ example: 'SUPERVISOR' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del rol es obligatorio' })
  @MaxLength(60)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'El nombre debe estar en mayúsculas y solo admite letras, números y guion bajo',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  name!: string;

  @ApiPropertyOptional({ example: 'Supervisa la operación diaria' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @ApiPropertyOptional({ type: [String], description: 'Identificadores de permisos asignados' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class AssignPermissionsDto {
  @ApiProperty({ type: [String], description: 'Listado completo de permisos del rol' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  permissionIds!: string[];
}

export class QueryRolesDto extends PaginationDto {}
