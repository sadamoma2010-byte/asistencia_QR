#!/usr/bin/env python3
"""
Inicializa la base de datos ejecutando database.sql.
Se ejecuta durante el build de Render.
"""
import os
import sys
import psycopg2
from pathlib import Path

def init_database():
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("DATABASE_URL no configurada, saltando init")
        return

    sql_file = Path(__file__).parent / "database.sql"
    if not sql_file.exists():
        print("database.sql no encontrado, saltando")
        return

    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
        count = cur.fetchone()[0]

        if count > 0:
            print(f"Base de datos ya tiene {count} tablas, saltando init")
            cur.close()
            conn.close()
            return

        print("Inicializando base de datos...")
        cur.execute(sql_file.read_text())
        print("Base de datos inicializada correctamente")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error inicializando BD: {e}")

if __name__ == "__main__":
    init_database()
