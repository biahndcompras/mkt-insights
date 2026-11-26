"use client";
/**
 * Señal de espera para lo que `loading.tsx` no cubre: cambiar filtros, paginar o enviar un formulario dentro de la
 * misma pantalla. React deja visible el contenido anterior hasta que llega el nuevo, así que sin esto la pantalla
 * parece no responder. Quien navega avisa (`useAvisarEspera`, `<AvisoEnlace>`, `<BotonEnviar>`) y el marco de la app
 * muestra una barra arriba y atenúa el contenido (`useEspera`, `<BarraEspera>`).
 */
import { useLinkStatus } from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";

let enCurso = 0;
const oyentes = new Set<() => void>();
const cambiar = (d: number) => { enCurso = Math.max(0, enCurso + d); oyentes.forEach((f) => f()); };
const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };

/** Mientras `pendiente` sea verdadero, la app muestra que está trabajando. */
export function useAvisarEspera(pendiente: boolean) {
  useEffect(() => {
    if (!pendiente) return;
    cambiar(1);
    return () => cambiar(-1);
  }, [pendiente]);
}

/** ¿Hay alguna navegación o envío en curso? */
export function useEspera(): boolean {
  return useSyncExternalStore(suscribir, () => enCurso > 0, () => false);
}

/** Va dentro de un `<Link>` que cambia solo los parámetros de la pantalla (filtro, pestaña, página). No dibuja nada. */
export function AvisoEnlace() {
  useAvisarEspera(useLinkStatus().pending);
  return null;
}

/** Botón de envío de un formulario: se desactiva y cambia el texto mientras el envío está en curso. */
export function BotonEnviar({ children, pendiente = "Un momento…", className }: { children: React.ReactNode; pendiente?: string; className?: string }) {
  const { pending } = useFormStatus();
  useAvisarEspera(pending);
  return <button type="submit" disabled={pending} aria-busy={pending} className={`${className ?? ""} disabled:cursor-wait disabled:opacity-60`}>{pending ? pendiente : children}</button>;
}

/** Barra fina arriba de la ventana. Aparece con un pequeño retraso para no parpadear en respuestas inmediatas. */
export function BarraEspera() {
  const esperando = useEspera();
  if (!esperando) return null;
  return (
    <div role="status" className="espera-aparecer pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-neutral-200">
      <span className="sr-only">Actualizando…</span>
      <div aria-hidden className="espera-barra h-full w-1/3 bg-neutral-900" />
    </div>
  );
}
