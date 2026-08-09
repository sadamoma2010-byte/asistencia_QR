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
 * Filtro `contains` de Prisma para varios campos.
 *
 * SQLite no admite `mode: 'insensitive'`. Su operador LIKE ya ignora
 * mayúsculas y minúsculas para caracteres ASCII, que cubre el caso habitual;
 * las vocales acentuadas sí distinguen caso ("Ángela" no coincide con "ángela").
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
      return { [relation]: { [column]: { contains: term } } };
    }
    return { [field]: { contains: term } };
  });
}
