"""
Fotografías de docentes.

Sustituye a `common/utils/upload.util.ts`, a Multer y a sharp. Pillow hace el
mismo tratamiento: respeta la orientación de la cámara, recorta al centro en
cuadrado, reduce a 512 px y reescribe como WEBP.

Guardar siempre el mismo formato y tamaño evita que un archivo de 5 MB acabe
sirviéndose tal cual en cada listado.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from flask import current_app
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.datastructures import FileStorage

from .errores import SolicitudInvalida

registro = logging.getLogger("asistencia")

LADO = 512
CALIDAD = 82
MAXIMO_BYTES = 5 * 1024 * 1024

TIPOS_ADMITIDOS = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _carpeta_docentes() -> Path:
    carpeta = Path(current_app.config["CARPETA_SUBIDAS"]) / "teachers"
    carpeta.mkdir(parents=True, exist_ok=True)
    return carpeta


def guardar_foto(archivo: FileStorage) -> str:
    """
    Normaliza y guarda la fotografía. Devuelve su ruta pública.

    El tipo declarado por el navegador solo sirve de primer filtro: la
    comprobación real la hace Pillow al abrir el contenido.
    """
    if archivo is None or not archivo.filename:
        raise SolicitudInvalida("No se recibió ningún archivo")

    if archivo.mimetype not in TIPOS_ADMITIDOS:
        raise SolicitudInvalida(
            "Formato no admitido. Use una imagen JPG, PNG, WEBP o GIF de máximo 5 MB."
        )

    nombre = f"{uuid.uuid4()}.webp"
    destino = _carpeta_docentes() / nombre

    try:
        with Image.open(archivo.stream) as imagen:
            # Respeta la orientación EXIF de las fotos de celular
            imagen = ImageOps.exif_transpose(imagen)
            imagen = imagen.convert("RGB")
            # Recorte centrado al cuadrado, igual que `fit: cover`
            imagen = ImageOps.fit(imagen, (LADO, LADO), method=Image.LANCZOS, centering=(0.5, 0.4))
            imagen.save(destino, format="WEBP", quality=CALIDAD)
    except (UnidentifiedImageError, OSError, ValueError) as error:
        destino.unlink(missing_ok=True)
        raise SolicitudInvalida("El archivo no es una imagen válida o está dañado.") from error

    # Ruta pública; el servidor expone /uploads como estático
    return f"/uploads/teachers/{nombre}"


def borrar_foto(ruta: str | None) -> None:
    """
    Borra del disco una fotografía anterior.

    Un fallo aquí nunca debe interrumpir la operación de negocio: el registro
    ya quedó sin foto en la base de datos.
    """
    if not ruta:
        return

    nombre = ruta.rsplit("/", 1)[-1]
    if not nombre or ".." in nombre or "/" in nombre or "\\" in nombre:
        return

    try:
        (_carpeta_docentes() / nombre).unlink(missing_ok=True)
    except OSError as error:
        registro.warning("No se pudo borrar la fotografía %s: %s", nombre, error)
