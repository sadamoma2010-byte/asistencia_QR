import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditAction, RecordStatus } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildOrderBy, buildSearchFilter } from '../../common/utils/query.util';
import { buildPaginatedResult } from '../../common/dto/paginated-result.dto';
import { removeTeacherPhoto, saveTeacherPhoto } from '../../common/utils/upload.util';
import type { AuthenticatedUser, RequestContext } from '../../common/types/authenticated-user';
import { AssignSubjectsDto } from '../subjects/dto/subjects.dto';
import { CreateTeacherDto, QueryTeachersDto, UpdateTeacherDto } from './dto/teachers.dto';

const MODULE = 'Docentes';
const SORTABLE = ['createdAt', 'code', 'firstName', 'lastName', 'document', 'email', 'status'] as const;
const SEARCHABLE = ['code', 'firstName', 'lastName', 'document', 'email', 'phone'] as const;
const EXPORT_LIMIT = 5000;

const INCLUDE = {
  user: { select: { id: true, email: true, status: true, role: { select: { name: true } } } },
  subjects: {
    include: { subject: { select: { id: true, code: true, name: true, color: true } } },
  },
  _count: {
    select: {
      schedules: { where: { deletedAt: null } },
      attendances: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.TeacherInclude;

type TeacherWithRelations = Prisma.TeacherGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Aplana la relación muchos a muchos para que el cliente reciba asignaturas planas. */
  private present(teacher: TeacherWithRelations) {
    return { ...teacher, subjects: teacher.subjects.map((ts) => ts.subject) };
  }

  private buildWhere(query: QueryTeachersDto): Prisma.TeacherWhereInput {
    const or = buildSearchFilter(query.search, SEARCHABLE);
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.shiftId ? { schedules: { some: { shiftId: query.shiftId, deletedAt: null } } } : {}),
      ...(query.subjectId ? { subjects: { some: { subjectId: query.subjectId } } } : {}),
      ...(or ? { OR: or } : {}),
    };
  }

  async findAll(query: QueryTeachersDto) {
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.teacher.findMany({
        where,
        include: INCLUDE,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.teacher.count({ where }),
    ]);

    return buildPaginatedResult(items.map((t) => this.present(t)), total, query.page, query.limit);
  }

  /** Catálogo simplificado para selects. */
  findOptions() {
    return this.prisma.teacher.findMany({
      where: { deletedAt: null, status: RecordStatus.ACTIVE },
      select: { id: true, code: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async findOne(id: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...INCLUDE,
        schedules: {
          where: { deletedAt: null },
          include: {
            shift: { select: { id: true, name: true } },
            subject: { select: { id: true, code: true, name: true } },
          },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });
    if (!teacher) throw new NotFoundException('El docente no existe');

    return { ...teacher, subjects: teacher.subjects.map((ts) => ts.subject) };
  }

  async findForExport(query: QueryTeachersDto) {
    const rows = await this.prisma.teacher.findMany({
      where: this.buildWhere(query),
      include: INCLUDE,
      orderBy: buildOrderBy(query.sortBy, query.sortOrder, SORTABLE),
      take: EXPORT_LIMIT,
    });
    return rows.map((t) => this.present(t));
  }

  /** Sugiere el siguiente código disponible con el formato DOC-0000. */
  async suggestCode(): Promise<{ code: string }> {
    const last = await this.prisma.teacher.findFirst({
      where: { code: { startsWith: 'DOC-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    const next = last ? Number(last.code.replace('DOC-', '')) + 1 : 1;
    return { code: `DOC-${String(Number.isNaN(next) ? 1 : next).padStart(4, '0')}` };
  }

  // ─────────────────────────── Mutaciones ──────────────────────────

  async create(dto: CreateTeacherDto, actor: AuthenticatedUser, ctx: RequestContext) {
    await this.assertUnique(dto.code, dto.email, dto.document);
    if (dto.userId) await this.assertUserAvailable(dto.userId);
    if (dto.subjectIds?.length) await this.assertSubjects(dto.subjectIds);

    const created = await this.prisma.teacher.create({
      data: {
        code: dto.code,
        firstName: dto.firstName,
        lastName: dto.lastName,
        document: dto.document,
        email: dto.email,
        phone: dto.phone ?? null,
        userId: dto.userId ?? null,
        status: dto.status ?? RecordStatus.ACTIVE,
        ...(dto.subjectIds?.length
          ? { subjects: { create: dto.subjectIds.map((subjectId) => ({ subjectId })) } }
          : {}),
      },
      include: INCLUDE,
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      module: MODULE,
      description: `Creó el docente ${created.code} — ${created.firstName} ${created.lastName}`,
      entityId: created.id,
      metadata: { subjects: dto.subjectIds?.length ?? 0 },
      user: actor,
      context: ctx,
    });

    return this.present(created);
  }

  async update(id: string, dto: UpdateTeacherDto, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.teacher.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('El docente no existe');

    await this.assertUnique(dto.code, dto.email, dto.document, id);
    if (dto.userId && dto.userId !== current.userId) await this.assertUserAvailable(dto.userId);
    if (dto.subjectIds) {
      await this.assertSubjects(dto.subjectIds);
      await this.assertNoOrphanSchedules(id, dto.subjectIds);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.subjectIds) {
        await tx.teacherSubject.deleteMany({ where: { teacherId: id } });
        if (dto.subjectIds.length) {
          await tx.teacherSubject.createMany({
            data: dto.subjectIds.map((subjectId) => ({ teacherId: id, subjectId })),
          });
        }
      }

      return tx.teacher.update({
        where: { id },
        data: {
          ...(dto.code !== undefined ? { code: dto.code } : {}),
          ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
          ...(dto.document !== undefined ? { document: dto.document } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
          ...(dto.userId !== undefined ? { userId: dto.userId || null } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: INCLUDE,
      });
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Actualizó el docente ${updated.code} — ${updated.firstName} ${updated.lastName}`,
      entityId: id,
      metadata: { changes: dto },
      user: actor,
      context: ctx,
    });

    return this.present(updated);
  }

  /** Reemplaza el listado de asignaturas que dicta el docente. */
  async assignSubjects(
    id: string,
    dto: AssignSubjectsDto,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id, deletedAt: null } });
    if (!teacher) throw new NotFoundException('El docente no existe');

    await this.assertSubjects(dto.subjectIds);
    await this.assertNoOrphanSchedules(id, dto.subjectIds);

    await this.prisma.$transaction([
      this.prisma.teacherSubject.deleteMany({ where: { teacherId: id } }),
      ...(dto.subjectIds.length
        ? [
            this.prisma.teacherSubject.createMany({
              data: dto.subjectIds.map((subjectId) => ({ teacherId: id, subjectId })),
            }),
          ]
        : []),
    ]);

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Asignó ${dto.subjectIds.length} asignatura(s) a ${teacher.firstName} ${teacher.lastName}`,
      entityId: id,
      metadata: { subjectIds: dto.subjectIds },
      user: actor,
      context: ctx,
    });

    return this.findOne(id);
  }

  /** Guarda la fotografía del docente y descarta la anterior. */
  async setPhoto(id: string, file: Buffer, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.teacher.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('El docente no existe');

    const photoUrl = await saveTeacherPhoto(file);

    const updated = await this.prisma.teacher.update({
      where: { id },
      data: { photoUrl },
      include: INCLUDE,
    });

    // La anterior se borra solo después de que la nueva quedó guardada
    removeTeacherPhoto(current.photoUrl);

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Actualizó la fotografía de ${current.firstName} ${current.lastName}`,
      entityId: id,
      metadata: { photoUrl },
      user: actor,
      context: ctx,
    });

    return this.present(updated);
  }

  /** Retira la fotografía y deja las iniciales como identificación. */
  async clearPhoto(id: string, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.teacher.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('El docente no existe');
    if (!current.photoUrl) {
      throw new BadRequestException('El docente no tiene una fotografía registrada');
    }

    const updated = await this.prisma.teacher.update({
      where: { id },
      data: { photoUrl: null },
      include: INCLUDE,
    });

    removeTeacherPhoto(current.photoUrl);

    await this.audit.log({
      action: AuditAction.UPDATE,
      module: MODULE,
      description: `Eliminó la fotografía de ${current.firstName} ${current.lastName}`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return this.present(updated);
  }

  async setStatus(id: string, status: RecordStatus, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.teacher.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('El docente no existe');

    const updated = await this.prisma.teacher.update({
      where: { id },
      data: { status },
      include: INCLUDE,
    });

    await this.audit.log({
      action: status === RecordStatus.ACTIVE ? AuditAction.ACTIVATE : AuditAction.DEACTIVATE,
      module: MODULE,
      description: `${status === RecordStatus.ACTIVE ? 'Activó' : 'Inactivó'} al docente ${current.code} — ${current.firstName} ${current.lastName}`,
      entityId: id,
      user: actor,
      context: ctx,
    });

    return this.present(updated);
  }

  async remove(id: string, actor: AuthenticatedUser, ctx: RequestContext) {
    const current = await this.prisma.teacher.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { attendances: true } } },
    });
    if (!current) throw new NotFoundException('El docente no existe');

    const stamp = Date.now();
    await this.prisma.$transaction([
      // Los horarios y las asignaturas dependientes se retiran con el docente
      this.prisma.schedule.updateMany({
        where: { teacherId: id, deletedAt: null },
        data: { deletedAt: new Date(), status: RecordStatus.INACTIVE },
      }),
      this.prisma.teacherSubject.deleteMany({ where: { teacherId: id } }),
      this.prisma.teacher.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: RecordStatus.INACTIVE,
          code: `${current.code}.DEL.${stamp}`.slice(0, 40),
          email: `${current.email}.deleted.${stamp}`,
          document: `${current.document}.del.${stamp}`.slice(0, 40),
        },
      }),
    ]);

    // El archivo de la foto ya no tiene dueño: se retira del disco
    removeTeacherPhoto(current.photoUrl);

    await this.audit.log({
      action: AuditAction.DELETE,
      module: MODULE,
      description: `Eliminó al docente ${current.code} — ${current.firstName} ${current.lastName}`,
      entityId: id,
      metadata: { attendances: current._count.attendances },
      user: actor,
      context: ctx,
    });

    return { message: 'Docente eliminado correctamente' };
  }

  // ────────────────────────── Validaciones ─────────────────────────

  private async assertUnique(
    code?: string,
    email?: string,
    document?: string,
    excludeId?: string,
  ) {
    const conditions: Prisma.TeacherWhereInput[] = [];
    if (code) conditions.push({ code });
    if (email) conditions.push({ email });
    if (document) conditions.push({ document });
    if (conditions.length === 0) return;

    const existing = await this.prisma.teacher.findFirst({
      where: {
        deletedAt: null,
        OR: conditions,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { code: true, email: true, document: true },
    });

    if (existing) {
      if (existing.code === code) throw new ConflictException('Ya existe un docente con ese código');
      if (existing.email === email) throw new ConflictException('Ya existe un docente con ese correo');
      throw new ConflictException('Ya existe un docente con ese documento');
    }
  }

  private async assertUserAvailable(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { teacher: { select: { id: true } } },
    });
    if (!user) throw new BadRequestException('La cuenta de usuario seleccionada no existe');
    if (user.teacher) {
      throw new ConflictException('La cuenta de usuario ya está vinculada a otro docente');
    }
  }

  /** Las asignaturas seleccionadas deben existir y estar vigentes. */
  private async assertSubjects(subjectIds: string[]) {
    if (subjectIds.length === 0) return;

    const valid = await this.prisma.subject.count({
      where: { id: { in: subjectIds }, deletedAt: null },
    });
    if (valid !== subjectIds.length) {
      throw new BadRequestException('Una o más asignaturas seleccionadas no existen');
    }
  }

  /**
   * Impide retirarle al docente una asignatura que todavía usa en un horario:
   * dejaría franjas apuntando a materias que ya no dicta.
   */
  private async assertNoOrphanSchedules(teacherId: string, subjectIds: string[]) {
    const orphaned = await this.prisma.schedule.count({
      where: {
        teacherId,
        deletedAt: null,
        subjectId: { not: null },
        ...(subjectIds.length ? { NOT: { subjectId: { in: subjectIds } } } : {}),
      },
    });

    if (orphaned > 0) {
      throw new BadRequestException(
        `No es posible retirar esas asignaturas: ${orphaned} horario(s) del docente todavía las utilizan`,
      );
    }
  }
}
