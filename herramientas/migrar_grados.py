"""
Incorpora los grados y cursos del sistema educativo colombiano.

Crea el tipo, las tablas y los permisos que faltan, y carga los catorce grados
que fija la Ley 115 de 1994. No toca nada que ya exista: se puede ejecutar
más de una vez sin efectos secundarios.

    .venv\\Scripts\\python herramientas\\migrar_grados.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas.consola import preparar

preparar()

from sqlalchemy import inspect, text

from aplicacion import crear_app
from aplicacion.extensiones import bd

# Los catorce grados, en el orden de la escalera educativa.
# (código, nombre, nivel, posición, descripción, activo por defecto)
GRADOS = [
    ("PJ", "Prejardín", "PREESCOLAR", 1, "Preescolar. No obligatorio.", False),
    ("JA", "Jardín", "PREESCOLAR", 2, "Preescolar. No obligatorio.", False),
    ("TR", "Transición", "PREESCOLAR", 3, "Preescolar. Grado obligatorio (art. 17).", True),
    ("1", "Primero", "BASICA_PRIMARIA", 4, "Básica primaria.", True),
    ("2", "Segundo", "BASICA_PRIMARIA", 5, "Básica primaria.", True),
    ("3", "Tercero", "BASICA_PRIMARIA", 6, "Básica primaria.", True),
    ("4", "Cuarto", "BASICA_PRIMARIA", 7, "Básica primaria.", True),
    ("5", "Quinto", "BASICA_PRIMARIA", 8, "Básica primaria.", True),
    ("6", "Sexto", "BASICA_SECUNDARIA", 9, "Básica secundaria.", True),
    ("7", "Séptimo", "BASICA_SECUNDARIA", 10, "Básica secundaria.", True),
    ("8", "Octavo", "BASICA_SECUNDARIA", 11, "Básica secundaria.", True),
    ("9", "Noveno", "BASICA_SECUNDARIA", 12, "Básica secundaria.", True),
    ("10", "Décimo", "MEDIA", 13, "Educación media.", True),
    ("11", "Undécimo", "MEDIA", 14, "Educación media. Otorga el título de bachiller.", True),
]

PERMISOS = [
    ("grades.read", "Consultar grados", "Grados"),
    ("grades.update", "Editar grados", "Grados"),
    ("grades.activate", "Activar grados", "Grados"),
    ("grades.deactivate", "Inactivar grados", "Grados"),
    ("grades.export", "Exportar grados", "Grados"),
    ("courses.read", "Consultar cursos", "Cursos"),
    ("courses.create", "Crear cursos", "Cursos"),
    ("courses.update", "Editar cursos", "Cursos"),
    ("courses.delete", "Eliminar cursos", "Cursos"),
    ("courses.activate", "Activar cursos", "Cursos"),
    ("courses.deactivate", "Inactivar cursos", "Cursos"),
    ("courses.export", "Exportar cursos", "Cursos"),
]

# Qué permisos recibe cada rol
POR_ROL = {
    "SUPER_ADMIN": [c for c, _, _ in PERMISOS],
    "ADMINISTRADOR": [c for c, _, _ in PERMISOS],
    "COORDINADOR": [
        "grades.read", "courses.read", "courses.create", "courses.update", "courses.export"
    ],
}


def main() -> int:
    app = crear_app()

    with app.app_context():
        motor = bd.session.get_bind()
        inspector = inspect(motor)
        tablas = set(inspector.get_table_names())

        # ── 1. El tipo enumerado ─────────────────────────────────────
        print("\n  Tipo de nivel educativo")
        print("  " + "─" * 62)

        existe = bd.session.execute(
            text("SELECT 1 FROM pg_type WHERE typname = 'education_level'")
        ).scalar_one_or_none()

        if existe:
            print("    education_level     ya existía")
        else:
            bd.session.execute(
                text(
                    "CREATE TYPE \"education_level\" AS ENUM "
                    "('PREESCOLAR', 'BASICA_PRIMARIA', 'BASICA_SECUNDARIA', 'MEDIA')"
                )
            )
            bd.session.commit()
            print("    education_level     creado")

        # ── 2. Las tablas ────────────────────────────────────────────
        print("\n  Tablas")
        print("  " + "─" * 62)

        if "grades" in tablas:
            print("    grades              ya existía")
        else:
            bd.session.execute(text("""
                CREATE TABLE "grades" (
                    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
                    "code" VARCHAR(10) NOT NULL,
                    "name" VARCHAR(60) NOT NULL,
                    "level" "education_level" NOT NULL,
                    "position" SMALLINT NOT NULL,
                    "description" VARCHAR(300),
                    "is_system" BOOLEAN NOT NULL DEFAULT false,
                    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
                    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updated_at" TIMESTAMPTZ(3) NOT NULL,
                    "deleted_at" TIMESTAMPTZ(3),
                    CONSTRAINT "grades_pkey" PRIMARY KEY ("id"),
                    CONSTRAINT "grades_posicion_valida" CHECK ("position" BETWEEN 1 AND 30)
                )
            """))
            bd.session.execute(text('CREATE UNIQUE INDEX "grades_code_key" ON "grades"("code")'))
            bd.session.execute(
                text('CREATE INDEX "grades_level_position_idx" ON "grades"("level", "position")')
            )
            bd.session.execute(
                text('CREATE INDEX "grades_status_deleted_at_idx" ON "grades"("status", "deleted_at")')
            )
            bd.session.commit()
            print("    grades              creada")

        if "courses" in tablas:
            print("    courses             ya existía")
        else:
            bd.session.execute(text("""
                CREATE TABLE "courses" (
                    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
                    "grade_id" UUID NOT NULL,
                    "letter" VARCHAR(10) NOT NULL,
                    "name" VARCHAR(80) NOT NULL,
                    "shift_id" UUID,
                    "homeroom_teacher_id" UUID,
                    "capacity" SMALLINT,
                    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
                    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updated_at" TIMESTAMPTZ(3) NOT NULL,
                    "deleted_at" TIMESTAMPTZ(3),
                    CONSTRAINT "courses_pkey" PRIMARY KEY ("id"),
                    CONSTRAINT "courses_cupo_valido"
                        CHECK ("capacity" IS NULL OR "capacity" BETWEEN 1 AND 100),
                    CONSTRAINT "courses_grade_id_fkey" FOREIGN KEY ("grade_id")
                        REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
                    CONSTRAINT "courses_shift_id_fkey" FOREIGN KEY ("shift_id")
                        REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
                    CONSTRAINT "courses_homeroom_teacher_id_fkey" FOREIGN KEY ("homeroom_teacher_id")
                        REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE
                )
            """))
            bd.session.execute(text(
                'CREATE UNIQUE INDEX "courses_grade_letter_key" '
                'ON "courses"("grade_id", "letter") WHERE "deleted_at" IS NULL'
            ))
            for indice, columnas in (
                ("courses_grade_id_idx", '"grade_id"'),
                ("courses_shift_id_idx", '"shift_id"'),
                ("courses_homeroom_teacher_id_idx", '"homeroom_teacher_id"'),
                ("courses_status_deleted_at_idx", '"status", "deleted_at"'),
            ):
                bd.session.execute(text(f'CREATE INDEX "{indice}" ON "courses"({columnas})'))
            bd.session.commit()
            print("    courses             creada")

        if "teacher_courses" in tablas:
            print("    teacher_courses     ya existía")
        else:
            bd.session.execute(text("""
                CREATE TABLE "teacher_courses" (
                    "teacher_id" UUID NOT NULL,
                    "course_id" UUID NOT NULL,
                    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "teacher_courses_pkey" PRIMARY KEY ("teacher_id", "course_id"),
                    CONSTRAINT "teacher_courses_teacher_id_fkey" FOREIGN KEY ("teacher_id")
                        REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT "teacher_courses_course_id_fkey" FOREIGN KEY ("course_id")
                        REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE
                )
            """))
            bd.session.execute(
                text('CREATE INDEX "teacher_courses_course_id_idx" ON "teacher_courses"("course_id")')
            )
            bd.session.commit()
            print("    teacher_courses     creada")

        # ── 3. El curso en el horario ────────────────────────────────
        columnas_horario = {c["name"] for c in inspect(motor).get_columns("schedules")}
        if "course_id" in columnas_horario:
            print("    schedules.course_id ya existía")
        else:
            bd.session.execute(text('ALTER TABLE "schedules" ADD COLUMN "course_id" UUID'))
            bd.session.execute(text(
                'ALTER TABLE "schedules" ADD CONSTRAINT "schedules_course_id_fkey" '
                'FOREIGN KEY ("course_id") REFERENCES "courses"("id") '
                'ON DELETE SET NULL ON UPDATE CASCADE'
            ))
            bd.session.execute(
                text('CREATE INDEX "schedules_course_id_idx" ON "schedules"("course_id")')
            )
            bd.session.commit()
            print("    schedules.course_id añadida")

        # ── 4. Los grados de la Ley 115 ──────────────────────────────
        print("\n  Grados (Ley 115 de 1994)")
        print("  " + "─" * 62)

        nuevos = 0
        for codigo, nombre, nivel, posicion, descripcion, activo in GRADOS:
            existe = bd.session.execute(
                text('SELECT 1 FROM "grades" WHERE "code" = :c'), {"c": codigo}
            ).scalar_one_or_none()
            if existe:
                continue

            bd.session.execute(
                text(
                    'INSERT INTO "grades" ("code", "name", "level", "position", "description", '
                    '"is_system", "status", "created_at", "updated_at") VALUES '
                    '(:c, :n, CAST(:l AS "education_level"), :p, :d, TRUE, '
                    'CAST(:s AS "record_status"), NOW(), NOW())'
                ),
                {
                    "c": codigo, "n": nombre, "l": nivel, "p": posicion,
                    "d": descripcion, "s": "ACTIVE" if activo else "INACTIVE",
                },
            )
            nuevos += 1

        bd.session.commit()
        print(f"    {nuevos} grado(s) cargados, {len(GRADOS) - nuevos} ya estaban")

        for fila in bd.session.execute(
            text('SELECT "level", COUNT(*) AS n FROM "grades" GROUP BY "level" '
                 'ORDER BY MIN("position")')
        ).all():
            print(f"      {fila.level:<20}{fila.n} grado(s)")

        # ── 5. Un curso A por grado activo ───────────────────────────
        print("\n  Cursos")
        print("  " + "─" * 62)

        creados = bd.session.execute(text("""
            INSERT INTO "courses" ("grade_id", "letter", "name", "status", "created_at", "updated_at")
            SELECT g."id", 'A', g."code" || 'A', 'ACTIVE', NOW(), NOW()
            FROM "grades" g
            WHERE g."status" = 'ACTIVE'
              AND NOT EXISTS (
                SELECT 1 FROM "courses" c
                WHERE c."grade_id" = g."id" AND c."deleted_at" IS NULL
              )
        """)).rowcount
        bd.session.commit()

        total = bd.session.execute(
            text('SELECT COUNT(*) FROM "courses" WHERE "deleted_at" IS NULL')
        ).scalar_one()
        print(f"    {creados} curso(s) creados · {total} en total")

        # ── 6. Los permisos ──────────────────────────────────────────
        print("\n  Permisos")
        print("  " + "─" * 62)

        añadidos = 0
        for codigo, nombre, modulo in PERMISOS:
            existe = bd.session.execute(
                text('SELECT 1 FROM "permissions" WHERE "code" = :c'), {"c": codigo}
            ).scalar_one_or_none()
            if existe:
                continue
            bd.session.execute(
                text(
                    'INSERT INTO "permissions" ("code", "name", "module", "is_system", '
                    '"status", "created_at", "updated_at") '
                    "VALUES (:c, :n, :m, TRUE, 'ACTIVE', NOW(), NOW())"
                ),
                {"c": codigo, "n": nombre, "m": modulo},
            )
            añadidos += 1
        bd.session.commit()
        print(f"    {añadidos} permiso(s) añadidos, {len(PERMISOS) - añadidos} ya estaban")

        for rol, codigos in POR_ROL.items():
            concedidos = bd.session.execute(
                text("""
                    INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
                    SELECT r."id", p."id", NOW()
                    FROM "roles" r CROSS JOIN "permissions" p
                    WHERE r."code" = :rol AND p."code" = ANY(:codigos)
                      AND NOT EXISTS (
                        SELECT 1 FROM "role_permissions" rp
                        WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
                      )
                """),
                {"rol": rol, "codigos": codigos},
            ).rowcount
            bd.session.commit()
            print(f"    {rol:<16}{concedidos} permiso(s) concedidos")

    print("\n  " + "─" * 62)
    print("  ✓ Grados y cursos incorporados.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
