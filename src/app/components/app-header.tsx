import { signOut } from "@/app/actions";

const links = [
  ["/plan/pagos", "Próximos pagos"],
  ["/plan/deudas", "Tus deudas"],
  ["/plan/apartados", "Apartados"],
  ["/plan/metas", "Metas de ahorro"],
];

export function AppHeader({ email }: { email?: string }) {
  return <header className="topbar">
    <a className="brand" href="/dashboard"><span className="brand-mark small" aria-hidden="true"/><span>Walleto</span></a>
    <nav className="app-main-nav" aria-label="Navegación principal">
      <a className="panel-link" href="/dashboard">Mi panel</a>
      <details className="nav-menu">
        <summary aria-label="Abrir menú de planificación" title="Abrir menú"><span/><span/><span/></summary>
        <div className="nav-menu-list">
          {links.map(([href, label]) => <a key={href} href={href}>{label}<span aria-hidden="true">↗</span></a>)}
        </div>
      </details>
    </nav>
    <div className="topbar-right"><span className="avatar">{(email?.[0] ?? "T").toUpperCase()}</span><span className="user-email">{email}</span><form action={signOut}><button className="text-button" type="submit">Salir</button></form></div>
  </header>;
}
