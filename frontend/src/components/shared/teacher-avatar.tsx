'use client';

import { useState } from 'react';

import { assetUrl } from '@/lib/api';
import { cn, initials } from '@/lib/utils';

const SIZES = {
  sm: 'size-8 text-[11px]',
  md: 'size-10 text-xs',
  lg: 'size-16 text-base',
  xl: 'size-28 text-2xl',
} as const;

interface TeacherAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * Fotografía del docente con las iniciales como respaldo.
 *
 * Si la imagen no carga (archivo borrado, ruta rota) se cae a las iniciales
 * en lugar de dejar el icono de imagen rota del navegador.
 */
export function TeacherAvatar({ name, photoUrl, size = 'md', className }: TeacherAvatarProps) {
  const [failed, setFailed] = useState(false);
  const src = photoUrl && !failed ? assetUrl(photoUrl) : null;

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full',
        'bg-primary/10 font-semibold text-primary ring-1 ring-inset ring-border',
        SIZES[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Fotografía de ${name}`}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
}
