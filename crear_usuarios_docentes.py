"""
Crea cuentas de usuario para los docentes importados y los vincula.

- Rol asignado: DOCENTE
- Contraseña inicial: número de documento (deben cambiarla al entrar,
  `debe_cambiar_contrasena = true`)
- Login por correo electrónico

Uso:
    python crear_usuarios_docentes.py
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import bcrypt
import psycopg2


def _url_bd() -> str:
    """Lee DATABASE_URL del .env como hace la aplicación."""
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


def main() -> None:
    conn = psycopg2.connect(_url_bd())
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT id FROM roles WHERE nombre = 'DOCENTE'")
    fila = cur.fetchone()
    if fila is None:
        print("Error: no existe el rol DOCENTE")
        return
    rol_docente = fila[0]

    # Usuarios y docentes ya vinculados
    cur.execute("SELECT correo, documento FROM usuarios WHERE eliminado_en IS NULL")
    correos_usados = {correo for (correo, _) in cur.fetchall() if correo}
    documentos_usados = {doc for (_, doc) in cur.fetchall() if doc}

    ahora = datetime.now(timezone.utc)

    # Docentes sin usuario vinculado
    cur.execute(
        """
        SELECT d.id, d.nombre, d.apellido, d.documento, d.correo, d.telefono
        FROM docentes d
        LEFT JOIN usuarios u ON u.id = d.usuario_id
        WHERE d.eliminado_en IS NULL
          AND d.estado = 'ACTIVO'
          AND u.id IS NULL
        ORDER BY d.codigo
        """
    )
    docentes = cur.fetchall()
    print(f"Docentes sin usuario: {len(docentes)}")

    creados = 0
    enlazados = 0
    duplicados = 0
    errores = []

    for d_id, nombre, apellido, documento, correo, telefono in docentes:
        if not documento or not correo:
            errores.append((d_id, "falta documento o correo"))
            continue

        if documento in documentos_usados or correo in correos_usados:
            duplicados += 1
            continue

        # Contraseña inicial = número de documento (12 rondas, como la app)
        clave = documento.encode("utf-8")
        hash_clave = bcrypt.hashpw(clave, bcrypt.gensalt(12)).decode("utf-8")

        u_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO usuarios
                (id, nombre, apellido, documento, correo, telefono, contrasena,
                 estado, rol_id, intentos_inicio_fallidos, bloqueado_hasta,
                 debe_cambiar_contrasena, ultimo_inicio_sesion,
                 creado_en, actualizado_en)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'ACTIVO', %s, 0, NULL,
                    TRUE, NULL, %s, %s)
            """,
            (u_id, nombre, apellido, documento, correo, telefono, hash_clave,
             rol_docente, ahora, ahora),
        )
        cur.execute("UPDATE docentes SET usuario_id = %s, actualizado_en = %s WHERE id = %s",
                    (u_id, ahora, d_id))
        creados += 1
        documentos_usados.add(documento)
        correos_usados.add(correo)

    cur.close()
    conn.close()

    print("\n" + "=" * 50)
    print("Resultado:")
    print(f"  Usuarios creados:  {creados}")
    print(f"  Vinculados:        {enlazados}")
    print(f"  Docentes sin usar (duplicado correo/doc): {duplicados}")
    if errores:
        print(f"  Errores:           {len(errores)}")
        for e in errores[:10]:
            print(f"    - {e}")
    print("=" * 50)


if __name__ == "__main__":
    main()