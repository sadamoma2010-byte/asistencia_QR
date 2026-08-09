import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { RecordStatus } from '../enums';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Parámetros comunes de listados server side.
 * `BasePaginationDto` no incluye `status` para que los módulos con un enum
 * de estado propio (por ejemplo Asistencia) puedan definir el suyo.
 */
export class BasePaginationDto {
  @ApiPropertyOptional({ description: 'Página (base 1)', default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Registros por página', default: 10, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({ description: 'Búsqueda de texto libre' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({ description: 'Campo de ordenamiento', default: 'createdAt' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.DESC;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export class PaginationDto extends BasePaginationDto {
  @ApiPropertyOptional({ enum: RecordStatus, description: 'Filtrar por estado' })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
