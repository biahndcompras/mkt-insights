import Link from "next/link";
import { AvisoEnlace } from "@/components/espera";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requerirPlus } from "@/lib/auth/acceso";
import { advertencias, leerParams, periodoComparado, queryString, type EstadoDashboard } from "@/lib/dashboard/params";
import { capital, conteo, fechaCorta, fechaLocal, lempirasCompacto, periodoCorto, periodoLargo } from "@/lib/format";
import {
  consultasClientesSesion, ESTADOS_CLIENTE, leerEstadoCliente,
  type EstadoCliente, type ListaClientes, type ResumenClientes,
} from "@/lib/semantic/clientes";
import type { Periodo, VersionVigente } from "@/lib/semantic/contracts";
import { versionVigente } from "@/lib/semantic/queries";
import { FiltrosClientes } from "./filtros-clientes";

const POR_PAGINA = 50;
const ORDEN: EstadoCliente[] = ["activos", "nuevos", "recuperados", "continuan", "en_riesgo", "perdidos"];

/**
 * Clientes por estado (G9). Solo Plus: la página redirige a los demás y la base niega las funciones igual.
 * Es el único lugar con código y nombre de cliente; nada de aquí va al asistente (S15, S22).
 */
export default async function Clientes(props: PageProps<"/clientes">) {
  // La versión y el transporte de clientes salen junto con el acceso (antes, en serie); nada se usa si no pasa.
  const versionP = versionVigente();
  const consultasP = consultasClientesSesion();
  versionP.catch(() => {}); // si requerirPlus() redirige, que no queden como rechazos sin manejar
  consultasP.catch(() => {});
  await requerirPlus();
  const [version, sp] = await Promise.all([versionP, props.searchParams]);
  if (!version) return <SinVersion />;

  const meta = version.metadatos;
  const estado = leerParams(sp, meta.periodos);
  const { periodo, filtros } = estado;
  const cmp = periodoComparado(periodo, estado.comparar);
  const ver = leerEstadoCliente(sp.ver);
  const pagina = Math.max(1, Math.floor(Number(Array.isArray(sp.pagina) ? sp.pagina[0] : sp.pagina) || 1));

  const { clientesResumen, clientesLista } = await consultasP;
  const base = { version: version.version, periodo, comparar: cmp, filtros };
  const [resumen, lista] = await Promise.all([
    clientesResumen(base),
    clientesLista({ ...base, estado: ver, limite: POR_PAGINA, desplazamiento: (pagina - 1) * POR_PAGINA }),
  ]);

  const p = periodoLargo(periodo), c = periodoLargo(cmp);
  const umbral = `${Math.round(resumen.umbral_riesgo * 100)} %`;
  const qs = queryString(estado);
  const enlace = (e: EstadoCliente, pag = 1) => `/clientes?${qs}&ver=${e}${pag > 1 ? `&pagina=${pag}` : ""}`;
  const primerMes = meta.periodos[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Clientes</h1>
        <p className="text-sm text-neutral-500">{capital(p)} vs. {c} · quién compra, quién llegó, quién volvió y quién dejó de comprar · solo perfil Plus</p>
      </div>

      <FiltrosClientes estado={estado} ver={ver} periodos={meta.periodos} opciones={meta} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {ORDEN.map((e) => (
          <Tarjeta key={e} estado={e} resumen={resumen} activo={e === ver} href={enlace(e)} contra={periodoCorto(cmp)}
            explicacion={ESTADOS_CLIENTE[e].explicacion(p, c, umbral)} />
        ))}
      </div>

      <details className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium">¿Qué significa cada estado?</summary>
        <dl className="mt-3 space-y-2 text-neutral-700">
          {ORDEN.map((e) => (
            <div key={e}><dt className="inline font-medium">{ESTADOS_CLIENTE[e].titulo}: </dt><dd className="inline">{ESTADOS_CLIENTE[e].explicacion(p, c, umbral)}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-neutral-500">
            &quot;Compró&quot; quiere decir venta neta del mes mayor que cero, con los filtros elegidos (S4): con un filtro de canal, ruta, marca o
            producto, un cliente nuevo es nuevo en ese canal, ruta, marca o producto. La historia empieza en {primerMes ? periodoLargo(primerMes) : "el primer mes de la versión"}:
            &quot;nuevo&quot; es sin compras desde entonces. Con la comparación contra el año anterior, &quot;recuperados&quot; incluye a quien compró en los meses de en medio pero no en {c} (S22).
        </p>
      </details>

      <Seccion titulo={`${ESTADOS_CLIENTE[ver].titulo}: ${conteo(lista.total)} clientes`} detalle={ESTADOS_CLIENTE[ver].explicacion(p, c, umbral)}
        accion={<a href={`/api/clientes?${qs}&ver=${ver}`} className="shrink-0 text-xs text-neutral-600 underline">Exportar CSV</a>}>
        <ListaTabla lista={lista} periodo={periodo} cmp={cmp} />
        <Paginas total={lista.total} pagina={pagina} href={(n) => enlace(ver, n)} />
      </Seccion>

      <Seccion titulo="Clientes por ruta" detalle="Cada cliente cuenta en su ruta principal: donde más compró en el periodo (los perdidos, donde más compraban en el comparado). La suma da el total.">
        <PorRuta filas={resumen.por_ruta} estado={estado} ver={ver} periodo={periodo} cmp={cmp} />
      </Seccion>

      <Pie version={version} avisos={advertencias(periodo, cmp, meta.periodos)} />
    </div>
  );
}

function Tarjeta({ estado, resumen, activo, href, contra, explicacion }: {
  estado: EstadoCliente; resumen: ResumenClientes; activo: boolean; href: string; contra: string; explicacion: string;
}) {
  const t = resumen.estados[estado];
  const detalle =
    estado === "perdidos" ? `compraban ${lempirasCompacto(t.venta_cmp)} en ${contra}`
    : estado === "activos" ? `${lempirasCompacto(t.venta)} · eran ${conteo(resumen.estados.continuan.clientes + resumen.estados.perdidos.clientes)} en ${contra}`
    : estado === "continuan" || estado === "en_riesgo" ? `${lempirasCompacto(t.venta)} vs. ${lempirasCompacto(t.venta_cmp)}`
    : lempirasCompacto(t.venta);
  return (
    <Link href={href} scroll={false} title={explicacion} aria-current={activo ? "true" : undefined}
      className={`rounded-lg border bg-white p-3 transition-colors hover:border-neutral-400 ${activo ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200"}`}>
      <div className={`text-sm ${estado === "perdidos" || estado === "en_riesgo" ? "text-red-700" : "text-neutral-500"}`}>{ESTADOS_CLIENTE[estado].titulo}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{conteo(t.clientes)}</div>
      <div className="mt-1 text-xs text-neutral-500 tabular-nums">{detalle}</div>
      <AvisoEnlace />
    </Link>
  );
}

function ListaTabla({ lista, periodo, cmp }: { lista: ListaClientes; periodo: Periodo; cmp: Periodo }) {
  return (
    <Table className="tabular-nums">
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead><TableHead>Cliente</TableHead><TableHead>Ruta principal</TableHead>
          <TableHead className="text-right">{capital(periodoCorto(periodo))}</TableHead>
          <TableHead className="text-right">{capital(periodoCorto(cmp))}</TableHead>
          <TableHead className="text-right">Variación</TableHead>
          <TableHead className="text-right">Última compra</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lista.filas.length === 0 && (
          <TableRow><TableCell colSpan={7} className="py-6 text-center text-neutral-400">Ningún cliente en este estado con estos filtros.</TableCell></TableRow>
        )}
        {lista.filas.map((f) => (
          <TableRow key={`${f.empresa}|${f.cliente_codigo}`}>
            <TableCell className="whitespace-nowrap">{f.cliente_codigo} <span className="text-xs text-neutral-400">{f.empresa}</span></TableCell>
            <TableCell className="max-w-72 truncate" title={f.cliente_nombre ?? undefined}>{f.cliente_nombre ?? "—"}</TableCell>
            <TableCell className="max-w-56 truncate" title={f.ruta}>{f.ruta}</TableCell>
            <TableCell className="text-right">{lempirasCompacto(f.venta)}</TableCell>
            <TableCell className="text-right">{lempirasCompacto(f.venta_cmp)}</TableCell>
            <TableCell className={`text-right ${f.variacion < 0 ? "text-red-700" : "text-emerald-700"}`}>{lempirasCompacto(f.variacion)}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{f.ultima_compra ? fechaCorta(f.ultima_compra) : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Paginas({ total, pagina, href }: { total: number; pagina: number; href: (n: number) => string }) {
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  if (total <= POR_PAGINA) return null;
  const desde = (pagina - 1) * POR_PAGINA + 1, hasta = Math.min(total, pagina * POR_PAGINA);
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-neutral-600 tabular-nums">
      <span>{desde <= total ? `Clientes ${conteo(desde)}–${conteo(hasta)} de ${conteo(total)}` : `Página fuera de rango (hay ${paginas})`}</span>
      <div className="flex gap-4">
        {pagina > 1 && <Link href={href(Math.min(pagina - 1, paginas))} scroll={false} className="underline">Anteriores<AvisoEnlace /></Link>}
        {pagina < paginas && <Link href={href(pagina + 1)} scroll={false} className="underline">Siguientes<AvisoEnlace /></Link>}
      </div>
    </div>
  );
}

function PorRuta({ filas, estado, ver, periodo, cmp }: { filas: ResumenClientes["por_ruta"]; estado: EstadoDashboard; ver: EstadoCliente; periodo: Periodo; cmp: Periodo }) {
  const filtrar = (ruta: string) => `/clientes?${queryString({ ...estado, filtros: { ...estado.filtros, ruta } })}&ver=${ver}`;
  return (
    <div className="max-h-[32rem] overflow-auto">
      <Table className="tabular-nums">
        <TableHeader>
          <TableRow>
            <TableHead>Ruta</TableHead>
            <TableHead className="text-right">Activos</TableHead><TableHead className="text-right">Nuevos</TableHead>
            <TableHead className="text-right">Recuperados</TableHead><TableHead className="text-right">En riesgo</TableHead>
            <TableHead className="text-right">Perdidos</TableHead>
            <TableHead className="text-right">Venta activos {periodoCorto(periodo)}</TableHead>
            <TableHead className="text-right">Compraban los perdidos {periodoCorto(cmp)}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 && (
            <TableRow><TableCell colSpan={8} className="py-6 text-center text-neutral-400">Sin clientes con compra en ninguno de los dos periodos con estos filtros.</TableCell></TableRow>
          )}
          {filas.map((r) => (
            <TableRow key={r.ruta}>
              <TableCell className="max-w-72 truncate" title={r.ruta}>
                {estado.filtros.ruta ? r.ruta : <Link href={filtrar(r.ruta)} className="hover:underline">{r.ruta}<AvisoEnlace /></Link>}
              </TableCell>
              <TableCell className="text-right">{conteo(r.activos)}</TableCell>
              <TableCell className="text-right">{conteo(r.nuevos)}</TableCell>
              <TableCell className="text-right">{conteo(r.recuperados)}</TableCell>
              <TableCell className={`text-right ${r.en_riesgo ? "text-red-700" : ""}`}>{conteo(r.en_riesgo)}</TableCell>
              <TableCell className={`text-right ${r.perdidos ? "text-red-700" : ""}`}>{conteo(r.perdidos)}</TableCell>
              <TableCell className="text-right">{lempirasCompacto(r.venta_activos)}</TableCell>
              <TableCell className="text-right">{lempirasCompacto(r.venta_perdidos_cmp)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Seccion({ titulo, detalle, accion, children }: { titulo: string; detalle?: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium tabular-nums">{titulo}</h2>
          {detalle && <p className="text-xs text-neutral-500">{detalle}</p>}
        </div>
        {accion}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Pie({ version, avisos }: { version: VersionVigente; avisos: string[] }) {
  return (
    <footer className="space-y-1 text-xs text-neutral-500">
      <p className="tabular-nums">Fuente: cubo de ventas BIA · {version.archivo} · versión v{version.version} publicada {fechaLocal(version.publicado_en)}</p>
      <p>Detalle por cliente solo para perfiles Plus. Estos datos no se envían al asistente de IA.</p>
      {!version.conciliada_bi && <p className="text-amber-700">Cifras verificadas contra el Excel exportado, todavía no conciliadas con el reporte de BI.</p>}
      {avisos.map((a, i) => <p key={`${i}-${a}`} className="text-amber-700">{a}</p>)}
    </footer>
  );
}

function SinVersion() {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
      Todavía no hay una versión publicada.
    </div>
  );
}
