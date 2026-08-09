'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Save, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { FormField } from '@/components/forms/form-field';
import { AccessDenied } from '@/components/shared/auth-guard';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { ApiError, api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Setting, SettingGroup } from '@/types';

const GROUP_LABEL: Record<string, string> = {
  general: 'General',
  qr: 'Código QR',
  attendance: 'Asistencia',
};

export default function SettingsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'all'],
    queryFn: () => api.get<SettingGroup[]>('/settings'),
    enabled: can('settings.read'),
  });

  useEffect(() => {
    if (!data) return;
    const initial: Record<string, string> = {};
    for (const group of data) {
      for (const setting of group.settings) initial[setting.key] = setting.value;
    }
    setValues(initial);
  }, [data]);

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.patch<Setting>(`/settings/${key}`, { value }),
    onSuccess: (setting) => {
      toast.success(`«${setting.label}» se actualizó correctamente`);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.detail : 'No fue posible actualizar el parámetro',
      ),
  });

  if (!can('settings.read')) return <AccessDenied />;

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Parámetros generales del sistema. Cada cambio queda registrado en la auditoría."
        icon={Settings}
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {(data ?? []).map((group) => (
            <Card key={group.group}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {GROUP_LABEL[group.group] ?? group.group}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5">
                {group.settings.map((setting) => {
                  const changed = values[setting.key] !== setting.value;

                  return (
                    <div
                      key={setting.id}
                      className="flex flex-col gap-3 border-b border-border pb-5 last:border-0 last:pb-0 lg:flex-row lg:items-end"
                    >
                      <div className="min-w-0 flex-1">
                        <FormField
                          label={setting.label}
                          hint={setting.description ?? undefined}
                        >
                          {(field) => (
                            <Input
                              {...field}
                              type={setting.type === 'NUMBER' ? 'number' : 'text'}
                              value={values[setting.key] ?? ''}
                              onChange={(event) =>
                                setValues((current) => ({
                                  ...current,
                                  [setting.key]: event.target.value,
                                }))
                              }
                              disabled={!can('settings.update') || setting.isSystem}
                            />
                          )}
                        </FormField>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <code className="text-[11px] text-muted-foreground">{setting.key}</code>
                          {setting.isSystem && (
                            <Badge variant="secondary">
                              <Lock className="size-3" />
                              Sistema
                            </Badge>
                          )}
                          {setting.isPublic && <Badge variant="outline">Público</Badge>}
                          <span className="text-[11px] text-muted-foreground">
                            Actualizado {formatDateTime(setting.updatedAt)}
                          </span>
                        </div>
                      </div>

                      {can('settings.update') && !setting.isSystem && (
                        <Button
                          size="sm"
                          disabled={!changed || save.isPending}
                          loading={save.isPending && save.variables?.key === setting.key}
                          onClick={() =>
                            save.mutate({ key: setting.key, value: values[setting.key] ?? '' })
                          }
                          className="shrink-0"
                        >
                          <Save />
                          Guardar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="p-4 text-sm text-amber-900">
          <p className="font-medium">Parámetros del sistema</p>
          <p className="mt-1">
            Los parámetros marcados como «Sistema» (por ejemplo la zona horaria) afectan el cálculo
            de puntualidad y el corte de día. Su modificación requiere ajustar también la variable de
            entorno correspondiente del servidor.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
