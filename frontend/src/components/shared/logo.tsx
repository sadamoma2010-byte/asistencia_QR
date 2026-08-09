import { cn } from '@/lib/utils';

/**
 * Logo institucional del sistema.
 * PENDIENTE DE DEFINICIÓN: sustituir por la marca oficial de la institución.
 */
export function Logo({ className, size = 44 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Logo del Sistema de Asistencia Docente"
    >
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="0.55" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#4338CA" />
        </linearGradient>
      </defs>

      <rect width="48" height="48" rx="13" fill="url(#logo-bg)" />

      {/* Marcas de un código QR */}
      <rect x="11" y="11" width="9" height="9" rx="2.5" stroke="white" strokeWidth="2.4" />
      <rect x="28" y="11" width="9" height="9" rx="2.5" stroke="white" strokeWidth="2.4" />
      <rect x="11" y="28" width="9" height="9" rx="2.5" stroke="white" strokeWidth="2.4" />

      {/* Verificación de asistencia */}
      <path
        d="M27.5 32.8L31.1 36.4L38 29.5"
        stroke="#10B981"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
