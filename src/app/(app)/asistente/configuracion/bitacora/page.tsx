import Form from "next/form";
import Link from "next/link";
import { AvisoEnlace, BotonEnviar } from "@/components/espera";
import { requerirAdmin } from "@/lib/auth/acceso";
import { DIAS, ESTADOS, FiltroBitacora, leerBitacora, personasConPreguntas, type Estado } from "@/lib/asistente/bitacora-servidor";
import { usd } from "@/lib/asistente/dinero";
import { ESTADO_TXT, fechaHora, miles, segundos, VALORACION_TXT } from "./textos";

const ETIQUETA_ESTADO: Record<Estado, string> = {
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
  fuera_de_alcance: "bg-amber-50 text-amber-800 border-amber-200",
  sin_datos: "bg-neutral-100 text-neutral-700 border-neutral-200",
  error: "bg-red-50 text-red-800 border-red-200",
};

export default async function Bitacora(props: PageProps<"/asistente/configuracion/bitacora">) {
  await requerirAdmin();
  const sp = await props.searchParams;
  const f = FiltroBitacora.parse({ estado: sp.estado, dias: sp.dias, usuario: sp.usuario, valoracion: sp.valoracion });
  const [{ filas, resumen, truncada }, personas] = await Promise.all([leerBitacora(f), personasConPreguntas()]);

  const enlace = (cambio: Partial<Record<"estado" | "dias" | "usuario" | "valoracion", string | undefined>>) => {
    const p = new URLSearchParams();
    const v = { estado: f.estado, dias: String(f.dias), usuario: f.usuario, valoracion: f.valoracion, ...cambio };
    for (const [k, x] of Object.entries(v)) if (x) p.set(k, x);
    return `/asistente/configuracion/bitacora?${p}`;
  };
  const pct = (n: number) => (resumen.preguntas ? `${Math.round((n / resumen.preguntas) * 100)}%` : "—");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Bitácora</h2>
        <p className="text-sm text-neutral-500">
          Cada pregunta con su respuesta, las reglas activas en ese momento, el tiempo que tardó, lo que costó en OpenRouter y cómo
          la valoró la persona. Sirve para ver qué pregunta el equipo, qué se bloquea y dónde conviene ajustar reglas o el banco de
          preguntas. No incluye datos de clientes.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <Filtro titulo="Periodo">
          {DIAS.map((d) => <Pastilla key={d} activa={f.dias === d} href={enlace({ dias: String(d) })}>Últimos {d} días</Pastilla>)}
        </Filtro>
        <Filtro titulo="Resultado">
          <Pastilla activa={!f.estado} href={enlace({ estado: undefined })}>Todos</Pastilla>
          {ESTADOS.map((e) => <Pastilla key={e} activa={f.estado === e} href={enlace({ estado: e })}>{ESTADO_TXT[e]}</Pastilla>)}
        </Filtro>
        <Filtro titulo="Valoración">
          <Pastilla activa={!f.valoracion} href={enlace({ valoracion: undefined })}>Todas</Pastilla>
          <Pastilla activa={f.valoracion === "negativa"} href={enlace({ valoracion: "negativa" })}>Con 👎</Pastilla>
          <Pastilla activa={f.valoracion === "positiva"} href={enlace({ valoracion: "positiva" })}>Con 👍</Pastilla>
        </Filtro>
        <Form className="flex items-center gap-2" action="/asistente/configuracion/bitacora">
          <input type="hidden" name="dias" value={f.dias} />
          {f.estado && <input type="hidden" name="estado" value={f.estado} />}
          {f.valoracion && <input type="hidden" name="valoracion" value={f.valoracion} />}
          <label htmlFor="usuario" className="text-xs text-neutral-500">Persona</label>
          <select id="usuario" name="usuario" defaultValue={f.usuario ?? ""} className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-sm">
            <option value="">Todas</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <BotonEnviar pendiente="Filtrando…" className="h-8 rounded-md border border-neutral-200 bg-white px-3 text-xs font-medium hover:bg-neutral-100">Filtrar</BotonEnviar>
        </Form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Dato titulo="Preguntas" valor={String(resumen.preguntas)} nota={`${resumen.personas} ${resumen.personas === 1 ? "persona" : "personas"}`} />
        <Dato titulo="Fuera de alcance" valor={pct(resumen.fueraDeAlcance)} nota={`${resumen.fueraDeAlcance} bloqueadas por reglas fijas o del admin`} />
        <Dato titulo="Redacción automática" valor={resumen.conModelo ? `${Math.round((resumen.respaldo / resumen.conModelo) * 100)}%` : "—"}
          nota={`${resumen.respaldo} de ${resumen.conModelo} con IA: el texto traía cifras no verificadas o la IA falló`} />
        <Dato titulo="Errores" valor={pct(resumen.errores)} nota={`${resumen.errores} con error · ${resumen.sinDatos} sin datos`} />
        <Dato titulo="Tiempo típico" valor={resumen.medianaSeg === null ? "—" : `${segundos(resumen.medianaSeg)} s`} nota="mediana por pregunta" />
        <Dato titulo="Valoraciones" valor={`👍 ${resumen.positivas} · 👎 ${resumen.negativas}`}
          nota={`${resumen.comentarios} con comentario · ${resumen.preguntas ? Math.round(((resumen.positivas + resumen.negativas) / resumen.preguntas) * 100) : 0}% valoradas`} />
        <Dato titulo="Costo de IA" valor={usd(resumen.costoUsd)}
          nota={resumen.conCosto
            ? `${resumen.conCosto} preguntas con costo · ${usd(resumen.costoUsd / resumen.conCosto)} en promedio · ${miles(resumen.tokens)} tokens${resumen.estimadas ? ` · ${resumen.estimadas} estimadas` : ""}`
            : "Ninguna pregunta del periodo usó IA con costo registrado"} />
        <Dato titulo="Frenadas por el tope" valor={String(resumen.porTope)} nota="respondidas con el análisis automático por el tope de gasto del mes" />
      </div>

      {resumen.porModelo.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Costo por modelo en el periodo</h3>
          <div className="overflow-x-auto border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="px-3 py-2 font-medium">Modelo</th>
                  <th className="px-3 py-2 text-right font-medium">Preguntas</th>
                  <th className="px-3 py-2 text-right font-medium">Tokens</th>
                  <th className="px-3 py-2 text-right font-medium">Costo</th>
                  <th className="px-3 py-2 text-right font-medium">Por pregunta</th>
                </tr>
              </thead>
              <tbody>
                {resumen.porModelo.map((m) => (
                  <tr key={m.modelo} className="border-b border-neutral-100 last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs">{m.modelo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.preguntas}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{miles(m.tokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{usd(m.costoUsd)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{usd(m.costoUsd / m.preguntas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="overflow-x-auto border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Persona</th>
              <th className="px-3 py-2 font-medium">Pregunta</th>
              <th className="px-3 py-2 font-medium">Resultado</th>
              <th className="px-3 py-2 font-medium">Redacción</th>
              <th className="px-3 py-2 text-right font-medium">Reglas</th>
              <th className="px-3 py-2 text-right font-medium">Tiempo</th>
              <th className="px-3 py-2 text-right font-medium">Costo</th>
              <th className="px-3 py-2 font-medium">Valoración</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-neutral-500">No hay preguntas con estos filtros.</td></tr>
            )}
            {filas.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                <td className="whitespace-nowrap px-3 py-2 text-neutral-600 tabular-nums">{fechaHora(r.creado_en)}</td>
                <td className="whitespace-nowrap px-3 py-2">{r.usuario}</td>
                <td className="max-w-md px-3 py-2">
                  <Link href={`/asistente/configuracion/bitacora/${r.id}`} className="line-clamp-2 underline-offset-4 hover:underline">{r.pregunta}</Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${ETIQUETA_ESTADO[r.estado]}`}>{ESTADO_TXT[r.estado]}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-600">
                  {r.modo === "modelo" ? (r.respaldo ? "Automática (respaldo)" : "IA verificada")
                    : r.modo === "determinista" ? (r.motivo_automatico === "tope_gasto" ? "Automática (tope)" : r.motivo_automatico === "modelo_no_permitido" ? "Automática (no permitido)" : r.motivo_automatico === "presupuesto_usuario" ? "Automática (presupuesto)" : "Automática") : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{r.reglas || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-neutral-600">{r.duracion_ms === null ? "—" : `${segundos(r.duracion_ms / 1000)} s`}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-neutral-600"
                  title={r.tokens === null ? undefined : `${miles(r.tokens)} tokens${r.costo_estimado ? " · costo estimado con los precios del catálogo" : ""}`}>
                  {r.costo_usd === null ? "—" : `${r.costo_estimado ? "≈ " : ""}${usd(r.costo_usd)}`}
                </td>
                <td className="max-w-56 px-3 py-2 text-xs">
                  {r.valoracion ? (
                    <span className="block truncate" title={r.valoracion.comentario ?? undefined}>
                      {VALORACION_TXT[String(r.valoracion.util) as "true" | "false"]}
                      {r.valoracion.comentario && <span className="text-neutral-600"> · {r.valoracion.comentario}</span>}
                    </span>
                  ) : <span className="text-neutral-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {truncada && <p className="text-xs text-neutral-500">Se muestran las 2,000 preguntas más recientes del periodo; el resumen se calcula sobre ellas.</p>}
    </div>
  );
}

function Filtro({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-neutral-500">{titulo}</span>
      {children}
    </div>
  );
}

function Pastilla({ activa, href, children }: { activa: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={activa ? "page" : undefined}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${activa ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"}`}>
      {children}<AvisoEnlace />
    </Link>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="border border-neutral-200 bg-white p-4">
      <div className="text-xs text-neutral-500">{titulo}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{valor}</div>
      <div className="mt-1 text-xs text-neutral-500">{nota}</div>
    </div>
  );
}
