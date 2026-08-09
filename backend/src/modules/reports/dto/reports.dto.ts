import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { AttendanceStatus, AttendanceType } from '../../../common/enums';

import { BasePaginationDto } from '../../../common/dto/pagination.dto';

export class QueryReportDto extends BasePaginationDto {
  @ApiPropertyOptional({ description: 'Fecha inicial (YYYY-MM-DD)', example: '2026-08-01' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Fecha final (YYYY-MM-DD)', example: '2026-08-31' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Filtrar por docente' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por jornada' })
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @ApiPropertyOptional({ enum: AttendanceStatus, description: 'Puntual, tarde o salida anticipada' })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ enum: AttendanceType, description: 'Entrada o salida' })
  @IsOptional()
  @IsEnum(AttendanceType)
  type?: AttendanceType;
}
