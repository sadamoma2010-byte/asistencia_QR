"""
Ciclo completo de alta, edición y baja desde la interfaz.

Comprueba lo que hace el formulario cuando el usuario lo usa: crear, editar,
enlazar relaciones, activar, inactivar y eliminar, en cada módulo que ofrece
esas acciones. Se ejecuta contra la base real y retira todo lo que crea.

    .venv\\Scripts\\python herramientas\\probar_crud.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas.consola import preparar

preparar()

from aplicacion import crear_app
from aplicacion.extensiones import bd, limitador
from aplicacion.modelos import Asignatura, Docente

CORREO = "admin@datly.local"
CLAVE = "Admin123*"
MARCA = "ZZPRB"

fallos = 0
cliente = None
creados: list[tuple[str, str]] = []


def comprobar(etiqueta: str, correcto: bool, detalle: str = "") -> None:
    global fallos
    if not correcto:
        fallos += 1
    print(f"  {' ' if correcto else '✗'} {etiqueta:<44}{detalle}")


def api(metodo: str, ruta: str, cuerpo: dict | None = None):
    respuesta = getattr(cliente, metodo)(f"/api/v1{ruta}", json=cuerpo)
    datos = respuesta.get_json() or {}
    return respuesta.status_code, datos.get("data"), datos.get("message", "")


def _apartar_del_correlativo(modelo, identificadores: list[str]) -> dict | None:
    """
    Saca del prefijo institucional los registros que creó la prueba.

    Al eliminarlos, su código quedó como `DOC-0010.DEL.<marca>`: sigue
    empezando por `DOC-` y por tanto sigue contando para el siguiente número.
    Se les cambia el prefijo por `PRB-`, con lo que la numeración vuelve a
    estar donde estaba antes de ejecutar la prueba.
    """
    if not identificadores:
        return None

    with cliente.application.app_context():
        for identificador in identificadores:
            fila = bd.session.get(modelo, identificador)
            if fila is not None:
                fila.code = f"PRB-{fila.code.split('-', 1)[-1]}"[:40]
        bd.session.commit()

    _, sugerido, _ = api("get", f"/{'subjects' if modelo is Asignatura else 'teachers'}/next-code")
    return sugerido


def ciclo(
    titulo: str,
    recurso: str,
    alta: dict,
    cambio: dict,
    campo_visible: str,
    relacion: tuple[str, str, list] | None = None,
) -> None:
    """Recorre alta, consulta, edición, estado y baja de un módulo."""
    print(f"\n  {titulo}")
    print("  " + "─" * 62)

    # ── Alta ─────────────────────────────────────────────────────────
    estado, creado, mensaje = api("post", f"/{recurso}", alta)
    comprobar("Alta", estado == 201 and creado is not None, f"HTTP {estado} · {mensaje}"[:56])
    if not creado:
        return
    identificador = creado["id"]
    creados.append((recurso, identificador))

    # ── Consulta ─────────────────────────────────────────────────────
    estado, detalle, _ = api("get", f"/{recurso}/{identificador}")
    comprobar(
        "Consulta del detalle",
        estado == 200 and detalle.get(campo_visible) == alta.get(campo_visible),
        str(detalle.get(campo_visible))[:40],
    )

    # ── Edición ──────────────────────────────────────────────────────
    estado, editado, mensaje = api("patch", f"/{recurso}/{identificador}", cambio)
    clave = next(iter(cambio))
    comprobar(
        "Edición",
        estado == 200 and str(editado.get(clave)) == str(cambio[clave]),
        f"{clave} = {editado.get(clave) if editado else mensaje}"[:44],
    )

    # ── Relación ─────────────────────────────────────────────────────
    if relacion:
        ruta, campo, valores = relacion
        estado, resultado, mensaje = api(
            "patch", f"/{recurso}/{identificador}{ruta}", {campo: valores}
        )
        comprobar(
            "Relación asignada",
            estado == 200,
            f"HTTP {estado} · {len(valores)} elemento(s)" if estado == 200 else mensaje[:44],
        )

    # ── Inactivar y activar ──────────────────────────────────────────
    estado, resultado, mensaje = api("patch", f"/{recurso}/{identificador}/deactivate")
    comprobar(
        "Inactivar",
        estado == 200 and resultado.get("status") == "INACTIVE",
        f"HTTP {estado} · {mensaje}"[:50],
    )

    estado, resultado, _ = api("patch", f"/{recurso}/{identificador}/activate")
    comprobar("Activar", estado == 200 and resultado.get("status") == "ACTIVE", f"HTTP {estado}")

    # ── Baja ─────────────────────────────────────────────────────────
    estado, _, mensaje = api("delete", f"/{recurso}/{identificador}")
    comprobar("Baja", estado == 200, mensaje[:50])

    estado, _, _ = api("get", f"/{recurso}/{identificador}")
    comprobar("Ya no aparece en consultas", estado == 404, f"HTTP {estado}")


def main() -> int:
    global cliente

    app = crear_app()
    limitador.enabled = False
    cliente = app.test_client()

    print("\n  Alta, edición y baja desde la interfaz")
    print("  " + "═" * 62)

    acceso = cliente.post("/api/v1/auth/login", json={"email": CORREO, "password": CLAVE})
    if acceso.status_code != 200:
        print(f"  No fue posible autenticar: HTTP {acceso.status_code}\n")
        return 1

    # ── Jornadas ─────────────────────────────────────────────────────
    ciclo(
        "Jornadas",
        "shifts",
        {"name": f"{MARCA} Jornada", "description": "Creada por las pruebas"},
        {"description": "Descripción modificada"},
        "name",
    )

    # ── Asignaturas ──────────────────────────────────────────────────
    ciclo(
        "Asignaturas",
        "subjects",
        {
            "code": f"{MARCA}-A1",
            "name": f"{MARCA} Asignatura",
            "weeklyHours": 4,
            "color": "#10B981",
        },
        {"name": f"{MARCA} Asignatura modificada", "weeklyHours": 6},
        "code",
    )

    # ── Permisos ─────────────────────────────────────────────────────
    ciclo(
        "Permisos",
        "permissions",
        {"code": f"{MARCA.lower()}.probar", "name": f"{MARCA} permiso", "module": MARCA},
        {"name": f"{MARCA} permiso modificado"},
        "code",
    )

    # ── Roles, con permisos asignados ────────────────────────────────
    _, permisos, _ = api("get", "/permissions?page=1&limit=3")
    ids_permisos = [p["id"] for p in (permisos or {}).get("items", [])]
    ciclo(
        "Roles",
        "roles",
        {"name": f"{MARCA} Rol", "description": "Creado por las pruebas"},
        {"description": "Descripción modificada"},
        "name",
        relacion=("/permissions", "permissionIds", ids_permisos),
    )

    # ── Usuarios ─────────────────────────────────────────────────────
    _, roles, _ = api("get", "/roles/options")
    rol_docente = next((r["id"] for r in (roles or []) if r["code"] == "DOCENTE"), None)

    ciclo(
        "Usuarios",
        "users",
        {
            "firstName": "Prueba",
            "lastName": "Interfaz",
            "document": f"{MARCA}9001",
            "email": f"{MARCA.lower()}.usuario@datly.local",
            "password": "Prueba123*",
            "roleId": rol_docente,
        },
        {"phone": "3001234567"},
        "email",
    )

    # ── Docentes, con asignaturas ────────────────────────────────────
    _, asignaturas, _ = api("get", "/subjects/options")
    ids_asignaturas = [a["id"] for a in (asignaturas or [])[:2]]

    ciclo(
        "Docentes",
        "teachers",
        {
            "code": f"{MARCA}-D1",
            "firstName": "Prueba",
            "lastName": "Docente",
            "document": f"{MARCA}9002",
            "email": f"{MARCA.lower()}.docente@datly.local",
            "subjectIds": ids_asignaturas,
        },
        {"phone": "3009876543"},
        "code",
        relacion=("/subjects", "subjectIds", ids_asignaturas[:1]),
    )

    # ── Horarios ─────────────────────────────────────────────────────
    # Se crean un docente y una jornada propios: usar los reales haría que la
    # comprobación de cruces saltara contra franjas que ya existen, que es
    # justo lo que debe hacer, pero impide probar el alta.
    print("\n  Horarios")
    print("  " + "─" * 62)

    _, docente_prueba, _ = api(
        "post",
        "/teachers",
        {
            "code": f"{MARCA}-D2",
            "firstName": "Prueba",
            "lastName": "Horario",
            "document": f"{MARCA}9010",
            "email": f"{MARCA.lower()}.horario@datly.local",
        },
    )
    _, jornada_prueba, _ = api("post", "/shifts", {"name": f"{MARCA} Jornada horarios"})

    if docente_prueba and jornada_prueba:
        creados.append(("teachers", docente_prueba["id"]))
        creados.append(("shifts", jornada_prueba["id"]))

        docente_id = docente_prueba["id"]
        jornada_id = jornada_prueba["id"]

        estado, creado, mensaje = api(
            "post",
            "/schedules",
            {
                "teacherId": docente_id,
                "shiftId": jornada_id,
                "dayOfWeek": 3,
                "checkInTime": "06:15",
                "checkOutTime": "09:45",
                "toleranceMinutes": 8,
            },
        )
        comprobar("Alta", estado == 201, f"HTTP {estado} · {mensaje}"[:50])

        if creado:
            creados.append(("schedules", creado["id"]))

            estado, editado, _ = api(
                "patch", f"/schedules/{creado['id']}", {"toleranceMinutes": 15}
            )
            comprobar(
                "Edición",
                estado == 200 and editado.get("toleranceMinutes") == 15,
                f"tolerancia = {editado.get('toleranceMinutes') if editado else '—'} min",
            )

            # La salida no puede ser anterior a la entrada
            estado, _, mensaje = api(
                "patch", f"/schedules/{creado['id']}", {"checkOutTime": "05:00"}
            )
            comprobar("Rechaza salida antes de la entrada", estado == 400, mensaje[:44])

            # Dos franjas del mismo docente no pueden cruzarse
            estado, _, mensaje = api(
                "post",
                "/schedules",
                {
                    "teacherId": docente_id,
                    "shiftId": jornada_id,
                    "dayOfWeek": 3,
                    "checkInTime": "07:00",
                    "checkOutTime": "10:00",
                },
            )
            comprobar("Rechaza horarios que se cruzan", estado == 409, mensaje[:44])

            estado, _, mensaje = api("delete", f"/schedules/{creado['id']}")
            comprobar("Baja", estado == 200, mensaje[:44])

    # ── Códigos automáticos ──────────────────────────────────────────
    # El formulario los rellena solo. Al eliminar un registro su código se
    # renombra para dejar libre el original, y ese sufijo llegó a romper el
    # cálculo: devolvía siempre el primero y la creación chocaba.
    print("\n  Códigos que el sistema asigna solo")
    print("  " + "─" * 62)

    for titulo, recurso, modelo, alta in (
        ("Asignaturas", "subjects", Asignatura,
         lambda c, i: {"code": c, "name": f"{MARCA} auto {i}"}),
        (
            "Docentes",
            "teachers",
            Docente,
            lambda c, i: {
                "code": c,
                "firstName": "Prueba",
                "lastName": "Correlativo",
                "document": f"{MARCA}95{i}",
                "email": f"{MARCA.lower()}.auto{i}@datly.local",
            },
        ),
    ):
        numeros, temporales = [], []
        for i in range(3):
            _, sugerido, _ = api("get", f"/{recurso}/next-code")
            codigo = (sugerido or {}).get("code", "")
            numeros.append(codigo)
            _, creado, mensaje = api("post", f"/{recurso}", alta(codigo, i))
            if creado:
                temporales.append(creado["id"])

        comprobar(
            f"{titulo}: tres altas seguidas",
            len(set(numeros)) == 3 and len(temporales) == 3,
            " → ".join(numeros)[:44],
        )

        for identificador in temporales:
            api("delete", f"/{recurso}/{identificador}")

        _, despues, _ = api("get", f"/{recurso}/next-code")
        comprobar(
            f"{titulo}: no reutiliza el eliminado",
            (despues or {}).get("code") not in numeros,
            f"{numeros[-1]} → {(despues or {}).get('code')}",
        )

        # Los códigos que gasta esta prueba se devuelven a la institución.
        # El correlativo cuenta también los eliminados —a propósito, para no
        # repetir el código de nadie en el histórico—, así que si los
        # registros de prueba se quedaran con su prefijo, cada ejecución
        # empujaría hacia arriba la numeración de los docentes reales.
        devueltos = _apartar_del_correlativo(modelo, temporales)
        comprobar(
            f"{titulo}: devuelve los códigos gastados",
            (devueltos or {}).get("code") == numeros[0],
            f"vuelve a sugerir {(devueltos or {}).get('code')}",
        )

    # ── Validaciones del formulario ──────────────────────────────────
    print("\n  Validación de los datos enviados")
    print("  " + "─" * 62)

    estado, _, mensaje = api("post", "/shifts", {"name": "X"})
    comprobar("Rechaza un nombre demasiado corto", estado == 400, mensaje[:44])

    estado, _, mensaje = api("post", "/users", {"firstName": "A"})
    comprobar("Rechaza campos obligatorios ausentes", estado == 400, mensaje[:44])

    estado, _, mensaje = api(
        "post",
        "/users",
        {
            "firstName": "Prueba",
            "lastName": "Debil",
            "document": f"{MARCA}9003",
            "email": f"{MARCA.lower()}.debil@datly.local",
            "password": "sinmayusculas1",
            "roleId": rol_docente,
        },
    )
    comprobar("Rechaza una contraseña débil", estado == 400, mensaje[:44])

    # El código se toma de una asignatura creada aquí mismo: depender de las
    # del arranque haría fallar la prueba en cuanto la institución las cambie.
    _, ocupada, _ = api("post", "/subjects", {"code": f"{MARCA}-DUP", "name": f"{MARCA} ocupada"})
    if ocupada:
        creados.append(("subjects", ocupada["id"]))
        estado, _, mensaje = api(
            "post", "/subjects", {"code": f"{MARCA}-DUP", "name": f"{MARCA} duplicada"}
        )
        comprobar("Rechaza un código duplicado", estado == 409, mensaje[:44])

    # ── Limpieza de lo que quedara ───────────────────────────────────
    for recurso, identificador in reversed(creados):
        cliente.delete(f"/api/v1/{recurso}/{identificador}")

    print("\n  " + "═" * 62)
    if fallos:
        print(f"  ✗ {fallos} comprobación(es) fallaron.\n")
        return 1
    print("  ✓ El ciclo completo funciona en todos los módulos.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
