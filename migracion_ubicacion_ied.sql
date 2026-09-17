-- Migración: fijar la ubicación de la IED Los Laureles.
-- Punto medio: 10.9326672, -74.7916050
-- Segundo punto de referencia: 10.9327162, -74.7917418 (≈ 16 m del centro)
-- Solo se aplica mientras la latitud siga vacía: si la institución ajusta la
-- ubicación desde la pantalla de Configuración, esta migración deja de tocar nada.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "settings"
    WHERE "key" = 'school.location_latitude' AND COALESCE("value", '') = ''
  ) THEN
    UPDATE "settings" SET "value" = '10.9326672', "updated_at" = NOW()
      WHERE "key" = 'school.location_latitude';
    UPDATE "settings" SET "value" = '-74.7916050', "updated_at" = NOW()
      WHERE "key" = 'school.location_longitude';
    UPDATE "settings" SET "value" = '16', "updated_at" = NOW()
      WHERE "key" = 'school.location_radius_meters';
    UPDATE "settings" SET "value" = 'true', "updated_at" = NOW()
      WHERE "key" = 'school.location_required';
  END IF;
END $$;

INSERT INTO "settings"
    ("id", "key", "value", "type", "group", "label", "description", "is_public", "is_system", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'school.location_permanent', 'true', 'STRING'::"setting_type", 'school',
   'Ubicación permanente del docente',
   'Si es true, las pantallas de marcación siguen la ubicación del docente mientras están abiertas.',
   FALSE, FALSE, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;

-- Nombre institucional: solo se reemplaza si nadie lo ha personalizado.
UPDATE "settings" SET "value" = 'IED Los Laureles', "updated_at" = NOW()
  WHERE "key" = 'qr.institution_name' AND "value" = 'Institución Educativa';
UPDATE "settings" SET "value" = 'IED Los Laureles', "updated_at" = NOW()
  WHERE "key" = 'app.institution_short_name' AND "value" IN ('Asistencia Docente', '');

