'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { FormField } from '@/components/forms/form-field';
import { GradientBackground } from '@/components/shared/background';
import { Logo } from '@/components/shared/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { loginSchema, type LoginForm } from '@/lib/validations';
import { useAuth } from '@/providers/auth-provider';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  );
}

function LoginView() {
  const { login, isAuthenticated, isTeacherOnly, loading: sessionLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Sesión ya iniciada: se redirige al destino según el rol
  useEffect(() => {
    if (sessionLoading || !isAuthenticated) return;

    // Único responsable del redirect tras autenticarse: cubre tanto la sesión
    // ya existente al montar como el ingreso recién hecho desde el formulario.
    // Lanzarlo también desde `onSubmit` provocaba dos `router.replace`
    // simultáneos que se cancelaban entre sí y dejaban la vista en /login.
    const redirectTo = searchParams.get('redirect');
    const fallback = isTeacherOnly ? '/marcar' : '/dashboard';
    router.replace(redirectTo?.startsWith('/') ? redirectTo : fallback);
  }, [sessionLoading, isAuthenticated, isTeacherOnly, searchParams, router]);

  useEffect(() => {
    if (searchParams.get('expired')) {
      toast.info('Su sesión expiró. Inicie sesión nuevamente.');
    }
  }, [searchParams]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values.email, values.password);
      toast.success(`Bienvenido, ${user.firstName}`);
      // La navegación la resuelve el efecto de arriba al cambiar `isAuthenticated`
    } catch (error) {
      const message =
        error instanceof ApiError ? error.detail : 'No fue posible iniciar sesión. Intente de nuevo.';
      setFormError(message);
    }
  });

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <GradientBackground />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        {/* ── Encabezado institucional ─────────────────────── */}
        <div className="mb-7 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Logo size={60} className="drop-shadow-lg" />
          </motion.div>

          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Sistema de Asistencia Docente
          </h1>
          <p className="mt-2 max-w-sm text-sm text-secondary text-balance">
            Control y seguimiento de asistencia mediante QR
          </p>
        </div>

        {/* ── Tarjeta de acceso ────────────────────────────── */}
        <div className="glass-card rounded-2xl p-6 sm:p-8">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <FormField label="Correo institucional" error={errors.email?.message} required>
              {(field) => (
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    {...field}
                    {...register('email')}
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    placeholder="usuario@institucion.edu.co"
                    className="pl-9"
                    error={Boolean(errors.email)}
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </FormField>

            <FormField label="Contraseña" error={errors.password?.message} required>
              {(field) => (
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    {...field}
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="px-9"
                    error={Boolean(errors.password)}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </FormField>

            {formError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-destructive/25 bg-red-50 px-3 py-2.5 text-sm font-medium text-destructive"
                role="alert"
              >
                {formError}
              </motion.p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              {!isSubmitting && <LogIn />}
              {isSubmitting ? 'Verificando…' : 'Ingresar'}
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-2 border-t border-border/70 pt-5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-px size-4 shrink-0 text-success" />
            <p>
              Acceso protegido con cifrado y control de intentos. Todas las acciones quedan
              registradas en la auditoría del sistema.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Problemas para ingresar? Comuníquese con el administrador del sistema.
        </p>
      </motion.div>
    </main>
  );
}
