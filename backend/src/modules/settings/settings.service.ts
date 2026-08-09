import { Injectable, NotFoundException } from '@nestjs/common';
import { type Setting } from '@prisma/client';

import { AuditAction } from '../../common/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser, RequestContext } from '../../common/types/authenticated-user';
import { UpdateQrConfigDto, UpdateSettingDto } from './dto/settings.dto';

const MODULE = 'Configuración';
const QR_MODULE = 'Configuración QR';

export const SETTING_KEYS = {
  QR_URL: 'qr.public_url',
  QR_INSTITUTION: 'qr.institution_name',
  DEFAULT_TOLERANCE: 'attendance.default_tolerance_minutes',
  ATTENDANCE_WINDOW: 'attendance.window_minutes',
  TIMEZONE: 'app.timezone',
  SHORT_NAME: 'app.institution_short_name',
} as const;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────── Consultas ───────────────────────────

  async findAll() {
    const settings = await this.prisma.setting.findMany({
      where: { deletedAt: null },
      orderBy: [{ group: 'asc' }, { label: 'asc' }],
    });

    const groups = new Map<string, Setting[]>();
    for (const setting of settings) {
      const bucket = groups.get(setting.group) ?? [];
      bucket.push(setting);
      groups.set(setting.group, bucket);
    }

    return [...groups.entries()].map(([group, items]) => ({ group, settings: items }));
  }

  /** Parámetros marcados como públicos (accesibles sin autenticación). */
  async findPublic() {
    const settings = await this.prisma.setting.findMany({
      where: { deletedAt: null, isPublic: true },
      select: { key: true, value: true, type: true },
    });
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }

  async findByKey(key: string): Promise<Setting> {
    const setting = await this.prisma.setting.findFirst({ where: { key, deletedAt: null } });
    if (!setting) throw new NotFoundException(`El parámetro "${key}" no existe`);
    return setting;
  }

  /** Lectura tipada con valor por defecto, para uso interno de otros servicios. */
  async getNumber(key: string, fallback: number): Promise<number> {
    const setting = await this.prisma.setting.findFirst({ where: { key, deletedAt: null } });
    const parsed = Number(setting?.value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  async getString(key: string, fallback: string): Promise<string> {
    const setting = await this.prisma.setting.findFirst({ where: { key, deletedAt: null } });
    return setting?.value ?? fallback;
  }

  // ─────────────────────────── Mutaciones ──────────────────────────

  async update(
    key: string,
    dto: UpdateSettingDto,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<Setting> {
    const current = await this.findByKey(key);

    const updated = await this.prisma.setting.update({
      where: { key },
      data: { value: dto.value },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Actualizó el parámetro "${current.label}"`,
      entityId: current.id,
      metadata: { key, previousValue: current.value, newValue: dto.value },
      user: actor,
      context: ctx,
    });

    return updated;
  }

  // ──────────────────────────── QR ─────────────────────────────────

  async getQrConfig() {
    const [url, institution] = await Promise.all([
      this.findByKey(SETTING_KEYS.QR_URL),
      this.findByKey(SETTING_KEYS.QR_INSTITUTION),
    ]);

    return {
      publicUrl: url.value,
      institutionName: institution.value,
      updatedAt: url.updatedAt > institution.updatedAt ? url.updatedAt : institution.updatedAt,
    };
  }

  async updateQrConfig(dto: UpdateQrConfigDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const previous = await this.getQrConfig();

    await this.prisma.$transaction([
      this.prisma.setting.update({
        where: { key: SETTING_KEYS.QR_URL },
        data: { value: dto.publicUrl },
      }),
      ...(dto.institutionName
        ? [
            this.prisma.setting.update({
              where: { key: SETTING_KEYS.QR_INSTITUTION },
              data: { value: dto.institutionName },
            }),
          ]
        : []),
    ]);

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: QR_MODULE,
      description:
        previous.publicUrl === dto.publicUrl
          ? 'Actualizó el nombre institucional del QR'
          : `Actualizó la URL del QR institucional: ${previous.publicUrl} → ${dto.publicUrl}`,
      metadata: {
        previousUrl: previous.publicUrl,
        newUrl: dto.publicUrl,
        previousInstitution: previous.institutionName,
        newInstitution: dto.institutionName ?? previous.institutionName,
      },
      user: actor,
      context: ctx,
    });

    return this.getQrConfig();
  }

  /** Historial de cambios del QR institucional (tomado de la auditoría). */
  async getQrHistory(limit = 50) {
    const rows = await this.prisma.auditLog.findMany({
      where: { module: QR_MODULE, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true,
        description: true,
        userName: true,
        userEmail: true,
        ipAddress: true,
        device: true,
        metadata: true,
        createdAt: true,
      },
    });

    // En SQLite `metadata` se almacena serializado
    return rows.map((row) => ({
      ...row,
      metadata: row.metadata
        ? ((): Record<string, unknown> | null => {
            try {
              return JSON.parse(row.metadata as string) as Record<string, unknown>;
            } catch {
              return null;
            }
          })()
        : null,
    }));
  }
}
