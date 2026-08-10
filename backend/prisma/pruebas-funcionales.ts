/**
 * Pruebas de funcionamiento sobre PostgreSQL, a través de la API real.
 *
 * Recorre el ciclo completo que exige la especificación: alta, consulta,
 * modificación y baja, y comprueba que cada paso deja su rastro en la
 * auditoría con el nombre de quien lo hizo.
 *
 * Requiere el backend en marcha:
 *   npm run start:dev
 *   npm run db:pruebas
 *
 * Al terminar retira los registros que ha creado.
 */
import { PrismaClient } from '@prisma/client';

const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@datly.local';
const CLAVE = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123*';

const pg = new PrismaClient();
let fallos = 0;

function linea(etiqueta: string, valor: string, bien = true) {
  if (!bien) fallos++;
  console.log(`  ${bien ? ' ' : '✗'} ${etiqueta.padEnd(40)}${valor}`);
}

async function pedir(ruta: string, opciones: RequestInit = {}, token?: string) {
  const r = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.headers ?? {}),
    },
  });
  const cuerpo = await r.json().catch(() => null);
  return { estado: r.status, cuerpo };
}

async function main() {
  console.log('\n  Pruebas de funcionamiento sobre PostgreSQL');
  console.log('  ' + '─'.repeat(52));

  const motor = await pg.$queryRaw<{ v: string }[]>`SELECT version() AS v`;
  linea('Motor de base de datos', motor[0].v.split(',')[0].replace(' on ', ' · '));

  // --- Autenticación ---------------------------------------------------------
  const acceso = await pedir('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: CLAVE }),
  });
  const token: string | undefined = acceso.cuerpo?.data?.accessToken;
  if (!token) {
    linea('Autenticación', `falló (HTTP ${acceso.estado})`, false);
    console.log('\n  Sin sesión no se puede continuar.\n');
    process.exit(1);
  }
  linea('Autenticación del administrador', acceso.cuerpo.data.user.role.name);

  // --- CONSULTA de lo migrado ------------------------------------------------
  console.log('\n  Consulta de los datos migrados');
  console.log('  ' + '─'.repeat(52));
  for (const [ruta, etiqueta] of [
    ['/teachers', 'Docentes activos'],
    ['/subjects', 'Asignaturas'],
    ['/shifts', 'Jornadas'],
    ['/schedules', 'Horarios'],
    ['/audit', 'Registros de auditoría'],
  ] as const) {
    const r = await pedir(`${ruta}?page=1&limit=1`, {}, token);
    const total = r.cuerpo?.data?.meta?.total;
    linea(etiqueta, `${total ?? '—'}`, typeof total === 'number');
  }

  // --- Ciclo alta / consulta / modificación / baja ----------------------------
  console.log('\n  Ciclo completo sobre un registro');
  console.log('  ' + '─'.repeat(52));

  const marca = Date.now().toString().slice(-6);
  const alta = await pedir('/subjects', {
    method: 'POST',
    body: JSON.stringify({
      code: `PRB${marca}`,
      name: `Prueba PostgreSQL ${marca}`,
      description: 'Registro creado por las pruebas de funcionamiento',
    }),
  }, token);
  const id: string | undefined = alta.cuerpo?.data?.id;
  linea('ALTA', id ? `creada ${id.slice(0, 8)}…` : `falló (HTTP ${alta.estado})`, Boolean(id));
  if (!id) process.exit(1);

  const leida = await pedir(`/subjects/${id}`, {}, token);
  linea('CONSULTA por identificador', leida.cuerpo?.data?.name ?? '—',
    leida.estado === 200);

  await pedir(`/subjects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'Prueba PostgreSQL (modificada)' }),
  }, token);
  const tras = await pedir(`/subjects/${id}`, {}, token);
  const nombre = tras.cuerpo?.data?.name;
  linea('MODIFICACIÓN', nombre ?? '—', nombre === 'Prueba PostgreSQL (modificada)');

  const baja = await pedir(`/subjects/${id}`, { method: 'DELETE' }, token);
  const trasBaja = await pedir(`/subjects/${id}`, {}, token);
  linea('BAJA (borrado lógico)',
    `borrada; la consulta devuelve HTTP ${trasBaja.estado}`,
    baja.estado < 300 && trasBaja.estado === 404);

  // La fila debe seguir en la base, marcada, no desaparecida
  const enBase = await pg.subject.findUnique({
    where: { id }, select: { deletedAt: true },
  });
  linea('La fila permanece con marca de baja',
    enBase?.deletedAt ? enBase.deletedAt.toISOString().slice(0, 19).replace('T', ' ') : 'no',
    Boolean(enBase?.deletedAt));

  // --- Rastro de auditoría ---------------------------------------------------
  console.log('\n  Rastro en la auditoría');
  console.log('  ' + '─'.repeat(52));
  await new Promise((r) => setTimeout(r, 800));

  const bitacora = await pedir('/audit?page=1&limit=30', {}, token);
  const propias = (bitacora.cuerpo?.data?.items ?? [])
    .filter((x: { entityId: string }) => x.entityId === id);
  const cadena = propias.map((x: { action: string }) => x.action).reverse().join(' → ');
  linea('Acciones registradas', cadena || 'ninguna',
    cadena === 'CREATE → UPDATE → DELETE');

  const autor = propias.find((x: { action: string }) => x.action === 'DELETE');
  linea('Quién realizó la baja',
    autor ? `${autor.userName} <${autor.userEmail}>` : '—', Boolean(autor));

  // --- Retirar lo creado -----------------------------------------------------
  await pg.subject.deleteMany({ where: { code: { startsWith: 'PRB' } } });
  console.log('\n  Registros de prueba retirados.');

  console.log('  ' + '─'.repeat(52));
  console.log(fallos === 0
    ? '  ✓ Todas las comprobaciones pasaron.\n'
    : `  ✗ ${fallos} comprobación(es) fallaron.\n`);
  if (fallos > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pg.$disconnect());
