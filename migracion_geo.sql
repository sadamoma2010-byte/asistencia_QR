-- Migración: agregar columnas de geolocalización a attendances
-- Ejecutar una sola vez sobre la base de datos existente.

ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "location_accuracy" DOUBLE PRECISION;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "location_source" VARCHAR(30);

CREATE INDEX IF NOT EXISTS "attendances_location_idx" ON "attendances" ("latitude", "longitude") WHERE "latitude" IS NOT NULL;
