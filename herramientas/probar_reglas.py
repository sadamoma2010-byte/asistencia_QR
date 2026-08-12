"""
Comprobación de las reglas de negocio RN001 a RN009 en la versión Python.

Se ejecutan contra la base real, sobre un docente de prueba que se crea al
empezar y se retira al terminar. Cada regla se provoca a propósito y se
verifica que el sistema responda como debe.

    .venv\\Scripts\\python herramientas\\probar_reglas.py
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, select

from aplicacion import crear_app
from aplicacion.comun.errores import ErrorAplicacion
from aplicacion.comun.peticion import ContextoPeticion
from aplicacion.comun.seguridad import UsuarioAutenticado, cifrar_contrasena
from aplicacion.comun.tiempo import ahora, clave_hora, dia_semana, minutos_a_hora, hora_a_minutos
from aplicacion.extensiones import bd
from aplicacion.modelos import (
    Docente,
    EstadoMarcacion,
    EstadoRegistro,
    Horario,
    Jornada,
    Marcacion,
    Rol,
    TipoMarcacion,
    Usuario,
    nuevo_id,
)
from aplicacion.modulos.asistencia import servicio as asistencia

MARCA = "PRUEBA-RN"
fallos = 0
ctx = ContextoPeticion(ip="127.0.0.1", agente="pruebas", dispositivo="Escritorio · Pruebas")


def comprobar(regla: str, descripcion: str, correcto: bool, detalle: str = "") -> None:
    global fallos
    if not correcto:
        fallos += 1
    print(f"  {' ' if correcto else '✗'} {regla:<8}{descripcion:<46}{detalle}")


def espera_error(fragmento: str, funcion, *args, **kwargs) -> tuple[bool, str]:
    """Ejecuta y comprueba que falle con el mensaje esperado."""
    try:
        funcion(*args, **kwargs)
        return False, "no falló"
    except ErrorAplicacion as error:
        return fragmento in error.mensaje, error.mensaje[:60]


def limpiar() -> None:
    """Retira lo que dejan las pruebas, en orden de dependencias."""
    docentes = list(
        bd.session.execute(select(Docente).where(Docente.code.startswith(MARCA))).scalars()
    )
    for docente in docentes:
        bd.session.execute(delete(Marcacion).where(Marcacion.teacher_id == docente.id))
        bd.session.execute(delete(Horario).where(Horario.teacher_id == docente.id))
        bd.session.delete(docente)

    for usuario in bd.session.execute(
        select(Usuario).where(Usuario.document.startswith(MARCA))
    ).scalars():
        bd.session.delete(usuario)

    for jornada in bd.session.execute(
        select(Jornada).where(Jornada.name.startswith(MARCA))
    ).scalars():
        bd.session.delete(jornada)

    bd.session.commit()


def preparar() -> tuple[Docente, Horario, UsuarioAutenticado]:
    """
    Crea un docente con su cuenta y un horario centrado en la hora actual.

    Anclar el horario al momento presente permite provocar la puntualidad y la
    tardanza de forma controlada, sin depender de a qué hora se ejecute.
    """
    rol = bd.session.execute(select(Rol).where(Rol.code == "DOCENTE")).scalar_one()

    usuario = Usuario(
        id=nuevo_id(),
        first_name="Prueba",
        last_name="Reglas",
        document=f"{MARCA}-U",
        email=f"{MARCA.lower()}@datly.local",
        password=cifrar_contrasena("Prueba123*"),
        role_id=rol.id,
        status=EstadoRegistro.ACTIVO,
    )
    jornada = Jornada(id=nuevo_id(), name=f"{MARCA} jornada", status=EstadoRegistro.ACTIVO)
    docente = Docente(
        id=nuevo_id(),
        code=f"{MARCA}-01",
        first_name="Prueba",
        last_name="Reglas",
        document=f"{MARCA}-D",
        email=f"{MARCA.lower()}.doc@datly.local",
        user_id=usuario.id,
        status=EstadoRegistro.ACTIVO,
    )
    bd.session.add_all([usuario, jornada, docente])
    bd.session.flush()

    momento = ahora()
    actual = hora_a_minutos(clave_hora(momento))

    horario = Horario(
        id=nuevo_id(),
        teacher_id=docente.id,
        shift_id=jornada.id,
        day_of_week=dia_semana(momento),
        # La entrada se sitúa justo ahora, para que la marcación salga puntual
        check_in_time=minutos_a_hora(actual),
        # La jornada dura menos que la ventana de marcación (180 min), para
        # que tanto la entrada como la salida puedan registrarse ahora mismo.
        check_out_time=minutos_a_hora(actual + 90),
        tolerance_minutes=10,
        status=EstadoRegistro.ACTIVO,
    )
    bd.session.add(horario)
    bd.session.commit()

    actor = UsuarioAutenticado(
        id=usuario.id,
        email=usuario.email,
        nombre_completo=usuario.nombre_completo,
        rol_id=rol.id,
        rol_codigo=rol.code,
        rol_nombre=rol.name,
        permisos=["attendance.self"],
        docente_id=docente.id,
    )
    return docente, horario, actor


def main() -> int:
    app = crear_app()

    with app.app_context():
        limpiar()
        docente, horario, actor = preparar()

        print("\n  Reglas de negocio en la versión Python")
        print("  " + "─" * 72)

        # ── RN008: entrada dentro de la tolerancia ───────────────────
        entrada = asistencia.registrar(TipoMarcacion.ENTRADA, None, None, actor, ctx)
        comprobar(
            "RN008",
            "Entrada dentro de la tolerancia se marca puntual",
            entrada["status"] == EstadoMarcacion.PUNTUAL.value,
            entrada["status"],
        )

        # ── RN009: la marcación queda auditada ───────────────────────
        from aplicacion.modelos import Auditoria

        rastro = bd.session.execute(
            select(Auditoria)
            .where(Auditoria.entity_id == entrada["id"])
            .order_by(Auditoria.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        comprobar(
            "RN009",
            "La marcación deja rastro en la auditoría",
            rastro is not None and rastro.user_email == actor.email,
            rastro.user_email if rastro else "sin rastro",
        )

        # ── RN004: dos entradas seguidas ─────────────────────────────
        ok, mensaje = espera_error(
            "RN004", asistencia.registrar, TipoMarcacion.ENTRADA, None, None, actor, ctx
        )
        comprobar("RN004", "Rechaza dos entradas consecutivas", ok, mensaje)

        # ── RN005: dos salidas seguidas ──────────────────────────────
        asistencia.registrar(TipoMarcacion.SALIDA, None, None, actor, ctx)
        ok, mensaje = espera_error(
            "RN005", asistencia.registrar, TipoMarcacion.SALIDA, None, None, actor, ctx
        )
        comprobar("RN005", "Rechaza dos salidas consecutivas", ok, mensaje)

        # ── RN006: salida sin entrada previa ─────────────────────────
        bd.session.execute(delete(Marcacion).where(Marcacion.teacher_id == docente.id))
        bd.session.commit()

        ok, mensaje = espera_error(
            "RN006", asistencia.registrar, TipoMarcacion.SALIDA, None, None, actor, ctx
        )
        comprobar("RN006", "Rechaza salida sin entrada previa", ok, mensaje)

        # ── RN007: entrada fuera de la tolerancia ────────────────────
        # Se retrasa la hora de entrada del horario 45 minutos hacia atrás: la
        # marcación de ahora queda 45 minutos tarde. Se mueve la entrada y no
        # la salida, porque la base exige que la salida sea posterior.
        entrada_atrasada = hora_a_minutos(clave_hora(ahora())) - 45
        horario.check_in_time = minutos_a_hora(entrada_atrasada)
        horario.check_out_time = minutos_a_hora(entrada_atrasada + 90)
        bd.session.commit()

        tarde = asistencia.registrar(TipoMarcacion.ENTRADA, None, None, actor, ctx)
        comprobar(
            "RN007",
            "Fuera de la tolerancia se marca tarde",
            tarde["status"] == EstadoMarcacion.TARDE.value and tarde["minutesDiff"] == 45,
            f"{tarde['status']} · {tarde['minutesDiff']} min",
        )

        bd.session.execute(delete(Marcacion).where(Marcacion.teacher_id == docente.id))
        bd.session.commit()

        # ── RN003: sin horario aplicable ─────────────────────────────
        horario.status = EstadoRegistro.INACTIVO
        bd.session.commit()

        ok, mensaje = espera_error(
            "RN003", asistencia.registrar, TipoMarcacion.ENTRADA, None, None, actor, ctx
        )
        comprobar("RN003", "Exige un horario activo para hoy", ok, mensaje)

        horario.status = EstadoRegistro.ACTIVO
        bd.session.commit()

        # ── RN002: docente inactivo ──────────────────────────────────
        docente.status = EstadoRegistro.INACTIVO
        bd.session.commit()

        ok, mensaje = espera_error(
            "RN002", asistencia.registrar, TipoMarcacion.ENTRADA, None, None, actor, ctx
        )
        comprobar("RN002", "Un docente inactivo no puede marcar", ok, mensaje)

        docente.status = EstadoRegistro.ACTIVO
        bd.session.commit()

        # ── RN002: cuenta de usuario inactiva ────────────────────────
        cuenta = bd.session.execute(
            select(Usuario).where(Usuario.id == docente.user_id)
        ).scalar_one()
        cuenta.status = EstadoRegistro.INACTIVO
        bd.session.commit()

        ok, mensaje = espera_error(
            "RN002", asistencia.registrar, TipoMarcacion.ENTRADA, None, None, actor, ctx
        )
        comprobar("RN002", "Una cuenta inactiva no puede marcar", ok, mensaje)

        cuenta.status = EstadoRegistro.ACTIVO
        bd.session.commit()

        # ── RN001: docente inexistente ───────────────────────────────
        ok, mensaje = espera_error(
            "no existe",
            asistencia.registrar,
            TipoMarcacion.ENTRADA,
            nuevo_id(),
            None,
            UsuarioAutenticado(
                id=actor.id,
                email=actor.email,
                nombre_completo=actor.nombre_completo,
                rol_id=actor.rol_id,
                rol_codigo="ADMINISTRADOR",
                rol_nombre="Administrador(a)",
                permisos=["attendance.create"],
                docente_id=None,
            ),
            ctx,
        )
        comprobar("RN001", "El docente debe existir", ok, mensaje)

        # ── Autoservicio: solo la propia asistencia ──────────────────
        ok, mensaje = espera_error(
            "Solo puede registrar su propia asistencia",
            asistencia.registrar,
            TipoMarcacion.ENTRADA,
            nuevo_id(),
            None,
            actor,
            ctx,
        )
        comprobar("Acceso", "Un docente solo registra lo suyo", ok, mensaje)

        # ── Ventana de marcación ─────────────────────────────────────
        lejano = minutos_a_hora(hora_a_minutos(clave_hora(ahora())) + 400)
        horario.check_in_time = lejano
        horario.check_out_time = minutos_a_hora(hora_a_minutos(lejano) + 60)
        bd.session.commit()

        ok, mensaje = espera_error(
            "fuera de la ventana",
            asistencia.registrar,
            TipoMarcacion.ENTRADA,
            None,
            None,
            actor,
            ctx,
        )
        comprobar("Ventana", "Rechaza marcar fuera de la ventana", ok, mensaje)

        limpiar()

    print("  " + "─" * 72)
    if fallos:
        print(f"  ✗ {fallos} regla(s) no se comportan como deben.\n")
        return 1
    print("  ✓ Las nueve reglas se comportan igual que en el sistema original.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
