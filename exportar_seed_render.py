"""
Exporta los docentes y sus usuarios desde la BD local (esquema español)
hacia un archivo SQL compatible con el esquema de Render (inglés).

Genera `seed_docentes_render.sql` con INSERTs idempotentes (ON CONFLICT DO
NOTHING) para `users` y `teachers`, vinculando cada docente a su usuario y
asignando el rol DOCENTE por código.

Uso:
    python exportar_seed_render.py
"""

from __future__ import annotations

import uuid

import psycopg2


def _url_bd() -> str:
    url = ""
    try:
        with open(".env") as f:
            for linea in f:
                if linea.startswith("DATABASE_URL="):
                    url = linea.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    if not url:
        url = "postgresql://postgres:@localhost:5432/asistencia_qr"
    if "?" in url:
        url = url.split("?", 1)[0]
    return url


def _sql_str(valor) -> str:
    """Escapa un valor como literal SQL (o NULL)."""
    if valor is None:
        return "NULL"
    return "'" + str(valor).replace("'", "''") + "'"


def main() -> None:
    conn = psycopg2.connect(_url_bd())
    cur = conn.cursor()

    cur.execute(
        """
        SELECT d.codigo, d.nombre, d.apellido, d.documento, d.correo,
               d.telefono, d.usuario_id, u.correo, u.contrasena
        FROM docentes d
        JOIN usuarios u ON u.id = d.usuario_id
        WHERE d.eliminado_en IS NULL
        ORDER BY d.codigo
        """
    )
    filas = cur.fetchall()
    print(f"Docentes con usuario: {len(filas)}")

    usuarios_lines = []
    docentes_lines = []

    for codigo, nombre, apellido, documento, correo, telefono, u_id, u_correo, hash_clave in filas:
        # Un solo usuario por docente; usar el correo del docente si faltara
        correo_final = correo or u_correo
        if not correo_final:
            correo_final = f"{documento}@pendiente.local"

        # Mantener el mismo id de usuario local para no duplicar
        uid = u_id

        usuarios_lines.append(
            "INSERT INTO \"users\" (\"id\", \"first_name\", \"last_name\", \"document\",\n"
            "                       \"email\", \"phone\", \"password\", \"status\", \"role_id\",\n"
            "                       \"must_change_password\", \"created_at\", \"updated_at\")\n"
            f"SELECT {_sql_str(uid)}, {_sql_str(nombre)}, {_sql_str(apellido)}, "
            f"{_sql_str(documento)},\n"
            f"       {_sql_str(correo_final)}, {_sql_str(telefono)}, {_sql_str(hash_clave)}, "
            f"'ACTIVE', r.\"id\", TRUE, NOW(), NOW()\n"
            'FROM "roles" r WHERE r."code" = \'DOCENTE\' '
            'AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."document" = '
            f"{_sql_str(documento)} OR u.\"email\" = {_sql_str(correo_final)});\n"
        )

        docentes_lines.append(
            "INSERT INTO \"teachers\" (\"id\", \"code\", \"first_name\", \"last_name\",\n"
            "                          \"document\", \"email\", \"phone\", \"status\",\n"
            "                          \"user_id\", \"created_at\", \"updated_at\")\n"
            f"VALUES ({_sql_str(str(uuid.uuid4()))}, {_sql_str(codigo)}, {_sql_str(nombre)}, "
            f"{_sql_str(apellido)},\n"
            f"        {_sql_str(documento)}, {_sql_str(correo_final)}, {_sql_str(telefono)}, "
            f"'ACTIVE', {_sql_str(uid)}, NOW(), NOW())\n"
            f"ON CONFLICT (\"document\") DO NOTHING;\n"
        )

    cur.close()
    conn.close()

    header = (
        "-- Seed de docentes y usuarios para el despliegue en Render\n"
        "-- Generado automaticamente desde la base local. Idempotente.\n\n"
    )
    cuerpo = "\n".join(usuarios_lines) + "\n" + "\n".join(docentes_lines)

    with open("seed_docentes_render.sql", "w", encoding="utf-8") as f:
        f.write(header + cuerpo)

    print(f"OK: seed_docentes_render.sql escrito "
          f"({len(usuarios_lines)} usuarios, {len(docentes_lines)} docentes)")


if __name__ == "__main__":
    main()