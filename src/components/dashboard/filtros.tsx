"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryString, type EstadoDashboard } from "@/lib/dashboard/params";
import { capital, periodoCorto } from "@/lib/format";
import type { Filtros as FiltrosT, PeriodoMeta } from "@/lib/semantic/contracts";
import { useAvisarEspera } from "@/components/espera";
import { Vistas } from "./vistas";

type Opcion = { value: string; label: string };
const TODOS = "__todos";

export function Filtros({ estado, periodos, opciones }: {
  estado: EstadoDashboard;
  periodos: PeriodoMeta[];
  opciones: { canal: string[]; ruta: string[]; marca: string[]; producto: { codigo: string; descripcion: string }[] };
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  useAvisarEspera(pendiente);
  const ir = (e: EstadoDashboard) => startTransition(() => router.push(`/?${queryString(e)}`, { scroll: false }));
  const filtro = (campo: keyof FiltrosT, v: string | null) => {
    const filtros = { ...estado.filtros };
    if (v && v !== TODOS) filtros[campo] = v; else delete filtros[campo];
    ir({ ...estado, filtros });
  };

  const periodoItems: Opcion[] = periodos.toReversed().map((p) => ({
    value: `${p.anio}-${p.mes}`,
    label: `${capital(periodoCorto(p))}${p.cerrado ? "" : " (parcial)"}`,
  }));
  const conTodos = (label: string, xs: Opcion[]): Opcion[] => [{ value: TODOS, label }, ...xs];
  const simple = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Vistas estado={estado} periodos={periodos} navegar={(q) => startTransition(() => router.push(`/?${q}`, { scroll: false }))} />
      </div>
      <div className={`grid grid-cols-2 gap-3 text-sm md:grid-cols-3 xl:grid-cols-6 ${pendiente ? "opacity-60" : ""}`} aria-busy={pendiente}>
        <Campo etiqueta="Periodo">
          <Elegir etiqueta="Periodo" items={periodoItems} value={`${estado.periodo.anio}-${estado.periodo.mes}`}
            onChange={(v) => { const [anio, mes] = v.split("-").map(Number); ir({ ...estado, periodo: { anio, mes } }); }} />
        </Campo>
        <Campo etiqueta="Comparar con">
          <Elegir etiqueta="Comparar con" items={[{ value: "anterior", label: "Periodo anterior" }, { value: "anio", label: "Año anterior" }]} value={estado.comparar}
            onChange={(v) => ir({ ...estado, comparar: v === "anio" ? "anio" : "anterior" })} />
        </Campo>
        <Campo etiqueta="Canal">
          <Elegir etiqueta="Canal" items={conTodos("Todos", simple(opciones.canal))} value={estado.filtros.canal ?? TODOS} onChange={(v) => filtro("canal", v)} />
        </Campo>
        <Campo etiqueta="Territorio / ruta">
          <Buscar etiqueta="Territorio / ruta" opciones={simple(opciones.ruta)} value={estado.filtros.ruta} vacio="Todos" onChange={(v) => filtro("ruta", v)} />
        </Campo>
        <Campo etiqueta="Marca">
          <Buscar etiqueta="Marca" opciones={simple(opciones.marca)} value={estado.filtros.marca} vacio="Todas" onChange={(v) => filtro("marca", v)} />
        </Campo>
        <Campo etiqueta="Producto">
          <Buscar etiqueta="Producto" opciones={opciones.producto.map((p) => ({ value: p.codigo, label: `${p.descripcion} · ${p.codigo}` }))}
            value={estado.filtros.art_codigo} vacio="Todos" onChange={(v) => filtro("art_codigo", v)} />
        </Campo>
      </div>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-xs text-neutral-500">{etiqueta}</div>
      {children}
    </div>
  );
}

/** Lista corta: Select. */
function Elegir({ etiqueta, items, value, onChange }: { etiqueta: string; items: Opcion[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v !== null && v !== value && onChange(v as string)}>
      <SelectTrigger aria-label={etiqueta} className="w-full bg-white"><SelectValue /></SelectTrigger>
      <SelectContent>
        {items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** Lista larga: Combobox con búsqueda; borrar la selección quita el filtro. */
function Buscar({ etiqueta, opciones, value, vacio, onChange }: { etiqueta: string; opciones: Opcion[]; value?: string; vacio: string; onChange: (v: string | null) => void }) {
  const actual = opciones.find((o) => o.value === value) ?? null;
  return (
    <Combobox items={opciones} value={actual} limit={100} autoHighlight
      itemToStringLabel={(o: Opcion) => o.label} isItemEqualToValue={(a: Opcion, b: Opcion) => a.value === b.value}
      onValueChange={(o: Opcion | null) => { if ((o?.value ?? null) !== (value ?? null)) onChange(o?.value ?? null); }}>
      <ComboboxInput aria-label={etiqueta} placeholder={vacio} showClear={!!actual} className="w-full bg-white" />
      <ComboboxContent>
        <ComboboxEmpty>Sin resultados</ComboboxEmpty>
        <ComboboxList>
          {(o: Opcion) => <ComboboxItem key={o.value} value={o}>{o.label}</ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
