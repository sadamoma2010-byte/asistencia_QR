/**
 * Piezas de interfaz.
 *
 * Sustituye a Shadcn UI, Radix, React Hook Form y Framer Motion:
 * avisos emergentes, diálogo de confirmación, validación de formularios,
 * selección por casillas y transiciones. Todo en JavaScript propio.
 */
const Interfaz = (() => {

  // ── Avisos emergentes ─────────────────────────────────────────────

  const ESTILOS_AVISO = {
    exito: 'border-success/30 bg-success/10 text-emerald-800',
    error: 'border-destructive/30 bg-destructive/10 text-red-800',
    aviso: 'border-warning/30 bg-warning/10 text-amber-900',
    info: 'border-border bg-card text-foreground',
  };

  function aviso(mensaje, tipo = 'info', milisegundos = 4000) {
    const contenedor = document.getElementById('avisos');
    if (!contenedor) return;

    const nodo = document.createElement('div');
    nodo.className =
      'pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ' +
      'shadow-elevated backdrop-blur-md animate-slide-up ' +
      (ESTILOS_AVISO[tipo] || ESTILOS_AVISO.info);
    nodo.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    nodo.textContent = mensaje;

    contenedor.appendChild(nodo);

    setTimeout(() => {
      nodo.style.transition = 'opacity .25s, transform .25s';
      nodo.style.opacity = '0';
      nodo.style.transform = 'translateX(12px)';
      setTimeout(() => nodo.remove(), 250);
    }, milisegundos);
  }

  // ── Diálogo de confirmación ───────────────────────────────────────

  /**
   * Pide confirmación y resuelve a verdadero o falso.
   * Sustituye al AlertDialog de Shadcn.
   */
  function confirmar({ titulo, texto, detalle = '', etiqueta = 'Confirmar', peligro = true }) {
    return new Promise((resolver) => {
      const dialogo = document.getElementById('dialogo');
      const aceptar = dialogo.querySelector('[data-dialogo="confirmar"]');
      const cancelar = dialogo.querySelector('[data-dialogo="cancelar"]');
      const caja = dialogo.querySelector('#dialogo-detalle');

      dialogo.querySelector('#dialogo-titulo').textContent = titulo;
      dialogo.querySelector('#dialogo-texto').textContent = texto;
      aceptar.textContent = etiqueta;
      aceptar.className =
        'inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition hover:opacity-90 ' +
        (peligro
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-primary text-primary-foreground');

      caja.classList.toggle('hidden', !detalle);
      caja.innerHTML = detalle;

      dialogo.classList.remove('hidden');
      dialogo.classList.add('flex');
      aceptar.focus();

      const cerrar = (respuesta) => {
        dialogo.classList.add('hidden');
        dialogo.classList.remove('flex');
        aceptar.removeEventListener('click', alAceptar);
        cancelar.removeEventListener('click', alCancelar);
        document.removeEventListener('keydown', alTeclado);
        resolver(respuesta);
      };

      const alAceptar = () => cerrar(true);
      const alCancelar = () => cerrar(false);
      const alTeclado = (e) => {
        if (e.key === 'Escape') cerrar(false);
      };

      aceptar.addEventListener('click', alAceptar);
      cancelar.addEventListener('click', alCancelar);
      document.addEventListener('keydown', alTeclado);
    });
  }

  // ── Validación de formularios ─────────────────────────────────────

  function limpiarErrores(formulario) {
    formulario.querySelectorAll('[data-error]').forEach((nodo) => {
      nodo.textContent = '';
      nodo.classList.add('hidden');
    });
    formulario.querySelectorAll('[aria-invalid]').forEach((campo) => {
      campo.removeAttribute('aria-invalid');
      campo.classList.remove('border-destructive');
    });
  }

  /**
   * Reparte los errores que devuelve el servidor sobre sus campos.
   *
   * La API los envía como «campo: motivo», el mismo formato que usaba
   * class-validator, así que se separa por el primer dos puntos.
   */
  function mostrarErrores(formulario, error) {
    (error.errores || []).forEach((linea) => {
      const corte = linea.indexOf(':');
      if (corte < 0) return;

      const campo = linea.slice(0, corte).trim().split('.').pop();
      const motivo = linea.slice(corte + 1).trim();

      const destino = formulario.querySelector(`[data-error="${campo}"]`);
      if (destino) {
        destino.textContent = motivo;
        destino.classList.remove('hidden');
      }
      const entrada = formulario.querySelector(`[name="${campo}"]`);
      if (entrada) {
        entrada.setAttribute('aria-invalid', 'true');
        entrada.classList.add('border-destructive');
      }
    });
  }

  // ── Selección por casillas ────────────────────────────────────────

  /**
   * Conecta la casilla de la cabecera con las de cada fila.
   * Sustituye a la selección del DataTable en React.
   */
  function conectarSeleccion(raiz, alCambiar) {
    const cabecera = raiz.querySelector('[data-seleccion="todas"]');
    const filas = () => [...raiz.querySelectorAll('[data-seleccion="fila"]')];

    const marcadas = () => filas().filter((c) => c.checked);

    const refrescar = () => {
      const total = filas().length;
      const elegidas = marcadas();

      if (cabecera) {
        cabecera.checked = total > 0 && elegidas.length === total;
        // Estado intermedio: hay selección, pero no completa
        cabecera.indeterminate = elegidas.length > 0 && elegidas.length < total;
      }

      filas().forEach((casilla) => {
        const fila = casilla.closest('[data-fila]');
        if (fila) fila.classList.toggle('bg-accent/60', casilla.checked);
      });

      if (alCambiar) alCambiar(elegidas.map((c) => c.value));
    };

    if (cabecera) {
      cabecera.addEventListener('change', () => {
        filas().forEach((casilla) => {
          casilla.checked = cabecera.checked;
        });
        refrescar();
      });
    }
    filas().forEach((casilla) => casilla.addEventListener('change', refrescar));

    refrescar();
    return { seleccionadas: () => marcadas().map((c) => c.value), refrescar };
  }

  // ── Filtros que recargan la página ────────────────────────────────

  /**
   * Los filtros viajan en la dirección, no en memoria: así la página se
   * puede compartir, recargar y navegar hacia atrás sin perder el estado.
   */
  function conectarFiltros(formulario) {
    if (!formulario) return;

    const aplicar = () => {
      const parametros = new URLSearchParams();
      new FormData(formulario).forEach((valor, clave) => {
        if (String(valor).trim() !== '') parametros.set(clave, valor);
      });
      location.search = parametros.toString();
    };

    formulario.querySelectorAll('select').forEach((campo) =>
      campo.addEventListener('change', aplicar),
    );

    // La búsqueda espera a que se deje de escribir
    let temporizador;
    formulario.querySelectorAll('input[type="search"], input[name="search"]').forEach((campo) =>
      campo.addEventListener('input', () => {
        clearTimeout(temporizador);
        temporizador = setTimeout(aplicar, 450);
      }),
    );

    formulario.addEventListener('submit', (e) => {
      e.preventDefault();
      aplicar();
    });

    const limpiar = formulario.querySelector('[data-limpiar]');
    if (limpiar) limpiar.addEventListener('click', () => (location.search = ''));
  }

  // ── Utilidades ────────────────────────────────────────────────────

  function escapar(texto) {
    const nodo = document.createElement('div');
    nodo.textContent = texto ?? '';
    return nodo.innerHTML;
  }

  /** Mostrar u ocultar la contraseña en los campos que lo permiten. */
  document.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-ver-clave]');
    if (!boton) return;
    const campo = boton.parentElement.querySelector('input');
    const oculta = campo.type === 'password';
    campo.type = oculta ? 'text' : 'password';
    boton.setAttribute('aria-label', oculta ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  return {
    aviso,
    confirmar,
    limpiarErrores,
    mostrarErrores,
    conectarSeleccion,
    conectarFiltros,
    escapar,
  };
})();
