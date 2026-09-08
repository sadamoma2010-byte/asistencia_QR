import json
import uuid

import psycopg2

url = ""
for l in open(".env"):
    if l.startswith("DATABASE_URL="):
        url = l.split("=", 1)[1].strip()
url = url.split("?")[0]

conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute(
    """
    SELECT d.codigo, d.nombre, d.apellido, d.documento, d.correo,
           d.telefono, u.id, u.correo, u.contrasena
    FROM docentes d
    JOIN usuarios u ON u.id = d.usuario_id
    WHERE d.eliminado_en IS NULL
    ORDER BY d.codigo
    """
)
filas = cur.fetchall()
cur.close()
conn.close()

entradas = []
for codigo, nombre, apellido, documento, correo, telefono, u_id, u_correo, hash_clave in filas:
    email = (correo or u_correo or "") or None
    if not email:
        email = f"{documento}@pendiente.local"
    entradas.append(
        {
            "usuario_id": str(u_id),
            "docente_id": str(uuid.uuid4()),
            "code": codigo,
            "first_name": nombre,
            "last_name": apellido,
            "document": str(documento),
            "email": email,
            "phone": str(telefono) if telefono else None,
            "password": hash_clave,
        }
    )

datos = {
    "_comentario": "Datos de los 41 docentes IED Los Laureles para seeding idempotente.",
    "docentes": entradas,
}

ruta = "seed_docentes.json"
with open(ruta, "w", encoding="utf-8") as f:
    json.dump(datos, f, ensure_ascii=False, indent=1)
print(f"OK: {ruta} con {len(entradas)} docentes")