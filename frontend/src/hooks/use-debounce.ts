'use client';

import { useEffect, useState } from 'react';

/** Retrasa la propagación de un valor: evita disparar una consulta por tecla. */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
