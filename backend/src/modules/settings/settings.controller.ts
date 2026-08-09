import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { SettingsService } from './settings.service';
import { UpdateQrConfigDto, UpdateSettingDto } from './dto/settings.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getRequestContext } from '../../common/utils/request.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('Configuración')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Parámetros públicos (nombre institucional, zona horaria)' })
  findPublic() {
    return this.settingsService.findPublic();
  }

  @ApiBearerAuth('access-token')
  @Get()
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Listar los parámetros del sistema agrupados' })
  findAll() {
    return this.settingsService.findAll();
  }

  // ──────────────────────────── QR ─────────────────────────────────

  @ApiBearerAuth('access-token')
  @Get('qr')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Configuración del QR institucional' })
  getQrConfig() {
    return this.settingsService.getQrConfig();
  }

  @ApiBearerAuth('access-token')
  @Patch('qr')
  @RequirePermissions('settings.update')
  @ApiOperation({ summary: 'Actualizar la URL y el nombre institucional del QR' })
  updateQrConfig(
    @Body() dto: UpdateQrConfigDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.settingsService.updateQrConfig(dto, actor, getRequestContext(req));
  }

  @ApiBearerAuth('access-token')
  @Get('qr/history')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Historial de cambios del QR institucional' })
  getQrHistory(@Query('limit') limit?: number) {
    return this.settingsService.getQrHistory(limit ? Number(limit) : 50);
  }

  // ───────────────────────── Parámetros ────────────────────────────

  @ApiBearerAuth('access-token')
  @Get(':key')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Detalle de un parámetro' })
  findByKey(@Param('key') key: string) {
    return this.settingsService.findByKey(key);
  }

  @ApiBearerAuth('access-token')
  @Patch(':key')
  @RequirePermissions('settings.update')
  @ApiOperation({ summary: 'Actualizar el valor de un parámetro' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.settingsService.update(key, dto, actor, getRequestContext(req));
  }
}
