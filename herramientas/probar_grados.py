"""
Grados y cursos según la Ley 115 de 1994.

Comprueba que la escalera educativa está completa, que los cursos se abren por
grado con su letra, que un docente puede pertenecer a uno o varios y que las
reglas que protegen esa estructura se cumplen.

    .venv\\Scripts\\python herramientas\\probar_grados.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas.consola import preparar

preparar()

from aplicacion import crear_app
from aplicacion.extensiones import limitador

CORREO = "admin@datly.local"
CLAVE = "Admin123*"
MARCA = "ZZGRD"

# La escalera que fija la ley: preescolar (Decreto 2247 de 1997), básica
# primaria (art. 21), básica secundaria (art. 22) y media (art. 27-35).
ESPERADOS = {
    "PREESCOLAR": ["PJ", "JA", "TR"],
    "BASICA_PRIMARIA": ["1", "2", "3", "4", "5"],
    "BASICA_SECUNDARIA": ["6", "7", "8", "9"],
    "MEDIA": ["10", "11"],
}

fallos = 0
cliente = None
creados: list[tuple[str, str]] = []


def comprobar(etiqueta: str, correcto: bool, detalle: str = "") -> None:
    global fallos
    if not correcto:
        fallos += 1
    print(f"  {' ' if correcto else '✗'} {etiqueta:<46}{detalle}")


def api(metodo: str, ruta: str, cuerpo: dict | None = None):
    respuesta = getattr(cliente, metodo)(f"/api/v1{ruta}", json=cuerpo)
    datos = respuesta.get_json() or {}
    return respuesta.status_code, datos.get("data"), datos.get("message", "")


def main() -> int:
    global cliente

    app = crear_app()
    limitador.enabled = False
    cliente = app.test_client()

    print("\n  Grados y cursos (Ley 115 de 1994)")
    print("  " + "═" * 64)

    acceso = cliente.post("/api/v1/auth/login", json={"email": CORREO, "password": CLAVE})
    if acceso.status_code != 200:
        print(f"  No fue posible autenticar: HTTP {acceso.status_code}\n")
        return 1

    # ── La escalera educativa ────────────────────────────────────────
    print("\n  Escalera educativa")
    print("  " + "─" * 64)

    estado, pagina, _ = api("get", "/grades?page=1&limit=50&sortBy=position&sortOrder=asc")
    grados = (pagina or {}).get("items", [])
    comprobar("Los grados están cargados", estado == 200 and len(grados) >= 14, f"{len(grados)}")

    por_nivel: dict[str, list[str]] = {}
    for grado in grados:
        por_nivel.setdefault(grado["level"], []).append(grado["code"])

    for nivel, codigos in ESPERADOS.items():
        comprobar(
            f"{nivel.replace('_', ' ').title()}",
            por_nivel.get(nivel) == codigos,
            ", ".join(por_nivel.get(nivel, []))[:40],
        )

    posiciones = [g["position"] for g in grados]
    comprobar("En el orden de la escalera", posiciones == sorted(posiciones), str(posiciones[:6]))

    estado, niveles, _ = api("get", "/grades/by-level")
    comprobar(
        "Agrupados por nivel",
        estado == 200 and len(niveles or []) == 4,
        " · ".join(n["levelName"] for n in (niveles or []))[:44],
    )

    # ── Lo que la ley protege ────────────────────────────────────────
    print("\n  Reglas que protegen la estructura")
    print("  " + "─" * 64)

    sexto = next((g for g in grados if g["code"] == "6"), None)
    if sexto is None:
        print("  No se encontró el grado 6: no se puede continuar.\n")
        return 1

    estado, _, mensaje = api("delete", f"/grades/{sexto['id']}")
    comprobar("No se elimina un grado de la ley", estado == 400, mensaje[:44])

    estado, editado, _ = api("patch", f"/grades/{sexto['id']}", {"code": "99", "level": "MEDIA"})
    comprobar(
        "El código y el nivel no se editan",
        estado == 400 or (editado and editado["code"] == "6"),
        f"código = {editado['code'] if editado else 'rechazado'}",
    )

    estado, renombrado, _ = api("patch", f"/grades/{sexto['id']}", {"name": "Sexto grado"})
    comprobar(
        "El nombre visible sí se edita",
        estado == 200 and renombrado["name"] == "Sexto grado",
        renombrado["name"] if renombrado else "",
    )
    api("patch", f"/grades/{sexto['id']}", {"name": sexto["name"]})

    # La ley contempla ciclos aparte, como la educación de adultos: el módulo
    # deja añadirlos, y esos sí se pueden retirar porque no son del sistema.
    estado, propio, mensaje = api(
        "post",
        "/grades",
        {"code": f"{MARCA[:2]}1", "name": "Ciclo de adultos", "level": "MEDIA", "position": 30},
    )
    comprobar("Se puede añadir un grado propio", estado == 201, mensaje[:44])
    if propio:
        estado, _, mensaje = api("delete", f"/grades/{propio['id']}")
        comprobar("Y ese sí se puede retirar", estado == 200, mensaje[:44])

    # ── Cursos por grado ─────────────────────────────────────────────
    print("\n  Cursos por grado")
    print("  " + "─" * 64)

    estado, curso_b, mensaje = api(
        "post", "/courses", {"gradeId": sexto["id"], "letter": "B", "capacity": 35}
    )
    comprobar(
        "Alta del grupo B",
        estado == 201 and curso_b and curso_b["name"] == "6B",
        f"{curso_b['name'] if curso_b else mensaje}"[:44],
    )
    if not curso_b:
        return 1
    creados.append(("courses", curso_b["id"]))

    estado, _, mensaje = api("post", "/courses", {"gradeId": sexto["id"], "letter": "B"})
    comprobar("No se repite la letra en el mismo grado", estado == 409, mensaje[:44])

    estado, curso_c, _ = api("post", "/courses", {"gradeId": sexto["id"], "letter": "c"})
    comprobar(
        "La letra se guarda en mayúscula",
        estado == 201 and curso_c and curso_c["name"] == "6C",
        curso_c["name"] if curso_c else "",
    )
    if curso_c:
        creados.append(("courses", curso_c["id"]))

    estado, movido, _ = api("patch", f"/courses/{curso_b['id']}", {"letter": "D"})
    comprobar(
        "Al cambiar la letra se recompone el nombre",
        estado == 200 and movido["name"] == "6D",
        movido["name"] if movido else "",
    )
    api("patch", f"/courses/{curso_b['id']}", {"letter": "B"})

    # ── Un docente en uno o varios cursos ────────────────────────────
    print("\n  Docentes en uno o varios cursos")
    print("  " + "─" * 64)

    _, docente, mensaje = api(
        "post",
        "/teachers",
        {
            "code": f"{MARCA}-D1",
            "firstName": "Prueba",
            "lastName": "Cursos",
            "document": f"{MARCA}9100",
            "email": f"{MARCA.lower()}.cursos@datly.local",
            "courseIds": [curso_b["id"]],
        },
    )
    comprobar(
        "Se crea con un curso ya asignado",
        docente is not None and len(docente.get("courses", [])) == 1,
        (docente["courses"][0]["name"] if docente and docente["courses"] else mensaje)[:44],
    )
    if not docente:
        return 1
    creados.append(("teachers", docente["id"]))

    ambos = [curso_b["id"], curso_c["id"]] if curso_c else [curso_b["id"]]
    estado, ampliado, mensaje = api(
        "patch", f"/teachers/{docente['id']}/courses", {"courseIds": ambos}
    )
    comprobar(
        "Pertenece a varios cursos",
        estado == 200 and len(ampliado.get("courses", [])) == len(ambos),
        ", ".join(c["name"] for c in (ampliado or {}).get("courses", []))[:44],
    )

    estado, curso_detalle, _ = api("get", f"/courses/{curso_b['id']}")
    comprobar(
        "El curso ve a sus docentes",
        estado == 200 and any(d["id"] == docente["id"] for d in curso_detalle.get("teachers", [])),
        f"{len(curso_detalle.get('teachers', []))} docente(s)",
    )

    estado, con_director, mensaje = api(
        "patch", f"/courses/{curso_b['id']}", {"homeroomTeacherId": docente["id"]}
    )
    comprobar(
        "Se nombra director de grupo",
        estado == 200 and con_director.get("homeroomTeacherId") == docente["id"],
        mensaje[:44],
    )

    estado, _, mensaje = api(
        "patch", f"/teachers/{docente['id']}/courses", {"courseIds": []}
    )
    comprobar("El director no se retira de su curso", estado == 400, mensaje[:52])

    estado, _, mensaje = api("delete", f"/teachers/{docente['id']}")
    comprobar("No se elimina al director de grupo", estado == 400, mensaje[:52])

    api("patch", f"/courses/{curso_b['id']}", {"homeroomTeacherId": None})

    # ── El horario se ata al curso ───────────────────────────────────
    print("\n  El horario se ata al curso")
    print("  " + "─" * 64)

    _, jornada, _ = api("post", "/shifts", {"name": f"{MARCA} Jornada"})
    if jornada:
        creados.append(("shifts", jornada["id"]))

        estado, horario, mensaje = api(
            "post",
            "/schedules",
            {
                "teacherId": docente["id"],
                "shiftId": jornada["id"],
                "courseId": curso_b["id"],
                "dayOfWeek": 2,
                "checkInTime": "06:20",
                "checkOutTime": "09:50",
            },
        )
        comprobar(
            "Alta con curso",
            estado == 201 and horario and horario.get("course", {}).get("name") == "6B",
            (horario["course"]["name"] if horario and horario.get("course") else mensaje)[:44],
        )
        if horario:
            creados.append(("schedules", horario["id"]))

        # Un curso que el docente no atiende no puede entrar en su horario
        _, otro_curso, _ = api("post", "/courses", {"gradeId": sexto["id"], "letter": "Z"})
        if otro_curso:
            creados.append(("courses", otro_curso["id"]))
            estado, _, mensaje = api(
                "post",
                "/schedules",
                {
                    "teacherId": docente["id"],
                    "shiftId": jornada["id"],
                    "courseId": otro_curso["id"],
                    "dayOfWeek": 4,
                    "checkInTime": "13:00",
                    "checkOutTime": "17:00",
                },
            )
            comprobar("Rechaza un curso que no atiende", estado == 400, mensaje[:52])

    # ── El grado con cursos activos ──────────────────────────────────
    print("\n  Grado con cursos abiertos")
    print("  " + "─" * 64)

    estado, _, mensaje = api("patch", f"/grades/{sexto['id']}/deactivate")
    comprobar("No se inactiva con cursos activos", estado == 400, mensaje[:52])

    # ── Las pantallas ────────────────────────────────────────────────
    # La tabla se pinta con la definición que el servidor incrusta en la
    # página: si está completa, la pantalla muestra lo que debe.
    print("\n  Pantallas")
    print("  " + "─" * 64)

    import json as _json
    import re as _re

    def definicion(ruta: str) -> dict:
        html = cliente.get(ruta).get_data(as_text=True)
        bloque = _re.search(
            r'id="definicion-vista"[^>]*>(.*?)</script>', html, _re.S
        )
        return _json.loads(bloque.group(1)) if bloque else {}

    vista_grados = definicion("/grados")
    columnas = [c["campo"] for c in vista_grados.get("columnas", [])]
    comprobar(
        "Grados: columnas de la tabla",
        columnas[:4] == ["name", "code", "level", "_count.courses"],
        ", ".join(columnas[:4]),
    )
    comprobar(
        "Grados: filtro por nivel",
        any(f.get("campo") == "level" for f in vista_grados.get("filtros", [])),
        f"{len(vista_grados.get('filtros', []))} filtro(s)",
    )

    vista_cursos = definicion("/cursos")
    columnas = [c["campo"] for c in vista_cursos.get("columnas", [])]
    comprobar(
        "Cursos: columnas de la tabla",
        columnas[:5] == ["name", "grade.name", "grade.level", "shift.name", "homeroomTeacher"],
        ", ".join(columnas[:3]),
    )
    campos = [c["campo"] for c in (vista_cursos.get("formulario") or {}).get("campos", [])]
    comprobar(
        "Cursos: formulario completo",
        campos == [
            "gradeId", "letter", "shiftId", "capacity",
            "homeroomTeacherId", "status", "teacherIds",
        ],
        ", ".join(campos[:4]),
    )

    vista_docentes = definicion("/docentes")
    campos = [c["campo"] for c in (vista_docentes.get("formulario") or {}).get("campos", [])]
    comprobar(
        "Docentes: campo de cursos en la ficha",
        "courseIds" in campos,
        ", ".join(campos[-2:]),
    )
    comprobar(
        "Docentes: columna de cursos",
        any(c["campo"] == "courses" for c in vista_docentes.get("columnas", [])),
        "",
    )

    # ── Limpieza ─────────────────────────────────────────────────────
    for recurso, identificador in reversed(creados):
        cliente.delete(f"/api/v1/{recurso}/{identificador}")

    print("\n  " + "═" * 64)
    if fallos:
        print(f"  ✗ {fallos} comprobación(es) fallaron.\n")
        return 1
    print("  ✓ Grados, cursos y su vínculo con los docentes funcionan.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
