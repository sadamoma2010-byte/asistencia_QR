'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { FormDialog } from '@/components/forms/form-dialog';
import { FormField } from '@/components/forms/form-field';
import { Input } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api';
import { changePasswordSchema, type ChangePasswordForm } from '@/lib/validations';
import { useAuth } from '@/providers/auth-provider';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const { logout } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordForm) =>
      api.post<{ message: string }>('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: (result) => {
      toast.success(result.message);
      reset();
      onOpenChange(false);
      // El backend revoca las sesiones activas: se exige un nuevo ingreso
      void logout();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.detail : 'No fue posible actualizar la contraseña',
      ),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Cambiar contraseña"
      description="Por seguridad se cerrarán todas las sesiones activas tras el cambio."
      submitLabel="Actualizar contraseña"
      loading={mutation.isPending}
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <div className="space-y-4">
        <FormField label="Contraseña actual" error={errors.currentPassword?.message} required>
          {(field) => (
            <Input
              {...field}
              {...register('currentPassword')}
              type="password"
              autoComplete="current-password"
              error={Boolean(errors.currentPassword)}
            />
          )}
        </FormField>

        <FormField
          label="Nueva contraseña"
          error={errors.newPassword?.message}
          hint="Mínimo 8 caracteres con mayúscula, minúscula, número y carácter especial."
          required
        >
          {(field) => (
            <Input
              {...field}
              {...register('newPassword')}
              type="password"
              autoComplete="new-password"
              error={Boolean(errors.newPassword)}
            />
          )}
        </FormField>

        <FormField label="Confirmar nueva contraseña" error={errors.confirmPassword?.message} required>
          {(field) => (
            <Input
              {...field}
              {...register('confirmPassword')}
              type="password"
              autoComplete="new-password"
              error={Boolean(errors.confirmPassword)}
            />
          )}
        </FormField>
      </div>
    </FormDialog>
  );
}
