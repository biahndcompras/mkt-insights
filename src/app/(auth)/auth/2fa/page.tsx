import { redirect } from "next/navigation";
import { rutaSegura } from "@/lib/auth/reglas";
import { createClient } from "@/lib/supabase/server";
import { BotonEnviar } from "@/components/espera";
import { salir } from "../../acciones";
import { Configurar2fa, Verificar2fa } from "../../formularios";
import { Titulo } from "../../titulo";

/** 2FA obligatorio: sin factor se configura, con factor se pide el código. */
export default async function DosPasos(props: PageProps<"/auth/2fa">) {
  const siguiente = rutaSegura((await props.searchParams).siguiente, "");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  if (data.claims.aal === "aal2") redirect(siguiente || "/");
  const { data: factores } = await supabase.auth.mfa.listFactors();
  const configurado = !!factores?.totp.length;
  return (
    <>
      <Titulo detalle={configurado ? "Escribe el código que muestra tu app de autenticación." : "Es obligatoria para entrar. Se configura una sola vez."}>
        Verificación en dos pasos
      </Titulo>
      {configurado ? <Verificar2fa siguiente={siguiente} /> : <Configurar2fa siguiente={siguiente} />}
      <form action={salir} className="mt-4 text-center">
        <BotonEnviar pendiente="Saliendo…" className="text-xs text-neutral-600 underline-offset-4 hover:underline">Salir</BotonEnviar>
      </form>
    </>
  );
}
