"""
Importa docentes desde el Excel de la IED Los Laureles hacia la tabla `docentes`.

Usa psycopg2 directo (sin ORM) contra la base activa local.

Uso:
    python importar_docentes.py
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

import openpyxl
import psycopg2

ARCHIVO = "BASE DE  DATOS DOCENTES Y DIRECTIVOS IED LOS LAURELES 2026.xlsx"
HOJAS = ["Respuestas de formulario 1", "Respuestas de formulario 1 (2)"]

PATRON_CORREO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


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

    # psycopg2 no acepta parámetros extra en el DSN (p. ej. `?schema=public`)
    if "?" in url:
        url = url.split("?", 1)[0]
    return url


def _limpiar(valor) -> str:
    """Quita espacios, saltos y colapsa los espacios internos."""
    if not valor:
        return ""
    return " ".join(str(valor).strip().split())


def _separar_nombre(completo: str) -> tuple[str, str]:
    """
    Separa el nombre completo en (nombre, apellidos).

    Regla: los últimos dos tokens son apellidos y el resto nombres.
    Con un token, todo va a nombre.
    """
    partes = completo.split()
    if len(partes) <= 1:
        return (completo, "")
    if len(partes) == 2:
        return (partes[0], partes[1])
    return (" ".join(partes[:-2]), " ".join(partes[-2:]))


def _documento(valor) -> str:
    """Normaliza el número de documento a texto sin decimales perdidos."""
    if valor is None:
        return ""
    s = str(valor).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s


def _correo_valido(correo: str) -> bool:
    """El mismo patrón que aplica la restricción CHECK de la tabla."""
    return bool(PATRON_CORREO.match(correo))


def _primer_codigo(cur) -> int:
    """Máximo código DOC-NNNN legible que exista hoy."""
    cur.execute(
        "SELECT codigo FROM docentes WHERE codigo LIKE 'DOC-%' AND codigo ~ '^DOC-\\d+$'"
    )
    maximo = 0
    for (c,) in cur.fetchall():
        numero = int(c.split("-")[1])
        maximo = max(maximo, numero)
    return maximo


def main() -> None:
    conn = psycopg2.connect(_url_bd())
    conn.autocommit = True
    cur = conn.cursor()

    print(f"Leyendo {ARCHIVO}...")
    wb = openpyxl.load_workbook(ARCHIVO, read_only=True)

    cur.execute(
        "SELECT documento FROM docentes "
        "WHERE eliminado_en IS NULL AND documento IS NOT NULL AND documento <> ''"
    )
    existentes = {doc for (doc,) in cur.fetchall()}
    print(f"Docentes existentes en BD: {len(existentes)}")

    # Siguiente código DOC
    numero = _primer_codigo(cur)

    creados = 0
    omitidos_existentes = 0
    duplicados_excel = 0
    ahora = datetime.now(timezone.utc)

    for hoja in HOJAS:
        if hoja not in wb.sheetnames:
            continue
        for i, fila in enumerate(wb[hoja].iter_rows(values_only=True)):
            if i == 0:
                continue  # cabecera

            nombre_completo = _limpiar(fila[2])
            documento = _documento(fila[4])

            if not nombre_completo or not documento:
                continue

            if documento in existentes:
                omitidos_existentes += 1
                continue

            correo = _limpiar(fila[10])
            telefono = _limpiar(fila[6]) or None

            # El correo debe cumplir el CHECK (<algo>@<algo>.<algo>)
            if not _correo_valido(correo):
                correo = f"{documento}@pendiente.local"

            numero += 1
            codigo = f"DOC-{numero:04d}"

            nombre, apellidos = _separar_nombre(nombre_completo)

            cur.execute(
                """
                INSERT INTO docentes
                    (id, codigo, nombre, apellido, documento, correo, telefono,
                     estado, creado_en, actualizado_en)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'ACTIVO', %s, %s)
                """,
                (str(uuid.uuid4()), codigo, nombre, apellidos, documento, correo,
                 telefono, ahora, ahora),
            )
            creados += 1
            existentes.add(documento)

    wb.close()
    cur.close()
    conn.close()

    print("\n" + "=" * 50)
    print("Resultado de la importación:")
    print(f"  Creados:       {creados}")
    print(f"  Ya existían:   {omitidos_existentes}")
    print(f"  Duplicados:    {duplicados_excel}")
    print("=" * 50)


if __name__ == "__main__":
    main()