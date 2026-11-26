import Form from "next/form";
import Link from "next/link";
import { BotonEnviar } from "@/components/espera";
import { requerirAcceso } from "@/lib/auth/acceso";
import { pctTexto, rutaResumen, datosResumen, type Explicacion, type Indicador } from "@/lib/cargas/resumen";
import { fuenteResumen, versiones } from "@/lib/cargas/servidor";
import { capital, fechaCorta, fechaLocal, lempirasCompacto, periodoCorto, periodoLargo } from "@/lib/format";
import { BotonImprimir } from "./imprimir";

/**
 * Resumen ejecutivo del mes (G9, S21): para leer en una pantalla o imprimir en una hoja. Cualquiera con acceso.
 * ?version=N (por defecto la vigente) y ?periodo=YYYY-MM (por defecto el último mes cerrado de esa versión).
 */
export default async function Resumen(props: PageProps<"/resumen">) {
  await requerirAcceso(); // el layout no se vuelve a ejecutar en cada navegación
  const sp = await props.searchParams;
  const [r, historial] = await Promise.all([datosResumen(fuenteResumen, sp), versiones()]);
  if (!r) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Resumen del mes</h1>
        <p className="text-sm text-neutral-500">Esa versión no existe o todavía no hay una versión publicada.</p>
        <Link href="/resumen" className="text-sm underline">Ver el de la versión vigente</Link>
      </div>
    );
  }
  const v = r.version;
  const valorPeriodo = `${r.periodo.anio}-${String(r.periodo.mes).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Impresión: fuera el menú y el encabezado de la app, una hoja limpia en A4. */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { background: #fff !important; }
          aside, header, .resumen-no-imprimir { display: none !important; }
          main { padding: 0 !important; }
          .resumen-bloque { break-inside: avoid; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <Form action="/resumen" className="resumen-no-imprimir flex flex-wrap items-end gap-3 border border-neutral-200 bg-white p-3 text-sm">
        <label className="space-y-1">
          <span className="block text-xs text-neutral-500">Versión</span>
          <select name="version" defaultValue={v.version} className="block h-9 border border-input bg-background px-2 text-sm">
            {historial.map((h) => (
              <option key={h.version} value={h.version}>v{h.version} · corte {fechaCorta(h.fecha_corte)}{h.retirada_en ? " (retirada)" : ""}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-neutral-500">Mes</span>
          <select name="periodo" defaultValue={valorPeriodo} className="block h-9 border border-input bg-background px-2 text-sm">
            {[...v.periodos].reverse().map((p) => {
              const valor = `${p.anio}-${String(p.mes).padStart(2, "0")}`;
              return <option key={valor} value={valor}>{periodoCorto(p)}{p.cerrado ? "" : " (parcial)"}</option>;
            })}
          </select>
        </label>
        <BotonEnviar pendiente="Cargando…" className="h-9 border border-neutral-300 px-3 text-sm hover:bg-neutral-50">Ver</BotonEnviar>
        <div className="ml-auto"><BotonImprimir /></div>
      </Form>

      <div className="space-y-1">
        <div className="text-xs tracking-wide text-neutral-500 uppercase">BIA Foresight · Resumen ejecutivo</div>
        <h1 className="text-2xl font-semibold">{capital(periodoLargo(r.periodo))}</h1>
        <p className="text-sm text-neutral-600">
          Versión v{v.version} · corte {fechaCorta(v.fecha_corte)} · publicada {fechaLocal(v.publicado_en)} ·{" "}
          {v.conciliada_bi ? "conciliada con BI" : "sin conciliar con BI"}
        </p>
        <p className="pt-2 text-base">{r.titular}</p>
      </div>

      {r.avisos.length > 0 && (
        <section className="resumen-bloque space-y-1 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <h2 className="font-semibold">Ten en cuenta</h2>
          <ul className="list-disc space-y-0.5 pl-5">{r.avisos.map((a, i) => <li key={`${i}-${a}`}>{a}</li>)}</ul>
        </section>
      )}

      <section className="resumen-bloque border border-neutral-200 bg-white">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-xs text-neutral-500">
            <tr className="border-b border-neutral-200">
              <th className="p-3 text-left font-medium">Indicador</th>
              <th className="p-3 text-right font-medium">{capital(periodoLargo(r.periodo))}</th>
              <th className="p-3 text-right font-medium">vs. {periodoLargo(r.anterior)}</th>
              <th className="p-3 text-right font-medium">vs. {periodoLargo(r.anioAnterior)}</th>
            </tr>
          </thead>
          <tbody>{r.indicadores.map((i) => <FilaIndicador key={i.clave} i={i} />)}</tbody>
        </table>
      </section>

      {r.explicaciones.map((e) => <BloqueExplicacion key={e.contra} e={e} />)}

      <p className="text-xs text-neutral-500">
        Cifras del cubo de ventas publicado (versión v{v.version}, archivo {v.archivo}). Precio promedio = venta neta / kg (S5);
        cliente con compra = venta neta mayor a cero en el mes (S4). El detalle por filtros está en el{" "}
        <Link href={`/?periodo=${valorPeriodo}`} className="underline">dashboard</Link>. Este resumen: {rutaResumen(r)}
      </p>
    </div>
  );
}

const tono = (p: number | null) => (p === null ? "text-neutral-500" : p >= 0 ? "text-emerald-700" : "text-red-700");

function FilaIndicador({ i }: { i: Indicador }) {
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="p-3">{i.titulo}</td>
      <td className="p-3 text-right text-base font-semibold">{i.texto}</td>
      <td className={`p-3 text-right ${tono(i.pctAnterior)}`}>{pctTexto(i.pctAnterior)}</td>
      <td className={`p-3 text-right ${tono(i.pctAnio)}`}>{pctTexto(i.pctAnio)}</td>
    </tr>
  );
}

const signo = (v: number) => `${v >= 0 ? "+" : "−"}${lempirasCompacto(Math.abs(v))}`;

function BloqueExplicacion({ e }: { e: Explicacion }) {
  const contra = periodoLargo(e.periodo);
  return (
    <section className="resumen-bloque space-y-2">
      <h2 className="text-sm font-semibold">
        Qué explica la variación frente a {contra} <span className="font-normal text-neutral-500">(venta neta {signo(e.total)})</span>
      </h2>
      <p className="text-xs text-neutral-500">Lo que más subió o bajó en lempiras; entre paréntesis, qué parte de la variación total explica.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {e.dimensiones.map((d) => (
          <div key={d.dimension} className="border border-neutral-200 bg-white p-3">
            <h3 className="mb-1 text-xs font-semibold text-neutral-500 uppercase">{d.titulo}</h3>
            {d.filas.length === 0 ? (
              <p className="text-xs text-neutral-500">Sin cambios.</p>
            ) : (
              <ul className="space-y-1 text-xs tabular-nums">
                {d.filas.map((f) => (
                  <li key={f.valor} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate" title={f.valor}>{f.valor}</span>
                    <span className={`shrink-0 ${f.variacion >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {signo(f.variacion)}{f.peso !== null && Math.abs(f.peso) < 1000 && <span className="ml-1 text-neutral-500">({Math.round(f.peso)} %)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
