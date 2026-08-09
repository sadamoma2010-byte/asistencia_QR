import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateSettingDto {
  @ApiProperty({ description: 'Nuevo valor del parámetro' })
  @IsString()
  @MaxLength(2000)
  @Transform(trim)
  value!: string;
}

export class UpdateQrConfigDto {
  @ApiProperty({
    example: 'https://asistencia.institucion.edu.co/marcar',
    description: 'URL pública a la que apunta el QR institucional',
  })
  @IsUrl(
    { require_tld: false, require_protocol: true },
    { message: 'Debe ingresar una URL válida que incluya http:// o https://' },
  )
  @MaxLength(500)
  @Transform(trim)
  publicUrl!: string;

  @ApiPropertyOptional({ example: 'Institución Educativa Ejemplo' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre institucional no puede quedar vacío' })
  @MaxLength(160)
  @Transform(trim)
  institutionName?: string;
}
