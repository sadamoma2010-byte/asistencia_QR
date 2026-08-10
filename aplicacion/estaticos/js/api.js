/**
 * Cliente de la API.
 *
 * Sustituye a TanStack Query y al cliente HTTP del frontend en React.
 * Sin dependencias: solo `fetch`.
 *
 * La sesión viaja en la cookie del navegador, que el servidor emite al
 * entrar. No hace falta adjuntar el token en cada llamada.
 */
const Api = (() => {
  const BASE = '/api/v1';

  /** Error de la API con el mensaje ya legible y los fallos por campo. */
  class ErrorApi extends Error {
    constructor(mensaje, codigo, errores) {
      super(mensaje);
      this.mensaje = mensaje;
      this.codigo = codigo;
      this.errores = errores || [];
    }
  }

  async function pedir(ruta, opciones = {}) {
    const respuesta = await fetch(`${BASE}${ruta}`, {
      credentials: 'same-origin',
      ...opciones,
      headers: {
        Accept: 'application/json',
        ...(opciones.cuerpoCrudo ? {} : { 'Content-Type': 'application/json' }),
        ...(opciones.headers || {}),
      },
    });

    // Las descargas no traen JSON: se devuelven tal cual
    const tipo = respuesta.headers.get('Content-Type') || '';
    if (!tipo.includes('application/json')) {
      if (!respuesta.ok) throw new ErrorApi('No fue posible completar la descarga', respuesta.status);
      return respuesta;
    }

    const cuerpo = await respuesta.json().catch(() => null);

    if (!respuesta.ok || !cuerpo || cuerpo.success === false) {
      // La sesión caducó: se vuelve al acceso conservando a dónde se iba
      if (respuesta.status === 401 && !location.pathname.startsWith('/login')) {
        location.href = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
        return null;
      }
      throw new ErrorApi(
        (cuerpo && cuerpo.message) || 'Ha ocurrido un error inesperado',
        respuesta.status,
        cuerpo && cuerpo.errors,
      );
    }

    return cuerpo.data;
  }

  const conCuerpo = (metodo) => (ruta, datos) =>
    pedir(ruta, { method: metodo, body: JSON.stringify(datos ?? {}) });

  return {
    ErrorApi,
    get: (ruta) => pedir(ruta),
    post: conCuerpo('POST'),
    patch: conCuerpo('PATCH'),
    put: conCuerpo('PUT'),
    delete: (ruta) => pedir(ruta, { method: 'DELETE' }),

    /** Envío de archivos: el navegador pone su propio Content-Type. */
    subir: (ruta, formulario) =>
      pedir(ruta, { method: 'POST', body: formulario, cuerpoCrudo: true }),

    /** Descarga un archivo respetando el nombre que envía el servidor. */
    async descargar(ruta, nombrePorDefecto) {
      const respuesta = await pedir(ruta);
      const contenido = await respuesta.blob();

      const cabecera = respuesta.headers.get('Content-Disposition') || '';
      const coincidencia = cabecera.match(/filename="?([^"]+)"?/);

      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(contenido);
      enlace.download = coincidencia ? coincidencia[1] : nombrePorDefecto;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(enlace.href);
    },
  };
})();
