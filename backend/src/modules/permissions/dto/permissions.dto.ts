import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { RecordStatus } from '../../../common/enums';

import { PaginationDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePermissionDto {
  @ApiProperty({ example: 'reports.export', description: 'Formato módulo.acción' })
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @MaxLength(80)
  @Matches(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/, {
    message: 'El código debe seguir el formato módulo.acción en minúsculas (ej. reports.export)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  code!: string;

  @ApiProperty({ example: 'Exportar reportes' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(120)
  @Transform(trim)
  name!: string;

  @ApiProperty({ example: 'Reportes' })
  @IsString()
  @IsNotEmpty({ message: 'El módulo es obligatorio' })
  @MaxLength(60)
  @Transform(trim)
  module!: string;

  @ApiPropertyOptional({ example: 'Permite descargar los reportes en formato Excel' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(trim)
  description?: string;

  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {}

export class QueryPermissionsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por módulo', example: 'Usuarios' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  module?: string;
}
