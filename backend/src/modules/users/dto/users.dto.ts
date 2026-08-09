import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RecordStatus } from '../../../common/enums';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { PASSWORD_MESSAGE, PASSWORD_PATTERN } from '../../auth/dto/auth.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateUserDto {
  @ApiProperty({ example: 'María Fernanda' })
  @IsString()
  @IsNotEmpty({ message: 'Los nombres son obligatorios' })
  @MaxLength(120)
  @Transform(trim)
  firstName!: string;

  @ApiProperty({ example: 'Gómez Restrepo' })
  @IsString()
  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  @MaxLength(120)
  @Transform(trim)
  lastName!: string;

  @ApiProperty({ example: '1094567823' })
  @IsString()
  @IsNotEmpty({ message: 'El documento es obligatorio' })
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9.-]+$/, { message: 'El documento solo admite letras, números, punto y guion' })
  @Transform(trim)
  document!: string;

  @ApiProperty({ example: 'maria.gomez@datly.local' })
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(180)
  @Transform(lower)
  email!: string;

  @ApiPropertyOptional({ example: '3001234567' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+()\s-]*$/, { message: 'El teléfono solo admite números y los signos + ( ) -' })
  @Transform(trim)
  phone?: string;

  @ApiProperty({ example: 'Clave123*', description: PASSWORD_MESSAGE })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password!: string;

  @ApiProperty({ description: 'Identificador del rol' })
  @IsUUID('4', { message: 'Debe seleccionar un rol válido' })
  roleId!: string;

  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {}

export class ResetPasswordDto {
  @ApiProperty({ example: 'NuevaClave123*', description: PASSWORD_MESSAGE })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword!: string;

  @ApiPropertyOptional({
    description: 'Obliga al usuario a cambiar la contraseña en su próximo ingreso',
    default: true,
  })
  @IsOptional()
  mustChangePassword?: boolean;
}

export class QueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por rol' })
  @IsOptional()
  @IsUUID()
  roleId?: string;
}
