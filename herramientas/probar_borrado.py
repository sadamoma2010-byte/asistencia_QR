"""
Borrado múltiple de marcaciones, desde Asistencia y desde Reportes.

Comprueba las dos vías, sus barreras de acceso y el rastro que dejan. Crea sus
propios datos y los retira al terminar, sin tocar las marcaciones reales.

    .venv\\Scripts\\python herramientas\\probar_borrado.py
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, select

from aplicacion import crear_app
from aplicacion.comun.seguridad import cifrar_contrasena
from aplicacion.extensiones import bd, limitador
from aplicacion.modelos import (
    Auditoria,
    Docente,
    EstadoMarcacion,
    EstadoRegistro,
    Marcacion,
    Rol,
    TipoMarcacion,
    Usuario,
    nuevo_id,
)

MARCA = "ZZBORRA"
CLAVE = "Admin123*"

fallos = 0


def comprobar(etiqueta: str, correcto: bool, detalle: str = "") -> None:
    global fallos
    if not correcto:
        fallos += 1
    print(f"  {' ' if correcto else '✗'} {etiqueta:<48}{detalle}")


def limpiar() -> None:
    for docente in bd.session.execute(
        select(Docente).where(Docente.code.startswith(MARCA))
    ).scalars():
        bd.session.execute(delete(Marcacion).where(Marcacion.teacher_id == docente.id))
        bd.session.delete(docente)
    for usuario in bd.session.execute(
        select(Usuario).where(Usuario.document.startswith(MARCA))
    ).scalars():
        bd.session.delete(usuario)
    bd.session.commit()


def sembrar(cuantos: int, por_docente: int) -> list[Docente]:
    """Crea docentes de prueba con marcaciones repartidas en días distintos."""
    docentes = []
    momento = datetime.now(timezone.utc)

    for indice in range(cuantos):
        docente = Docente(
            id=nuevo_id(),
            code=f"{MARCA}-{indice}",
            first_name="Prueba",
            last_name=f"Borrado {indice}",
            document=f"{MARCA}{indice}",
            email=f"{MARCA.lower()}{indice}@datly.local",
            status=EstadoRegistro.ACTIVO,
        )
        bd.session.add(docente)
        bd.session.flush()

        for dia in range(por_docente):
            bd.session.add(
                Marcacion(
                    id=nuevo_id(),
                    teacher_id=docente.id,
                    type=TipoMarcacion.ENTRADA,
                    status=EstadoMarcacion.PUNTUAL,
                    date=date.today() - timedelta(days=dia),
                    registered_at=momento,
                    expected_time="07:00",
                    minutes_diff=0,
                    created_at=momento,
                    updated_at=momento,
                )
            )
        docentes.append(docente)

    bd.session.commit()
    return docentes


def vivas(docente_id: str) -> int:
    return len(
        list(
            bd.session.execute(
                select(Marcacion).where(
                    Marcacion.teacher_id == docente_id, Marcacion.deleted_at.is_(None)
                )
            ).scalars()
        )
    )


def main() -> int:
    app = crear_app()
    limitador.enabled = False
    admin = app.test_client()
    admin.post("/api/v1/auth/login", json={"email": "admin@datly.local", "password": CLAVE})

    with app.app_context():
        limpiar()
        docentes = sembrar(3, 4)
        ids = [d.id for d in docentes]

        print("\n  Borrado desde Asistencia (marcaciones concretas)")
        print("  " + "─" * 68)

        marcaciones = list(
            bd.session.execute(
                select(Marcacion.id).where(Marcacion.teacher_id == ids[0])
            ).scalars()
        )
        elegidas = marcaciones[:2]

        respuesta = admin.post(
            "/api/v1/attendance/bulk-delete",
            json={"ids": elegidas, "reason": "Prueba automatizada"},
        )
        cuerpo = respuesta.get_json().get("data") or {}
        comprobar(
            "Elimina solo las seleccionadas",
            respuesta.status_code == 200 and cuerpo.get("deleted") == 2,
            f"{cuerpo.get('deleted')} de {len(marcaciones)}",
        )
        bd.session.expire_all()
        comprobar("Las demás siguen intactas", vivas(ids[0]) == 2, f"quedan {vivas(ids[0])}")

        rastro = bd.session.execute(
            select(Auditoria)
            .where(Auditoria.module == "Asistencia", Auditoria.action == "DELETE")
            .order_by(Auditoria.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        comprobar(
            "Queda registrado quién lo hizo",
            rastro is not None and rastro.user_email == "admin@datly.local",
            rastro.user_email if rastro else "sin rastro",
        )
        comprobar(
            "Y el detalle de lo eliminado",
            bool(rastro and rastro.metadata_ and rastro.metadata_.get("marcaciones")),
            f"{len(rastro.metadata_.get('marcaciones', [])) if rastro and rastro.metadata_ else 0} anotadas",
        )
        comprobar(
            "Con el motivo indicado",
            bool(rastro and rastro.metadata_ and rastro.metadata_.get("motivo")),
            (rastro.metadata_ or {}).get("motivo", "—") if rastro else "—",
        )

        print("\n  Borrado desde Reportes (por docente y periodo)")
        print("  " + "─" * 68)

        # Solo los dos días más recientes de los otros dos docentes
        desde = (date.today() - timedelta(days=1)).isoformat()
        hasta = date.today().isoformat()

        respuesta = admin.post(
            "/api/v1/attendance/delete-by-teacher",
            json={
                "teacherIds": ids[1:],
                "dateFrom": desde,
                "dateTo": hasta,
                "reason": "Prueba por periodo",
            },
        )
        cuerpo = respuesta.get_json().get("data") or {}
        comprobar(
            "Elimina las del periodo indicado",
            respuesta.status_code == 200 and cuerpo.get("deleted") == 4,
            f"{cuerpo.get('deleted')} marcación(es)",
        )

        bd.session.expire_all()
        comprobar(
            "Respeta las de fuera del periodo",
            vivas(ids[1]) == 2 and vivas(ids[2]) == 2,
            f"quedan {vivas(ids[1])} y {vivas(ids[2])}",
        )

        rastro = bd.session.execute(
            select(Auditoria)
            .where(Auditoria.module == "Asistencia", Auditoria.action == "DELETE")
            .order_by(Auditoria.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        detalle = (rastro.metadata_ or {}) if rastro else {}
        comprobar(
            "Anota el periodo y el reparto por docente",
            detalle.get("periodo") == f"{desde} a {hasta}" and len(detalle.get("docentes", [])) == 2,
            detalle.get("periodo", "—"),
        )

        print("\n  Barreras de acceso")
        print("  " + "─" * 68)

        # Un docente no puede borrar, aunque llegue a la dirección
        rol = bd.session.execute(select(Rol).where(Rol.code == "DOCENTE")).scalar_one()
        cuenta = Usuario(
            id=nuevo_id(),
            first_name="Prueba",
            last_name="Sin permiso",
            document=f"{MARCA}X",
            email=f"{MARCA.lower()}.docente@datly.local",
            password=cifrar_contrasena(CLAVE),
            role_id=rol.id,
            status=EstadoRegistro.ACTIVO,
        )
        bd.session.add(cuenta)
        bd.session.commit()

        otro = app.test_client()
        entrada = otro.post(
            "/api/v1/auth/login", json={"email": cuenta.email, "password": CLAVE}
        )
        comprobar("Un docente puede entrar", entrada.status_code == 200, f"HTTP {entrada.status_code}")

        restantes = list(
            bd.session.execute(
                select(Marcacion.id).where(
                    Marcacion.teacher_id == ids[0], Marcacion.deleted_at.is_(None)
                )
            ).scalars()
        )

        negado = otro.post("/api/v1/attendance/bulk-delete", json={"ids": restantes})
        comprobar(
            "Pero no puede borrar marcaciones",
            negado.status_code == 403,
            f"HTTP {negado.status_code} · {(negado.get_json() or {}).get('message', '')[:36]}",
        )

        negado = otro.post(
            "/api/v1/attendance/delete-by-teacher", json={"teacherIds": ids[1:]}
        )
        comprobar(
            "Ni por docente y periodo",
            negado.status_code == 403,
            f"HTTP {negado.status_code} · {(negado.get_json() or {}).get('message', '')[:36]}",
        )

        sin_sesion = app.test_client()
        anonima = sin_sesion.post(
            "/api/v1/attendance/bulk-delete", json={"ids": restantes}
        )
        comprobar(
            "Sin sesión tampoco",
            anonima.status_code == 401,
            f"HTTP {anonima.status_code} · {(anonima.get_json() or {}).get('message', '')[:36]}",
        )

        # Las marcaciones que se intentaron borrar sin permiso siguen ahí
        bd.session.expire_all()
        comprobar(
            "Ninguna se borró en los intentos rechazados",
            vivas(ids[0]) == len(restantes),
            f"{vivas(ids[0])} de {len(restantes)}",
        )

        limpiar()

    print("\n  " + "─" * 68)
    if fallos:
        print(f"  ✗ {fallos} comprobación(es) fallaron.\n")
        return 1
    print("  ✓ El borrado funciona por las dos vías y queda auditado.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
