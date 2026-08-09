'use client';

import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

/**
 * Fondo institucional: gradiente suave con tres orbes desenfocados
 * (azul, verde y violeta). Es puramente decorativo.
 */
export function GradientBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('app-gradient pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}
    >
      <motion.div
        className="orb orb-blue left-[-18%] top-[-12%] size-[22rem] sm:size-[30rem]"
        animate={{ y: [0, -26, 0], x: [0, 14, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="orb orb-green bottom-[-16%] right-[-14%] size-[20rem] sm:size-[28rem]"
        animate={{ y: [0, 24, 0], x: [0, -18, 0] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
      <motion.div
        className="orb orb-violet left-[38%] top-[22%] size-[18rem] opacity-40 sm:size-[26rem]"
        animate={{ y: [0, -18, 0], scale: [1, 1.07, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
    </div>
  );
}

/** Variante estática y discreta para el área administrativa. */
export function SubtleBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div className="orb orb-violet left-[-10%] top-[-14%] size-[26rem] opacity-[0.18]" />
      <div className="orb orb-blue right-[-12%] top-[10%] size-[22rem] opacity-[0.14]" />
      <div className="orb orb-green bottom-[-18%] left-[30%] size-[24rem] opacity-[0.12]" />
    </div>
  );
}
