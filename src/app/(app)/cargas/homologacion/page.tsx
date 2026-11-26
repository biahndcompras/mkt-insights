import Link from "next/link";
import { AvisoEnlace } from "@/components/espera";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requerirGestorCargas } from "@/lib/auth/acceso";
import { bitacoraHomologacion, canalesBia, canalesPendientes, homologacionesCanal } from "@/lib/cargas/homologacion";
import type { CambioHomologacion } from "@/lib/cargas/tipos";
import { conteo, fechaLocal, lempirasCompacto, periodoCorto } from "@/lib/format";
import { FormHomologacion, QuitarHomologacion } from "./formularios";

const origenTxt = (o: string) => (o === "" ? "(vacío)" : o);
const enlace = (o: string) => `/cargas/homologacion?origen=${encodeURIComponent(o)}#equivalencia`;

/** Homologación de canales (S2, S19): solo quien gestiona cargas (admin o aprobador). */
export default async function Homologacion(props: PageProps<"/cargas/homologacion">) {
  await requerirGestorCargas(); // el layout no se vuelve a ejecutar en cada navegación
  const sp = await props.searchParams;
  const pedido = typeof sp.origen === "string" ? sp.origen.trim().slice(0, 100) : null;
  const [equivalencias, pendientes, cambios] = await Promise.all([homologacionesCanal(), canalesPendientes(), bitacoraHomologacion()]);
  const canales = canalesBia(equivalencias);
  const existente = pedido !== null ? equivalencias.find((h) => h.valor_origen === pedido) : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/cargas" className="text-xs text-neutral-500 underline">← Cargas y versiones</Link>
        <h1 className="text-xl font-semibold">Homologación de canales</h1>
        <p className="text-sm text-neutral-500">
          El cubo escribe el mismo canal de varias formas («DETALLE», «detalle», «B2C»). Aquí se define con qué canal BIA se
          muestra cada canal de origen en el dashboard, el asistente y las alertas.
        </p>
      </div>

      <section className="space-y-1 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <h2 className="font-semibold">Qué cambia al guardar</h2>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>Las cargas <strong>listas para publicar</strong> se actualizan al momento y sus alertas se recalculan.</li>
          <li>Las próximas cargas usan la equivalencia al subirse.</li>
          <li>
            Los <strong>meses ya publicados no cambian</strong>: siguen con el canal con que se publicaron. Para corregirlos, vuelve
            a subir el Excel de esos meses y publícalo; queda como una versión nueva.
          </li>
          <li>Si BIA todavía no decidió a qué canal va uno, no lo homologues: se muestra con su nombre de origen y la alerta lo recuerda.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Canales sin homologar en las cargas</h2>
        {pendientes.length === 0 ? (
          <p className="text-sm text-neutral-500">Ninguno: todos los canales de las cargas sin publicar y de la versión vigente tienen equivalencia.</p>
        ) : (
          <div className="border border-neutral-200 bg-white">
            <Table className="tabular-nums">
              <TableHeader>
                <TableRow>
                  <TableHead>Canal de origen</TableHead>
                  <TableHead>Dónde</TableHead>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Filas</TableHead>
                  <TableHead className="text-right">Venta neta</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendientes.map((p) => (
                  <TableRow key={`${p.carga_id}-${p.anio}-${p.mes}-${p.canal_origen}`}>
                    <TableCell className="font-mono text-xs">{origenTxt(p.canal_origen)}</TableCell>
                    <TableCell className="text-xs whitespace-normal">
                      {p.archivo}
                      <div className="text-neutral-500">{p.en_vigente ? "publicada (versión vigente)" : "lista para publicar"}</div>
                    </TableCell>
                    <TableCell className="text-xs">{periodoCorto(p)}</TableCell>
                    <TableCell className="text-right text-xs">{conteo(p.filas)}</TableCell>
                    <TableCell className="text-right text-xs">{lempirasCompacto(p.venta_neta)}</TableCell>
                    <TableCell className="max-w-80 text-xs whitespace-normal">
                      {p.homologado_a ? (
                        <span className="text-neutral-600">
                          Ya se homologa a {p.homologado_a}. Este mes publicado cambia solo al volver a subirlo y publicarlo.
                        </span>
                      ) : (
                        <Link href={enlace(p.canal_origen)} className="underline">Homologar<AvisoEnlace /></Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section id="equivalencia" className="space-y-3 border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{existente ? `Cambiar «${origenTxt(existente.valor_origen)}»` : "Agregar una equivalencia"}</h2>
          {pedido !== null && <Link href="/cargas/homologacion#equivalencia" className="text-xs text-neutral-500 underline">Empezar una nueva</Link>}
        </div>
        <FormHomologacion key={pedido ?? ""} origen={pedido ?? ""} actual={existente?.valor_homologado ?? null} editando={!!existente} canales={canales} origenFijo={pedido === ""} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Equivalencias vigentes ({equivalencias.length})</h2>
        <div className="border border-neutral-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal de origen</TableHead>
                <TableHead>Canal BIA</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equivalencias.map((h) => (
                <TableRow key={h.valor_origen}>
                  <TableCell className="font-mono text-xs">{origenTxt(h.valor_origen)}</TableCell>
                  <TableCell className="text-sm">
                    {h.valor_homologado}
                    {h.revisar && <Badge variant="outline" className="ml-2">por confirmar con BIA</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <Link href={enlace(h.valor_origen)} className="inline-flex h-6 items-center border border-neutral-200 px-2 text-xs hover:bg-neutral-50">Cambiar<AvisoEnlace /></Link>
                      <QuitarHomologacion origen={h.valor_origen} canal={h.valor_homologado} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Historial de cambios</h2>
        {cambios.length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía no hay cambios hechos desde la app.</p>
        ) : (
          <div className="border border-neutral-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Quién</TableHead>
                  <TableHead>Cambio</TableHead>
                  <TableHead>Cargas sin publicar actualizadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cambios.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{fechaLocal(c.creado_en)}</TableCell>
                    <TableCell className="text-xs">{c.usuario ?? "—"}</TableCell>
                    <TableCell className="text-xs whitespace-normal">{descripcion(c)}</TableCell>
                    <TableCell className="text-xs whitespace-normal">
                      {c.cargas_actualizadas.length
                        ? c.cargas_actualizadas.map((x) => `${x.archivo} (${conteo(x.filas)} filas)`).join(", ")
                        : "ninguna"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function descripcion(c: CambioHomologacion) {
  const o = `«${origenTxt(c.valor_origen)}»`;
  if (c.accion === "creada") return `${o} → ${c.despues?.valor_homologado} (nueva)`;
  if (c.accion === "eliminada") return `${o} ya no se homologa (era ${c.antes?.valor_homologado})`;
  return c.antes?.valor_homologado === c.despues?.valor_homologado
    ? `${o} → ${c.despues?.valor_homologado} (confirmada)`
    : `${o}: ${c.antes?.valor_homologado} → ${c.despues?.valor_homologado}`;
}
