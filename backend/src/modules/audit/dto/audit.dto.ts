import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuditAction } from '../../../common/enums';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAuditDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AuditAction, description: 'Tipo de evento' })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ description: 'Módulo del sistema', example: 'Usuarios' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  module?: string;

  @ApiPropertyOptional({ description: 'Usuario que ejecutó la acción' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Fecha inicial (YYYY-MM-DD)', example: '2026-08-01' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Fecha final (YYYY-MM-DD)', example: '2026-08-31' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}
