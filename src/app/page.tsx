import { redirect } from "next/navigation";
import Image from "next/image";
import { signIn } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect(next === "registrar" ? "/registrar" : "/dashboard");
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark" aria-hidden="true"/><span>Wallet Cleaner</span></div>
        <p className="eyebrow">TU DINERO, MÁS CLARO</p>
        <h1>Tu dinero,<br /><span>en perspectiva.</span></h1>
        <p className="login-copy">Un espacio privado para entender cómo se mueve tu dinero.</p>
        <form action={signIn} className="login-form">
          {next === "registrar" && <input type="hidden" name="next" value="registrar" />}
          <label>Correo electrónico<input name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required /></label>
          <label>Contraseña<input name="password" type="password" autoComplete="current-password" placeholder="Tu contraseña" required /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-primary" type="submit">Entrar a mi espacio <span>↗</span></button>
        </form>
        <p className="login-note">Acceso privado · Solo tú puedes ver tus movimientos</p>
        <nav className="login-legal-links" aria-label="Información legal"><a href="/privacidad">Privacidad</a><a href="/condiciones">Condiciones</a><a href="/eliminar-datos">Eliminar datos</a></nav>
      </section>
      <aside className="login-art" aria-hidden="true">
        <div className="art-glow" />
        <p className="art-kicker">LLEVA UN ORDEN<br />EN TUS FINANZAS.</p>
        <Image className="art-portrait" src="/wallet-cleaner-portrait.png" width={1254} height={1254} alt="" priority />
        <p className="art-caption">Tus decisiones<br />también cuentan.</p>
        <span className="art-index">01 — 03</span>
      </aside>
    </main>
  );
}
