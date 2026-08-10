import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type AuditLog as PrismaAuditLog } from '@prisma/client';

import { AuditAction } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { buildOrderBy, buildSearchFilter } from '../../common/utils/query.util';
import { buildPaginatedResult } from '../../common/dto/paginated-result.dto';
import { dayRange } from '../../common/utils/time.util';
import type { AuthenticatedUser, RequestContext } from '../../common/types/authenticated-user';
import { QueryAuditDto } from './dto/audit.dto';

export interface AuditPayload {
  action: AuditAction;
  module: string;
  description: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  user?: Pick<AuthenticatedUser, 'id' | 'email' | 'fullName'> | null;
  context?: RequestContext | null;
}

/**
 * Registro de auditoría tal como sale de la base.
 *
 * En PostgreSQL `metadata` es JSONB, así que Prisma ya entrega el objeto
 * deserializado: no hace falta ninguna conversión intermedia.
 */
export type AuditRecord = PrismaAuditLog;

const SORTABLE = ['createdAt', 'action', 'module', 'userEmail'] as const;
const SEARCHABLE = ['description', 'userEmail', 'userName', 'module', 'entityId'] as const;
const EXPORT_LIMIT = 5000;

/**
 * RN009 — Toda acción del sistema genera un registro de auditoría.
 * El registro nunca interrumpe la operación de negocio: los fallos se
 * reportan al log del servidor pero no se propagan al usuario.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(payload: AuditPayload): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: payload.action,
          module: payload.module,
          description: payload.description.slice(0, 500),
          entityId: payload.entityId ?? null,
          userId: payload.user?.id ?? null,
          userEmail: payload.user?.email ?? null,
          userName: payload.user?.fullName ?? null,
          ipAddress: payload.context?.ipAddress ?? null,
          userAgent: payload.context?.userAgent ?? null,
          device: payload.context?.device ?? null,
          // JSONB: se almacena el objeto tal cual, consultable con operadores JSON.
          // Sin detalle se usa DbNull, que deja la columna vacía. JsonNull
          // escribiría el valor JSON `null`, y entonces un evento sin detalle
          // sería indistinguible de uno que sí lo tiene.
          metadata: (payload.metadata ?? Prisma.DbNull) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(
        `No fue posible registrar la auditoría (${payload.module}/${payload.action})`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private buildWhere(query: QueryAuditDto): Prisma.AuditLogWhereInput {
    const { search, action, module, userId, dateFrom, dateTo } = query;
    const range = dayRange(dateFrom, dateTo);
    const or = buildSearchFilter(search, SEARCHABLE);

    return {
      deletedAt: null,
      ...(action ? { action } : {}),
      ...(module ? { module: { equals: module, mode: 'insensitive' } } : {}),
      ...(userId ? { userId } : {}),
      ...(range.gte || range.lte
        ? {
            createdAt: {
              ...(range.gte ? { gte: range.gte } : {}),
              ...(range.lte ? { lte: new Date(range.lte.getTime() + 86_399_999) } : {}),
            },
          }
        : {}),
      ...(or ? { OR: or } : {}),
    };
  }

  async findAll(query: QueryAuditDto) {
    const { page, limit, sortBy, sortOrder } = query;
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: buildOrderBy(sortBy, sortOrder, SORTABLE),
        skip: query.skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  findOne(id: string): Promise<AuditRecord> {
    return this.prisma.auditLog.findFirstOrThrow({ where: { id, deletedAt: null } });
  }

  /** Registros para exportación: mismos filtros, sin paginar, con tope de seguridad. */
  findForExport(query: QueryAuditDto): Promise<AuditRecord[]> {
    return this.prisma.auditLog.findMany({
      where: this.buildWhere(query),
      orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
      take: EXPORT_LIMIT,
    });
  }

  /** Módulos distintos presentes en la bitácora (para filtros del frontend). */
  async listModules(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { deletedAt: null },
      distinct: ['module'],
      select: { module: true },
      orderBy: { module: 'asc' },
    });
    return rows.map((r) => r.module);
  }
}
