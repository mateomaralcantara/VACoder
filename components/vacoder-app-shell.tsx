'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type NavItem = {
  label: string;
  href: string;
  icon: string;
  primary?: boolean;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: '⌂', primary: true },
  { label: 'Studio', href: '/studio', icon: '</>', primary: true },
  { label: 'Runtime', href: '/runtime', icon: '▶', primary: true },
  { label: 'Projects', href: '/dashboard/projects', icon: '▣' },
  { label: 'Jobs', href: '/dashboard/projects', icon: '☷' },
  { label: 'Agents', href: '/supreme', icon: '◇' },
  { label: 'Deploy', href: '/runtime', icon: '☁' },
  { label: 'Settings', href: '/dashboard', icon: '⚙' },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function VacoderAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="va-app-shell">
      <aside className="va-sidebar">
        <Link href="/" className="va-brand" aria-label="VACoder Dashboard">
          <span className="va-brand-mark">VA</span>
          <span>
            <strong>VACoder</strong>
            <small>Agent OS</small>
          </span>
        </Link>

        <nav className="va-sidebar-nav" aria-label="Navegación principal">
          {navItems.map((item, index) => {
            const active = isActivePath(pathname, item.href);
            const divider = index === 3;

            return (
              <div key={`${item.label}-${index}`}>
                {divider ? <div className="va-nav-divider" /> : null}
                <Link
                  href={item.href}
                  className={`va-nav-item ${active ? 'active' : ''} ${item.primary ? 'primary' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="va-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="va-plan-card">
          <div className="va-plan-title">
            <span>✦</span>
            <div>
              <strong>LIVE-4</strong>
              <small>Cloud Runtime</small>
            </div>
          </div>
          <div className="va-plan-progress"><span /></div>
          <div className="va-plan-meta">
            <span>E2B</span>
            <strong>certificado</strong>
          </div>
          <Link href="/runtime">Abrir Runtime <span>→</span></Link>
        </div>
      </aside>

      <div className="va-main-shell">
        <header className="va-topbar">
          <label className="va-search">
            <span>⌕</span>
            <input
              aria-label="Buscar en VACoder"
              placeholder="Buscar proyectos, agentes, jobs, archivos..."
            />
            <kbd>Ctrl + K</kbd>
          </label>

          <div className="va-top-actions">
            <span className="va-connection-pill">
              <i />
              project scanner conectado
            </span>
            <button className="va-icon-button" type="button" aria-label="Notificaciones">
              ♢
              <b>3</b>
            </button>
            <button className="va-profile" type="button">
              <span className="va-avatar">MM</span>
              <span className="va-profile-copy">
                <strong>Martín Mateo</strong>
                <small>Administrador</small>
              </span>
              <span>⌄</span>
            </button>
          </div>
        </header>

        <main className="va-content">{children}</main>
      </div>
    </div>
  );
}
