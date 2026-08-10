/* eslint-disable no-console */
/**
 * Traspaso de los datos de SQLite a PostgreSQL.
 *
 * Se ejecuta una sola vez, después de crear la estructura en PostgreSQL:
 *
 *   npm run db:migrar-datos
 *
 * Criterios que sigue:
 *
 *   · Respeta el orden de dependencias, para que ninguna clave foránea
 *     apunte a una fila que aún no existe.
 *   · Conserva los identificadores originales: las relaciones se mantienen
 *     y las rutas de las fotografías siguen siendo válidas.
 *   · Traslada también los registros con borrado lógico. Eliminarlos aquí
 *     rompería la trazabilidad de la auditoría.
 *   · Convierte el `metadata` de la bitácora de texto a JSON real.
 *   · Al terminar compara los conteos tabla por tabla y aborta si alguno
 *     no cuadra.
 *
 * Es idempotente: si se vuelve a ejecutar, omite lo ya migrado.
 */
import { PrismaClient as PgClient, Prisma } from '@prisma/client';
import { PrismaClient as SqliteClient } from '../node_modules/.prisma/client-sqlite';

const pg = new PgClient();
const sqlite = new SqliteClient();

let errores = 0;

function paso(texto: string) {
  process.stdout.write(`  ${texto.padEnd(24)}`);
}

function ok(cantidad: number, omitidos = 0) {
  const extra = omitidos > 0 ? `  (${omitidos} ya existían)` : '';
  console.log(`${String(cantidad).padStart(5)} filas${extra}`);
}

/** Convierte el metadata guardado como texto en JSON aprovechable por JSONB. */
function comoJson(texto: string | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!texto) return Prisma.JsonNull;
  try {
    return JSON.parse(texto) as Prisma.InputJsonValue;
  } catch {
    // Un metadata corrupto no debe detener la migración: se conserva el
    // texto original para no perder la información del evento.
    return { textoOriginal: texto } as Prisma.InputJsonValue;
  }
}

async function main() {
  console.log('\n  Migración de datos: SQLite → PostgreSQL');
  console.log('  ' + '─'.repeat(46) + '\n');

  // ── 1. Roles ───────────────────────────────────────────────────
  paso('Roles');
  const roles = await sqlite.role.findMany();
  let r = 0;
  for (const x of roles) {
    const existe = await pg.role.findUnique({ where: { id: x.id } });
    if (existe) continue;
    await pg.role.create({
      data: {
        id: x.id,
        name: x.name,
        description: x.description,
        isSystem: x.isSystem,
        status: x.status as never,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        deletedAt: x.deletedAt,
      },
    });
    r++;
  }
  ok(r, roles.length - r);

  // ── 2. Permisos ────────────────────────────────────────────────
  paso('Permisos');
  const permisos = await sqlite.permission.findMany();
  let pcount = 0;
  for (const x of permisos) {
    const existe = await pg.permission.findUnique({ where: { id: x.id } });
    if (existe) continue;
    await pg.permission.create({
      data: {
        id: x.id,
        code: x.code,
        name: x.name,
        module: x.module,
        description: x.description,
        isSystem: x.isSystem,
        status: x.status as never,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        deletedAt: x.deletedAt,
      },
    });
    pcount++;
  }
  ok(pcount, permisos.length - pcount);

  // ── 3. Permisos por rol ────────────────────────────────────────
  paso('Permisos por rol');
  const rp = await sqlite.rolePermission.findMany();
  const rpCreados = await pg.rolePermission.createMany({
    data: rp.map((x) => ({
      roleId: x.roleId,
      permissionId: x.permissionId,
      createdAt: x.createdAt,
    })),
    skipDuplicates: true,
  });
  ok(rpCreados.count, rp.length - rpCreados.count);

  // ── 4. Usuarios ────────────────────────────────────────────────
  paso('Usuarios');
  const usuarios = await sqlite.user.findMany();
  let u = 0;
  for (const x of usuarios) {
    const existe = await pg.user.findUnique({ where: { id: x.id } });
    if (existe) continue;
    await pg.user.create({
      data: {
        id: x.id,
        firstName: x.firstName,
        lastName: x.lastName,
        document: x.document,
        email: x.email,
        phone: x.phone,
        password: x.password, // ya viene hasheada: se traslada tal cual
        status: x.status as never,
        roleId: x.roleId,
        lastLoginAt: x.lastLoginAt,
        failedLoginAttempts: x.failedLoginAttempts,
        lockedUntil: x.lockedUntil,
        mustChangePassword: x.mustChangePassword,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        deletedAt: x.deletedAt,
      },
    });
    u++;
  }
  ok(u, usuarios.length - u);

  // ── 5. Asignaturas ─────────────────────────────────────────────
  paso('Asignaturas');
  const asignaturas = await sqlite.subject.findMany();
  let s = 0;
  for (const x of asignaturas) {
    const existe = await pg.subject.findUnique({ where: { id: x.id } });
    if (existe) continue;
    await pg.subject.create({
      data: {
        id: x.id,
        code: x.code,
        name: x.name,
        description: x.description,
        weeklyHours: x.weeklyHours,
        color: x.color,
        status: x.status as never,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        deletedAt: x.deletedAt,
      },
    });
    s++;
  }
  ok(s, asignaturas.length - s);

  // ── 6. Docentes ────────────────────────────────────────────────
  paso('Docentes');
  const docentes = await sqlite.teacher.findMany();
  let t = 0;
  for (const x of docentes) {
    const existe = await pg.teacher.findUnique({ where: { id: x.id } });
    if (existe) continue;
    await pg.teacher.create({
      data: {
        id: x.id,
        code: x.code,
        firstName: x.firstName,
        lastName: x.lastName,
        document: x.document,
        email: x.email,
        phone: x.phone,
        photoUrl: x.photoUrl,
        status: x.status as never,
        userId: x.userId,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        deletedAt: x.deletedAt,
      },
    });
    t++;
  }
  ok(t, docentes.length - t);

  // ── 7. Asignaturas por docente ─────────────────────────────────
  paso('Asignaturas/docente');
  const ts = await sqlite.teacherSubject.findMany();
  const tsCreados = await pg.teacherSubject.createMany({
    data: ts.map((x) => ({
      teacherId: x.teacherId,
      subjectId: x.subjectId,
      createdAt: x.createdAt,
    })),
    skipDuplicates: true,
  });
  ok(tsCreados.count, ts.length - tsCreados.count);

  // ── 8. Jornadas ────────────────────────────────────────────────
  paso('Jornadas');
  const jornadas = await sqlite.shift.findMany();
  let j = 0;
  for (const x of jornadas) {
    const existe = await pg.shift.findUnique({ where: { id: x.id } });
    if (existe) continue;
    await pg.shift.create({
      data: {
        id: x.id,
        name: x.name,
        description: x.description,
        status: x.status as never,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        deletedAt: x.deletedAt,
      },
    });
    j++;
  }
  ok(j, jornadas.length - j);

  // ── 9. Horarios ────────────────────────────────────────────────
  paso('Horarios');
  const horarios = await sqlite.schedule.findMany();
  let h = 0;
  for (const x of horarios) {
    const existe = await pg.schedule.findUnique({ where: { id: x.id } });
    if (existe) continue;
    await pg.schedule.create({
      data: {
        id: x.id,
        teacherId: x.teacherId,
        shiftId: x.shiftId,
        subjectId: x.subjectId,
        dayOfWeek: x.dayOfWeek,
        checkInTime: x.checkInTime,
        checkOutTime: x.checkOutTime,
        toleranceMinutes: x.toleranceMinutes,
        status: x.status as never,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        deletedAt: x.deletedAt,
      },
    });
    h++;
  }
  ok(h, horarios.length - h);

  // ── 10. Asistencia ─────────────────────────────────────────────
  paso('Marcaciones');
  const marcaciones = await sqlite.attendance.findMany();
  let a = 0;
  for (const x of marcaciones) {
    const existe = await pg.attendance.findUnique({ where: { id: x.id } });
    if (existe) continue;
    await pg.attendance.create({
      data: {
        id: x.id,
        teacherId: x.teacherId,
        scheduleId: x.scheduleId,
        type: x.type as never,
        status: x.status as never,
        date: x.date,
        registeredAt: x.registeredAt,
        expectedTime: x.expectedTime,
        minutesDiff: x.minutesDiff,
        ipAddress: x.ipAddress,
        userAgent: x.userAgent,
        device: x.device,
        notes: x.notes,
        registeredById: x.registeredById,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        deletedAt: x.deletedAt,
      },
    });
    a++;
  }
  ok(a, marcaciones.length - a);

  // ── 11. Configuración ──────────────────────────────────────────
  paso('Configuración');
  const ajustes = await sqlite.setting.findMany();
  let c = 0;
  for (const x of ajustes) {
    const existe = await pg.setting.findUnique({ where: { key: x.key } });
    if (existe) continue;
    await pg.setting.create({
      data: {
        id: x.id,
        key: x.key,
        value: x.value,
        type: x.type as never,
        group: x.group,
        label: x.label,
        description: x.description,
        isPublic: x.isPublic,
        isSystem: x.isSystem,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        deletedAt: x.deletedAt,
      },
    });
    c++;
  }
  ok(c, ajustes.length - c);

  // ── 12. Auditoría ──────────────────────────────────────────────
  paso('Auditoría');
  const bitacora = await sqlite.auditLog.findMany();
  let b = 0;
  for (const x of bitacora) {
    const existe = await pg.auditLog.findUnique({ where: { id: x.id } });
    if (existe) continue;
    await pg.auditLog.create({
      data: {
        id: x.id,
        userId: x.userId,
        userEmail: x.userEmail,
        userName: x.userName,
        action: x.action as never,
        module: x.module,
        entityId: x.entityId,
        description: x.description,
        ipAddress: x.ipAddress,
        userAgent: x.userAgent,
        device: x.device,
        metadata: comoJson(x.metadata),
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        deletedAt: x.deletedAt,
      },
    });
    b++;
  }
  ok(b, bitacora.length - b);

  // ── 13. Sesiones ───────────────────────────────────────────────
  // Los refresh tokens no se migran a propósito: son credenciales de sesión
  // de corta vida. Cada usuario simplemente vuelve a iniciar sesión.
  console.log('  Sesiones activas          no se migran (se renuevan al entrar)');

  // ── Verificación ───────────────────────────────────────────────
  console.log('\n  Verificación de integridad');
  console.log('  ' + '─'.repeat(46));

  const comparaciones: [string, number, number][] = [
    ['roles', await sqlite.role.count(), await pg.role.count()],
    ['permisos', await sqlite.permission.count(), await pg.permission.count()],
    ['permisos por rol', await sqlite.rolePermission.count(), await pg.rolePermission.count()],
    ['usuarios', await sqlite.user.count(), await pg.user.count()],
    ['asignaturas', await sqlite.subject.count(), await pg.subject.count()],
    ['docentes', await sqlite.teacher.count(), await pg.teacher.count()],
    ['asignaturas/docente', await sqlite.teacherSubject.count(), await pg.teacherSubject.count()],
    ['jornadas', await sqlite.shift.count(), await pg.shift.count()],
    ['horarios', await sqlite.schedule.count(), await pg.schedule.count()],
    ['marcaciones', await sqlite.attendance.count(), await pg.attendance.count()],
    ['configuración', await sqlite.setting.count(), await pg.setting.count()],
    ['auditoría', await sqlite.auditLog.count(), await pg.auditLog.count()],
  ];

  console.log('  ' + 'TABLA'.padEnd(22) + 'ORIGEN'.padStart(7) + 'DESTINO'.padStart(9) + '   ');
  for (const [nombre, origen, destino] of comparaciones) {
    // El destino puede tener más filas si la base ya traía datos iniciales
    const bien = destino >= origen;
    if (!bien) errores++;
    console.log(
      '  ' + nombre.padEnd(22) + String(origen).padStart(7) + String(destino).padStart(9) +
      (bien ? '   ok' : '   FALTAN FILAS'),
    );
  }

  // Comprobaciones concretas de que nada se perdió por el camino
  console.log('\n  Comprobaciones específicas');
  console.log('  ' + '─'.repeat(46));

  const borradosOrigen = await sqlite.teacher.count({ where: { NOT: { deletedAt: null } } });
  const borradosDestino = await pg.teacher.count({ where: { NOT: { deletedAt: null } } });
  console.log(`  Docentes con borrado lógico   ${borradosOrigen} → ${borradosDestino}` +
    (borradosDestino >= borradosOrigen ? '  ok' : '  FALTAN'));
  if (borradosDestino < borradosOrigen) errores++;

  const fotosOrigen = await sqlite.teacher.count({ where: { NOT: { photoUrl: null } } });
  const fotosDestino = await pg.teacher.count({ where: { NOT: { photoUrl: null } } });
  console.log(`  Docentes con fotografía       ${fotosOrigen} → ${fotosDestino}` +
    (fotosDestino >= fotosOrigen ? '  ok' : '  FALTAN'));
  if (fotosDestino < fotosOrigen) errores++;

  const metaOrigen = await sqlite.auditLog.count({ where: { NOT: { metadata: null } } });
  // En columnas JSONB la ausencia de valor se compara con DbNull, no con null
  const metaDestino = await pg.auditLog.count({ where: { metadata: { not: Prisma.DbNull } } });
  console.log(`  Auditorías con detalle JSON   ${metaOrigen} → ${metaDestino}` +
    (metaDestino >= metaOrigen ? '  ok' : '  FALTAN'));
  if (metaDestino < metaOrigen) errores++;

  // Ninguna marcación puede quedar apuntando a un docente inexistente
  const huerfanas = await pg.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM attendances a
    LEFT JOIN teachers t ON t.id = a.teacher_id
    WHERE t.id IS NULL`;
  const nHuerfanas = Number(huerfanas[0]?.n ?? 0);
  console.log(`  Marcaciones sin docente       ${nHuerfanas}` + (nHuerfanas === 0 ? '  ok' : '  INTEGRIDAD ROTA'));
  if (nHuerfanas > 0) errores++;

  console.log();
  if (errores > 0) {
    console.log(`  ✗ La migración terminó con ${errores} problema(s). Revise el detalle.\n`);
    process.exit(1);
  }
  console.log('  ✓ Migración completada. Todos los datos se conservan.\n');
}

main()
  .catch((e) => {
    console.error('\n  ✗ Error durante la migración:', e instanceof Error ? e.message : e, '\n');
    process.exit(1);
  })
  .finally(async () => {
    await pg.$disconnect();
    await sqlite.$disconnect();
  });
