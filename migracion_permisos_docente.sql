-- Migración: garantizar que el rol DOCENTE pueda entrar al dashboard y
-- registrar su propia asistencia. Es idempotente: solo inserta lo que falte.

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", NOW()
FROM "roles" r
JOIN "permissions" p ON TRUE
WHERE r."code" = 'DOCENTE'
  AND p."code" IN ('attendance.self', 'dashboard.read')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
