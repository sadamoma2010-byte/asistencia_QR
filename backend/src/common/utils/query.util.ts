import { SortOrder } from '../dto/pagination.dto';

/**
 * Construye un `orderBy` de Prisma validando el campo contra una lista blanca,
 * evitando ordenamientos arbitrarios enviados desde el cliente.
 */
export function buildOrderBy(
  sortBy: string | undefined,
  sortOrder: SortOrder | undefined,
  allowed: readonly string[],
  fallback = 'createdAt',
): Record<string, unknown> {
  const order = sortOrder === SortOrder.ASC ? 'asc' : 'desc';
  const field = sortBy && allowed.includes(sortBy) ? sortBy : fallback;

  // Soporta ordenamiento por relación con notación de punto: "role.name"
  if (field.includes('.')) {
    const [relation, column] = field.split('.');
    return { [relation]: { [column]: order } };
  }

  return { [field]: order };
}

/**
 * Filtro `contains` insensible a mayúsculas para varios campos.
 *
 * PostgreSQL admite `mode: 'insensitive'`, que Prisma traduce a ILIKE. A
 * diferencia del LIKE de SQLite, funciona también con vocales acentuadas:
 * «Ángela» coincide con «ángela».
 */
export function buildSearchFilter(
  search: string | undefined,
  fields: readonly string[],
): Record<string, unknown>[] | undefined {
  if (!search || !search.trim()) return undefined;
  const term = search.trim();

  return fields.map((field) => {
    if (field.includes('.')) {
      const [relation, column] = field.split('.');
      return { [relation]: { [column]: { contains: term, mode: 'insensitive' } } };
    }
    return { [field]: { contains: term, mode: 'insensitive' } };
  });
}
