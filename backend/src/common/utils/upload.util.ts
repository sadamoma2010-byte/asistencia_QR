import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

/** Raíz de los archivos servidos públicamente. */
export const UPLOADS_ROOT = join(process.cwd(), 'uploads');

/** Subcarpeta de fotografías de docentes. */
export const TEACHER_PHOTOS_DIR = join(UPLOADS_ROOT, 'teachers');

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Crea las carpetas de destino si aún no existen. */
export function ensureUploadDirs(): void {
  for (const dir of [UPLOADS_ROOT, TEACHER_PHOTOS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

/**
 * Filtro de Multer: solo se aceptan imágenes de los formatos previstos.
 * La validación real del contenido la hace `sharp` al procesar el archivo.
 */
export function imageFileFilter(
  _req: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    callback(
      new BadRequestException(
        'Formato no admitido. Use una imagen JPG, PNG, WEBP o GIF de máximo 5 MB.',
      ),
      false,
    );
    return;
  }
  callback(null, true);
}

/**
 * Normaliza la fotografía recibida: recorta al centro en formato cuadrado,
 * la reduce a 512 px y la reescribe como WEBP.
 *
 * Guardar siempre el mismo formato y tamaño evita que un archivo de 5 MB
 * termine sirviéndose tal cual en cada listado.
 */
export async function saveTeacherPhoto(buffer: Buffer): Promise<string> {
  ensureUploadDirs();

  const filename = `${randomUUID()}.webp`;
  const target = join(TEACHER_PHOTOS_DIR, filename);

  try {
    await sharp(buffer)
      .rotate() // respeta la orientación EXIF de las fotos de celular
      .resize(512, 512, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toFile(target);
  } catch {
    throw new BadRequestException('El archivo no es una imagen válida o está dañado.');
  }

  // Ruta pública; el servidor expone /uploads como estático
  return `/uploads/teachers/${filename}`;
}

/**
 * Borra del disco una fotografía anterior.
 * Un fallo aquí nunca debe interrumpir la operación de negocio.
 */
export function removeTeacherPhoto(photoUrl: string | null | undefined): void {
  if (!photoUrl) return;

  const filename = photoUrl.split('/').pop();
  if (!filename || filename.includes('..')) return;

  const target = join(TEACHER_PHOTOS_DIR, filename);
  try {
    if (existsSync(target)) unlinkSync(target);
  } catch {
    // Se ignora: el registro ya quedó sin foto en la base de datos
  }
}
