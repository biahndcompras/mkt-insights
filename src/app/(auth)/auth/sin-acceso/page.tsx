import { salir } from "../../acciones";
import { Titulo } from "../../titulo";
import { BotonEnviar } from "@/components/espera";
import { buttonVariants } from "@/components/ui/button";

export default function SinAcceso() {
  return (
    <>
      <Titulo detalle="Tu usuario no tiene un perfil activo. Pide acceso a quien administra BIA Foresight.">Sin acceso</Titulo>
      <form action={salir}>
        <BotonEnviar pendiente="Saliendo…" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}>Salir</BotonEnviar>
      </form>
    </>
  );
}
