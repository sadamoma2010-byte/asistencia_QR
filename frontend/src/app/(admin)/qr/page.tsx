'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Copy,
  Download,
  ExternalLink,
  FileImage,
  FileCode2,
  History,
  QrCode,
  Save,
} from 'lucide-react';
import QRCodeLib from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { FormField } from '@/components/forms/form-field';
import { AccessDenied } from '@/components/shared/auth-guard';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { ApiError, api } from '@/lib/api';
import { downloadBlob, formatDateTime } from '@/lib/utils';
import { qrConfigSchema, type QrConfigForm } from '@/lib/validations';
import { useAuth } from '@/providers/auth-provider';
import type { QrConfig, QrHistoryEntry } from '@/types';

const QR_OPTIONS = {
  errorCorrectionLevel: 'H' as const,
  margin: 2,
  width: 1024,
  color: { dark: '#0F172A', light: '#FFFFFF' },
};

export default function QrPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<string | null>(null);

  const config = useQuery({
    queryKey: ['settings', 'qr'],
    queryFn: () => api.get<QrConfig>('/settings/qr'),
    enabled: can('settings.read'),
  });

  const history = useQuery({
    queryKey: ['settings', 'qr', 'history'],
    queryFn: () => api.get<QrHistoryEntry[]>('/settings/qr/history?limit=30'),
    enabled: can('settings.read'),
  });

  const form = useForm<QrConfigForm>({
    resolver: zodResolver(qrConfigSchema),
    defaultValues: { publicUrl: '', institutionName: '' },
  });

  const save = useMutation({
    mutationFn: (values: QrConfigForm) => api.patch<QrConfig>('/settings/qr', values),
    onSuccess: () => {
      toast.success('La configuración del QR se actualizó correctamente');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.detail : 'No fue posible actualizar la configuración',
      ),
  });

  useEffect(() => {
    if (!config.data) return;
    form.reset({
      publicUrl: config.data.publicUrl,
      institutionName: config.data.institutionName,
    });
  }, [config.data, form]);

  // El QR se regenera cada vez que cambia la URL en el formulario
  const currentUrl = form.watch('publicUrl');

  useEffect(() => {
    if (!currentUrl || !qrConfigSchema.shape.publicUrl.safeParse(currentUrl).success) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void QRCodeLib.toDataURL(currentUrl, { ...QR_OPTIONS, width: 512 }).then((dataUrl) => {
      if (!cancelled) setPreview(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUrl]);

  const downloadPng = useCallback(async () => {
    try {
      const dataUrl = await QRCodeLib.toDataURL(currentUrl, QR_OPTIONS);
      const blob = await (await fetch(dataUrl)).blob();
      downloadBlob(blob, 'qr-asistencia-docente.png');
      toast.success('Código QR descargado en PNG');
    } catch {
      toast.error('No fue posible generar el archivo PNG');
    }
  }, [currentUrl]);

  const downloadSvg = useCallback(async () => {
    try {
      const svg = await QRCodeLib.toString(currentUrl, { ...QR_OPTIONS, type: 'svg' });
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr-asistencia-docente.svg');
      toast.success('Código QR descargado en SVG');
    } catch {
      toast.error('No fue posible generar el archivo SVG');
    }
  }, [currentUrl]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      toast.success('URL copiada al portapapeles');
    } catch {
      toast.error('No fue posible copiar la URL');
    }
  };

  if (!can('settings.read')) return <AccessDenied />;

  return (
    <>
      <PageHeader
        title="Código QR institucional"
        description="Un único código QR para toda la institución. Los docentes lo escanean y registran su entrada o salida."
        icon={QrCode}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* ── Vista previa ─────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vista previa</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col items-center gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[16rem] rounded-2xl border border-border bg-white p-5 shadow-card"
            >
              {config.isLoading ? (
                <Skeleton className="aspect-square w-full rounded-lg" />
              ) : preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Código QR institucional para el registro de asistencia"
                  className="aspect-square w-full"
                />
              ) : (
                <div className="grid aspect-square w-full place-items-center rounded-lg bg-muted text-center text-xs text-muted-foreground">
                  Ingrese una URL válida para generar el código
                </div>
              )}

              <p className="mt-3 text-center text-sm font-semibold text-slate-900">
                {form.watch('institutionName') || 'Institución'}
              </p>
              <p className="text-center text-[11px] text-slate-500">
                Escanee para registrar su asistencia
              </p>
            </motion.div>

            <div className="grid w-full grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => void downloadPng()} disabled={!preview}>
                <FileImage />
                PNG
              </Button>
              <Button variant="outline" onClick={() => void downloadSvg()} disabled={!preview}>
                <FileCode2 />
                SVG
              </Button>
            </div>

            <div className="grid w-full grid-cols-2 gap-2">
              <Button variant="ghost" size="sm" onClick={() => void copyUrl()} disabled={!currentUrl}>
                <Copy />
                Copiar URL
              </Button>
              {preview ? (
                <Button variant="ghost" size="sm" asChild>
                  <a href={currentUrl} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Probar
                  </a>
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled>
                  <ExternalLink />
                  Probar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Configuración ────────────────────────────────── */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configuración</CardTitle>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={form.handleSubmit((values) => save.mutate(values))}
              className="space-y-4"
            >
              <FormField
                label="URL pública del QR"
                error={form.formState.errors.publicUrl?.message}
                hint="Debe apuntar a la ruta /marcar del dominio público del sistema."
                required
              >
                {(field) => (
                  <Input
                    {...field}
                    {...form.register('publicUrl')}
                    placeholder="https://asistencia.institucion.edu.co/marcar"
                    disabled={!can('settings.update')}
                    error={Boolean(form.formState.errors.publicUrl)}
                  />
                )}
              </FormField>

              <FormField
                label="Nombre institucional"
                error={form.formState.errors.institutionName?.message}
                hint="Se imprime debajo del código al descargarlo."
                required
              >
                {(field) => (
                  <Input
                    {...field}
                    {...form.register('institutionName')}
                    placeholder="Institución Educativa"
                    disabled={!can('settings.update')}
                    error={Boolean(form.formState.errors.institutionName)}
                  />
                )}
              </FormField>

              {can('settings.update') && (
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      config.data &&
                      form.reset({
                        publicUrl: config.data.publicUrl,
                        institutionName: config.data.institutionName,
                      })
                    }
                    disabled={!form.formState.isDirty}
                  >
                    Descartar cambios
                  </Button>
                  <Button type="submit" loading={save.isPending} disabled={!form.formState.isDirty}>
                    <Save />
                    Guardar configuración
                  </Button>
                </div>
              )}
            </form>

            <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-secondary">
              <p className="font-medium text-foreground">Cómo funciona</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Imprima el código y ubíquelo en el punto de acceso institucional.</li>
                <li>El docente lo escanea desde su celular y accede con sus credenciales.</li>
                <li>Selecciona «Registrar Entrada» o «Registrar Salida».</li>
                <li>El sistema valida su horario, calcula la puntualidad y registra la auditoría.</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Historial de cambios ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-primary" />
            Historial de cambios
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          {history.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : history.data && history.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {history.data.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-foreground">
                      {entry.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.userName ?? 'Sistema'} · {entry.ipAddress ?? '—'}
                      {entry.device && ` · ${entry.device}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Sin cambios registrados"
              description="Cuando modifique la URL o el nombre institucional, el cambio quedará registrado aquí."
              icon={History}
            />
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        <Download className="mr-1 inline size-3" />
        Recomendación: imprima el QR en tamaño mínimo de 8 × 8 cm para una lectura confiable.
      </p>
    </>
  );
}
