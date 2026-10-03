import { redirect } from "next/navigation";
import { signIn } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

function CardPortrait() {
  return (
    <svg className="art-portrait" viewBox="0 0 480 500" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="portrait-ink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#002845" />
          <stop offset="1" stopColor="#015473" />
        </linearGradient>
        <linearGradient id="portrait-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D0FF78" />
          <stop offset="1" stopColor="#24C7D6" />
        </linearGradient>
      </defs>

      <g fill="url(#portrait-ink)" stroke="url(#portrait-line)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M116 277c-17-22-45-13-46 21-1 37 22 64 54 66m240-87c17-22 45-13 46 21 1 37-22 64-54 66" />
        <path d="M123 216c21-39 59-53 113-53 63 0 105 18 128 61v113c0 76-47 130-124 130S116 413 116 337V225z" />
        <path d="M104 225c-39-13-48-47-28-78l-25 7c10-37 37-63 75-67l-17-14c28-4 51-17 68-43l-2 31c31-25 58-35 97-34l-22 25c37-11 77-5 101 17l-1-26c33 18 51 44 51 76l22-15c16 35 4 68-29 87l14 14c-24 9-45 4-61-9-14-12-28-22-43-28l-10 27c-18-18-36-26-52-26l-16 28c-19-15-37-22-55-21l-12 23c-17-12-35-12-55-3z" />
      </g>

      <g fill="none" stroke="#24C7D6" strokeWidth="4" strokeLinecap="round" opacity=".78">
        <path d="M98 159c22-24 48-29 71-28m35-52c24-17 47-23 69-22m84 55c17 10 28 25 32 42" />
        <path d="M86 292c-6 18-2 34 10 44m288-44c6 18 2 34-10 44" />
      </g>

      <g fill="none" stroke="#D0FF78" strokeWidth="7" strokeLinecap="round">
        <path d="M158 263c17-20 39-24 59-13m46 0c21-12 43-7 59 13" />
        <path d="M151 294c15-17 37-21 57-13m64 0c20-8 42-4 57 13" strokeWidth="4" />
      </g>
      <g fill="#D0FF78" stroke="#002845" strokeWidth="4">
        <ellipse cx="188" cy="302" rx="20" ry="29" />
        <ellipse cx="292" cy="302" rx="20" ry="29" />
      </g>
      <g fill="#002845">
        <ellipse cx="192" cy="307" rx="9" ry="17" />
        <ellipse cx="288" cy="307" rx="9" ry="17" />
      </g>
      <g fill="#24C7D6">
        <circle cx="196" cy="298" r="4" />
        <circle cx="292" cy="298" r="4" />
      </g>

      <path d="M241 303c-4 16-11 29-18 43-6 13 1 23 17 23 17 0 24-10 18-23-7-14-14-27-17-43z" fill="#015473" stroke="#D0FF78" strokeWidth="5" strokeLinejoin="round" />
      <path d="M160 374c24-17 52-14 80-2 29-12 57-15 81 2-3 39-33 69-81 69s-78-30-80-69z" fill="#002845" stroke="#D0FF78" strokeWidth="5" strokeLinejoin="round" />
      <path d="M177 386c39 26 87 27 126 0-9 24-31 38-63 38s-54-14-63-38z" fill="#D0FF78" />
      <path d="M183 393c36 12 78 12 114 0" fill="none" stroke="#24C7D6" strokeWidth="4" strokeLinecap="round" />
      <g fill="none" stroke="#24C7D6" strokeWidth="3" strokeLinecap="round" opacity=".85">
        <path d="M147 355c8 4 15 5 22 4m142 0c7 1 14 0 22-4" />
        <path d="M144 413c11 15 24 26 41 34m151-34c-11 15-24 26-41 34" />
      </g>
    </svg>
  );
}

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
        <CardPortrait />
        <p className="art-caption">Tus decisiones<br />también cuentan.</p>
        <span className="art-index">01 — 03</span>
      </aside>
    </main>
  );
}
