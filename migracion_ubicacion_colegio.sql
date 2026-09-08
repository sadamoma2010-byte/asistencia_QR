-- Migración: agregar configuración de ubicación geográfica del colegio
-- Ejecutar una sola vez sobre la base de datos existente.

INSERT INTO "settings"
    ("id", "key", "value", "type", "group", "label", "description", "is_public", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'school.location_latitude', '', 'STRING'::"setting_type", 'school', 'Latitud del colegio', 'Latitud en grados decimales, por ejemplo 4.6097', FALSE, FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'school.location_longitude', '', 'STRING'::"setting_type", 'school', 'Longitud del colegio', 'Longitud en grados decimales, por ejemplo -74.0817', FALSE, FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'school.location_radius_meters', '200', 'NUMBER'::"setting_type", 'school', 'Radio de marcación (metros)', 'Radio máximo permitido desde el punto del colegio para registrar asistencia', FALSE, FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'school.location_required', 'false', 'STRING'::"setting_type", 'school', 'Obligar a marcar dentro del colegio', 'Si es true, el docente debe estar dentro del radio para registrar asistencia', FALSE, FALSE, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;