/**
 * Comprobación de la estructura creada por `database.sql`.
 *
 * No basta con que las tablas existan: hay que confirmar que las vistas
 * responden, que las funciones calculan, que las restricciones rechazan datos
 * inválidos y que los índices parciales están en su sitio.
 *
 *   npm run db:verificar
 */
import { PrismaClient } from '@prisma/client';

const pg = new PrismaClient();

function linea(etiqueta: string, valor: string) {
  console.log(`  ${etiqueta.padEnd(42)}${valor}`);
}

async function contar(sql: string): Promise<number> {
  const r = await pg.$queryRawUnsafe<{ n: bigint }[]>(sql);
  return Number(r[0].n);
}

async function main() {
  console.log('\n  Estructura de PostgreSQL');
  console.log('  ' + '─'.repeat(52));

  const motor = await pg.$queryRaw<{ v: string }[]>`SELECT version() AS v`;
  linea('Motor', motor[0].v.split(',')[0]);

  const base = await pg.$queryRaw<{ d: string }[]>`SELECT current_database() AS d`;
  linea('Base de datos', base[0].d);

  console.log('\n  Objetos creados');
  console.log('  ' + '─'.repeat(52));
  linea('Tablas', String(await contar(
    `SELECT COUNT(*)::bigint AS n FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'`)));
  linea('Vistas', String(await contar(
    `SELECT COUNT(*)::bigint AS n FROM information_schema.views WHERE table_schema='public'`)));
  linea('Tipos enumerados', String(await contar(
    `SELECT COUNT(*)::bigint AS n FROM pg_type t
     JOIN pg_namespace n ON n.oid=t.typnamespace
     WHERE t.typtype='e' AND n.nspname='public'`)));
  linea('Claves primarias', String(await contar(
    `SELECT COUNT(*)::bigint AS n FROM pg_constraint WHERE contype='p'
     AND connamespace='public'::regnamespace`)));
  linea('Claves foráneas', String(await contar(
    `SELECT COUNT(*)::bigint AS n FROM pg_constraint WHERE contype='f'
     AND connamespace='public'::regnamespace`)));
  linea('Restricciones CHECK', String(await contar(
    `SELECT COUNT(*)::bigint AS n FROM pg_constraint WHERE contype='c'
     AND connamespace='public'::regnamespace AND conname NOT LIKE '%_not_null'`)));
  linea('Índices', String(await contar(
    `SELECT COUNT(*)::bigint AS n FROM pg_indexes WHERE schemaname='public'`)));
  linea('Índices parciales (borrado lógico)', String(await contar(
    `SELECT COUNT(*)::bigint AS n FROM pg_indexes
     WHERE schemaname='public' AND indexdef ILIKE '%deleted_at IS NULL%'`)));
  linea('Funciones propias', String(await contar(
    `SELECT COUNT(*)::bigint AS n FROM pg_proc p
     JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname LIKE 'fn_%'`)));

  console.log('\n  Las vistas responden');
  console.log('  ' + '─'.repeat(52));
  linea('v_asistencia_detallada', `${await contar(
    `SELECT COUNT(*)::bigint AS n FROM v_asistencia_detallada`)} filas`);
  linea('v_resumen_docente', `${await contar(
    `SELECT COUNT(*)::bigint AS n FROM v_resumen_docente`)} filas`);

  console.log('\n  Las funciones calculan');
  console.log('  ' + '─'.repeat(52));
  // Las horas viajan como texto 'HH:MM', igual que las guarda el sistema
  const puntual = await pg.$queryRaw<{ r: string }[]>`
    SELECT fn_evaluar_puntualidad('07:05', '07:00', 10::smallint)::text AS r`;
  linea('Llega 5 min tarde, tolerancia 10', puntual[0].r);
  const tarde = await pg.$queryRaw<{ r: string }[]>`
    SELECT fn_evaluar_puntualidad('07:25', '07:00', 10::smallint)::text AS r`;
  linea('Llega 25 min tarde, tolerancia 10', tarde[0].r);
  const pronto = await pg.$queryRaw<{ r: string }[]>`
    SELECT fn_evaluar_puntualidad('06:50', '07:00', 10::smallint)::text AS r`;
  linea('Llega 10 min antes', pronto[0].r);
  const dif = await pg.$queryRaw<{ r: number }[]>`
    SELECT fn_diferencia_minutos('11:30', '07:00') AS r`;
  linea('Minutos entre 07:00 y 11:30', String(dif[0].r));

  console.log('\n  Las restricciones rechazan datos inválidos');
  console.log('  ' + '─'.repeat(52));

  // Un horario cuya salida es anterior a la entrada debe ser rechazado
  try {
    await pg.$executeRawUnsafe(`
      INSERT INTO "schedules" ("id","teacher_id","shift_id","day_of_week",
        "check_in_time","check_out_time","created_at","updated_at")
      SELECT gen_random_uuid(), t.id, s.id, 1,
             '11:00', '07:00', NOW(), NOW()
      FROM "teachers" t, "shifts" s LIMIT 1`);
    linea('Salida anterior a la entrada', 'ACEPTADA — la restricción no actúa');
  } catch {
    linea('Salida anterior a la entrada', 'rechazada');
  }

  // Un día de la semana fuera de rango debe ser rechazado
  try {
    await pg.$executeRawUnsafe(`
      INSERT INTO "schedules" ("id","teacher_id","shift_id","day_of_week",
        "check_in_time","check_out_time","created_at","updated_at")
      SELECT gen_random_uuid(), t.id, s.id, 9,
             '07:00', '11:00', NOW(), NOW()
      FROM "teachers" t, "shifts" s LIMIT 1`);
    linea('Día de la semana fuera de rango', 'ACEPTADO — la restricción no actúa');
  } catch {
    linea('Día de la semana fuera de rango', 'rechazado');
  }

  // Una marcación sin docente existente debe ser rechazada por la clave foránea
  try {
    await pg.$executeRawUnsafe(`
      INSERT INTO "attendances" ("id","teacher_id","date","registered_at","type",
        "status","created_at","updated_at")
      VALUES (gen_random_uuid(), gen_random_uuid(), CURRENT_DATE, NOW(),
        'CHECK_IN', 'ON_TIME', NOW(), NOW())`);
    linea('Marcación con docente inexistente', 'ACEPTADA — la clave foránea no actúa');
  } catch {
    linea('Marcación con docente inexistente', 'rechazada');
  }

  console.log();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pg.$disconnect());
