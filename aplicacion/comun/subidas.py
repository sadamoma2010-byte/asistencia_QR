"""
Fotografías de docentes.

Sustituye a Multer y a sharp. Pillow hace el mismo tratamiento: respeta la
orientación de la cámara, recorta al centro en cuadrado, reduce a 512 px y
reescribe como WEBP.

La imagen no se guarda en el disco: se devuelve normalizada para que el módulo
que la pide la almacene en la base de datos. Así viaja con el respaldo, no
quedan archivos huérfanos al eliminar un docente y no hay que sincronizar una
carpeta aparte.

Normalizar siempre al mismo formato y tamaño evita que un archivo de 5 MB
acabe ocupando eso mismo en cada fila.
"""

from __future__ import annotations

import io

from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.datastructures import FileStorage

from .errores import SolicitudInvalida

LADO = 512
CALIDAD = 82
MAXIMO_BYTES = 5 * 1024 * 1024
TIPO_GUARDADO = "image/webp"

TIPOS_ADMITIDOS = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def normalizar_foto(archivo: FileStorage) -> tuple[bytes, str]:
    """
    Comprueba y normaliza la imagen recibida.

    Devuelve el contenido en WEBP y su tipo. El tipo que declara el navegador
    solo sirve de primer filtro: la comprobación real la hace Pillow al abrir
    el contenido, porque la extensión y la cabecera se pueden falsear.
    """
    if archivo is None or not archivo.filename:
        raise SolicitudInvalida("No se recibió ningún archivo")

    if archivo.mimetype not in TIPOS_ADMITIDOS:
        raise SolicitudInvalida(
            "Formato no admitido. Use una imagen JPG, PNG, WEBP o GIF de máximo 5 MB."
        )

    try:
        with Image.open(archivo.stream) as imagen:
            # Respeta la orientación EXIF de las fotos de celular
            imagen = ImageOps.exif_transpose(imagen)
            imagen = imagen.convert("RGB")
            # Recorte centrado al cuadrado, igual que `fit: cover`
            imagen = ImageOps.fit(imagen, (LADO, LADO), method=Image.LANCZOS, centering=(0.5, 0.4))

            memoria = io.BytesIO()
            imagen.save(memoria, format="WEBP", quality=CALIDAD)
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise SolicitudInvalida("El archivo no es una imagen válida o está dañado.") from error

    return memoria.getvalue(), TIPO_GUARDADO
