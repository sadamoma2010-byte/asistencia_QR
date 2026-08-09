'use client';

import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { assetUrl } from '@/lib/api';
import { cn, initials } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface PhotoPickerProps {
  /** Foto ya guardada en el servidor, si la hay. */
  currentUrl?: string | null;
  /** Nombre usado para las iniciales de respaldo. */
  name: string;
  /** Archivo elegido; `null` limpia la selección. */
  onSelect: (file: File | null) => void;
  /** Marca la foto existente para ser eliminada al guardar. */
  onRemoveExisting?: () => void;
  disabled?: boolean;
}

/**
 * Selector de fotografía con vista previa inmediata.
 *
 * El archivo no se sube aquí: se entrega al formulario, que lo envía cuando
 * el usuario guarda. Así una creación cancelada no deja archivos huérfanos.
 */
export function PhotoPicker({
  currentUrl,
  name,
  onSelect,
  onRemoveExisting,
  disabled,
}: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  // La URL temporal del archivo local debe liberarse al cambiar o desmontar
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown = preview ?? (!removed && currentUrl ? assetUrl(currentUrl) : null);

  const pick = (file: File | undefined) => {
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      toast.error('Formato no admitido. Use una imagen JPG, PNG, WEBP o GIF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(
        `La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo son 5 MB.`,
      );
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setRemoved(false);
    onSelect(file);
  };

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    onSelect(null);

    // Si había una foto guardada, se marca para borrarla del servidor
    if (currentUrl && !removed) {
      setRemoved(true);
      onRemoveExisting?.();
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label={shown ? 'Cambiar fotografía' : 'Seleccionar fotografía'}
        className={cn(
          'group relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-full',
          'bg-primary/10 text-lg font-semibold text-primary ring-1 ring-inset ring-border',
          'transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          !disabled && 'cursor-pointer hover:ring-primary',
          disabled && 'opacity-60',
        )}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Vista previa de la fotografía" className="size-full object-cover" />
        ) : (
          <span aria-hidden>{name.trim() ? initials(name) : <ImagePlus className="size-7" />}</span>
        )}

        {!disabled && (
          <span
            className="absolute inset-0 grid place-items-center bg-slate-900/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          >
            <Upload className="size-5" />
          </span>
        )}
      </button>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus />
            {shown ? 'Cambiar' : 'Seleccionar foto'}
          </Button>

          {shown && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={clear}>
              <Trash2 />
              Quitar
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          JPG, PNG, WEBP o GIF, hasta 5 MB. Se recorta en cuadrado automáticamente.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          // Permite volver a elegir el mismo archivo tras quitarlo
          event.target.value = '';
        }}
      />
    </div>
  );
}
