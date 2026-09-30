import { redirect } from "next/navigation";
import { signIn } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="brand-mark">b</div>
        <p className="eyebrow">TU DINERO, MÁS CLARO</p>
        <h1>Finanzas en<br /><span>equilibrio.</span></h1>
        <p className="login-copy">Un espacio privado para entender cómo se mueve tu dinero.</p>
        <form action={signIn} className="login-form">
          <label>Correo electrónico<input name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required /></label>
          <label>Contraseña<input name="password" type="password" autoComplete="current-password" placeholder="Tu contraseña" required /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-primary" type="submit">Entrar a mi espacio <span>↗</span></button>
        </form>
        <p className="login-note">Acceso privado · Solo tú puedes ver tus movimientos</p>
      </section>
      <aside className="login-art" aria-hidden="true">
        <div className="art-glow" />
        <p className="art-kicker">MENOS RUIDO,<br />MÁS TRANQUILIDAD.</p>
        <div className="art-circle"><span>+</span><div className="orbit orbit-one"/><div className="orbit orbit-two"/></div>
        <p className="art-caption">Tus decisiones<br />también cuentan.</p>
        <span className="art-index">01 — 03</span>
      </aside>
    </main>
  );
}
