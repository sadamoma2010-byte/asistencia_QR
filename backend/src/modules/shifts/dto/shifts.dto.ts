import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RecordStatus } from '../../../common/enums';

import { PaginationDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateShiftDto {
  @ApiProperty({ example: 'Mañana' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la jornada es obligatorio' })
  @MaxLength(80)
  @Transform(trim)
  name!: string;

  @ApiPropertyOptional({ example: 'Jornada de la mañana, de 6:00 a 12:00' })
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

export class UpdateShiftDto extends PartialType(CreateShiftDto) {}

export class QueryShiftsDto extends PaginationDto {}
