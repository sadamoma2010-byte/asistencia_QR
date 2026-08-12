"""
Comprueba que los modelos SQLAlchemy casan con las tablas reales.

No basta con que la aplicación arranque: cada columna declarada debe existir
en PostgreSQL con el nombre correcto, y cada tabla debe poder consultarse.
Este guion lo verifica una por una y avisa de cualquier desajuste.

    .venv\\Scripts\\python herramientas\\verificar_modelos.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas.consola import preparar

preparar()

from flask import Flask
from sqlalchemy import func, inspect, select

from aplicacion.config import obtener_config
from aplicacion.extensiones import bd
from aplicacion.modelos import (
    Ajuste,
    Asignatura,
    Auditoria,
    Curso,
    Docente,
    DocenteAsignatura,
    DocenteCurso,
    Grado,
    Horario,
    Jornada,
    Marcacion,
    Permiso,
    Rol,
    RolPermiso,
    SesionRefresco,
    Usuario,
)

MODELOS = [
    ("roles", Rol),
    ("permisos", Permiso),
    ("permisos por rol", RolPermiso),
    ("usuarios", Usuario),
    ("sesiones", SesionRefresco),
    ("docentes", Docente),
    ("asignaturas", Asignatura),
    ("asignaturas por docente", DocenteAsignatura),
    ("grados", Grado),
    ("cursos", Curso),
    ("cursos por docente", DocenteCurso),
    ("jornadas", Jornada),
    ("horarios", Horario),
    ("marcaciones", Marcacion),
    ("auditoría", Auditoria),
    ("configuración", Ajuste),
]


def main() -> int:
    ajustes = obtener_config()
    app = Flask(__name__)
    app.config.from_object(ajustes)
    bd.init_app(app)

    fallos = 0

    with app.app_context():
        motor = bd.session.get_bind()
        inspector = inspect(motor)
        tablas_reales = set(inspector.get_table_names())

        version = bd.session.execute(select(func.version())).scalar_one()
        print(f"\n  {version.split(',')[0]}")
        print(f"  Base: {bd.session.execute(select(func.current_database())).scalar_one()}")

        print("\n  Modelos frente a las tablas reales")
        print("  " + "─" * 60)
        print(f"  {'MODELO':<26}{'TABLA':<22}{'FILAS':>7}")
        print("  " + "─" * 60)

        for etiqueta, modelo in MODELOS:
            tabla = modelo.__tablename__

            if tabla not in tablas_reales:
                print(f"  {etiqueta:<26}{tabla:<22}{'—':>7}  LA TABLA NO EXISTE")
                fallos += 1
                continue

            # Las columnas declaradas deben existir todas en la base
            columnas_reales = {c["name"] for c in inspector.get_columns(tabla)}
            declaradas = {c.name for c in modelo.__table__.columns}
            ausentes = declaradas - columnas_reales

            try:
                total = bd.session.execute(
                    select(func.count()).select_from(modelo.__table__)
                ).scalar_one()
            except Exception as error:  # noqa: BLE001 - se informa y se sigue
                print(f"  {etiqueta:<26}{tabla:<22}{'—':>7}  NO SE PUDO CONSULTAR: {error}")
                fallos += 1
                continue

            aviso = f"  COLUMNAS AUSENTES: {', '.join(sorted(ausentes))}" if ausentes else ""
            if ausentes:
                fallos += 1
            print(f"  {etiqueta:<26}{tabla:<22}{total:>7}{aviso}")

        # Las enumeraciones nativas deben leerse como tales
        print("\n  Lectura de tipos especiales")
        print("  " + "─" * 60)

        docente = bd.session.execute(select(Docente).limit(1)).scalar_one_or_none()
        if docente:
            print(f"  {'Enumeración record_status':<40}{docente.status.value}")
            print(f"  {'Nombre completo':<40}{docente.nombre_completo}")

        marcacion = bd.session.execute(select(Marcacion).limit(1)).scalar_one_or_none()
        if marcacion:
            print(f"  {'Enumeración attendance_type':<40}{marcacion.type.value}")
            print(f"  {'Enumeración attendance_status':<40}{marcacion.status.value}")
            print(f"  {'Columna DATE':<40}{marcacion.date}")

        # En JSONB hay que distinguir la columna vacía del valor JSON `null`:
        # ambos llegan a Python como None, pero solo el primero significa
        # «sin detalle». Se filtra por el objeto ya deserializado.
        con_json = next(
            (
                fila
                for fila in bd.session.execute(
                    select(Auditoria).where(Auditoria.metadata_.is_not(None)).limit(20)
                ).scalars()
                if isinstance(fila.metadata_, dict)
            ),
            None,
        )
        if con_json:
            claves = ", ".join(list(con_json.metadata_.keys())[:4])
            print(f"  {'Columna JSONB (claves)':<40}{claves}")
        else:
            print(f"  {'Columna JSONB':<40}sin registros con detalle")

        # La relación con el rol debe cargarse
        usuario = bd.session.execute(select(Usuario).limit(1)).scalar_one_or_none()
        if usuario:
            print(f"  {'Relación usuario → rol':<40}{usuario.rol.name}")

    print("\n  " + "─" * 60)
    if fallos:
        print(f"  ✗ {fallos} desajuste(s) entre los modelos y la base.\n")
        return 1
    print(f"  ✓ Los {len(MODELOS)} modelos casan con las tablas reales.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
