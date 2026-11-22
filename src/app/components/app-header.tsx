import { signOut } from "@/app/actions";
import { Icon, type IconName } from "@/app/components/icons";

const links: [string, string, IconName][] = [
  ["/registrar", "Hablar con Walleto", "chat"],
  ["/plan/pagos", "Próximos pagos", "calendar"],
  ["/plan/deudas", "Tus deudas", "debt"],
  ["/plan/apartados", "Apartados", "vault"],
  ["/plan/metas", "Metas de ahorro", "target"],
];

export function AppHeader({ email, current }: { email?: string; current?: string }) {
  return <header className="topbar">
    <a className="brand" href="/dashboard"><span className="brand-mark small" aria-hidden="true"/><span>WALLETO</span></a>
    <nav className="app-main-nav" aria-label="Navegación principal">
      <a className="panel-link" href="/dashboard" aria-current={current === "dashboard" ? "page" : undefined}><Icon name="grid" size={15} />Mi panel</a>
      <details className="nav-menu">
        <summary aria-label="Abrir menú de planificación" title="Abrir menú"><Icon name="menu" size={18} /></summary>
        <div className="nav-menu-list">
          {links.map(([href, label, icon]) => <a key={href} href={href} aria-current={current === href ? "page" : undefined}><Icon name={icon} size={17} />{label}<Icon name="arrow" size={13} /></a>)}
        </div>
      </details>
    </nav>
    <div className="topbar-right"><span className="avatar">{(email?.[0] ?? "T").toUpperCase()}</span><span className="user-email">{email}</span><form action={signOut}><button className="text-button" type="submit"><Icon name="logout" size={14} />Salir</button></form></div>
  </header>;
}
