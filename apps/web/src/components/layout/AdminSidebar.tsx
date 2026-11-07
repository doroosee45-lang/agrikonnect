import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { useAuthStore } from '@/store/auth';

type AdminNavItem = {
  label: string;
  to: string;
  icon: 'grid' | 'users' | 'roles' | 'audit' | 'operations' | 'bell' | 'settings' | 'jobs' | 'pulse' | 'shield';
  permissions: string[];
};

type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

const NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Pilotage',
    items: [
      { label: 'Vue generale', to: '/admin/dashboard', icon: 'grid', permissions: ['admin.dashboard'] },
    ],
  },
  {
    label: 'Gouvernance',
    items: [
      { label: 'Utilisateurs', to: '/admin/users', icon: 'users', permissions: ['admin.users'] },
      { label: 'Matrice des roles', to: '/admin/roles', icon: 'roles', permissions: ['admin.users', 'admin.roles'] },
      { label: 'Journal d audit', to: '/admin/audit', icon: 'audit', permissions: ['admin.audit'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Operations', to: '/admin/operations', icon: 'operations', permissions: ['admin.users'] },
      { label: 'Notifications', to: '/admin/notifications', icon: 'bell', permissions: ['admin.users'] },
    ],
  },
  {
    label: 'Systeme',
    items: [
      { label: 'Parametres', to: '/admin/settings', icon: 'settings', permissions: ['admin.settings'] },
      { label: 'Taches planifiees', to: '/admin/jobs', icon: 'jobs', permissions: ['admin.jobs'] },
      { label: 'Surveillance', to: '/admin/monitoring', icon: 'pulse', permissions: ['admin.jobs'] },
      { label: 'Securite', to: '/admin/security', icon: 'shield', permissions: ['admin.audit', 'admin.security'] },
    ],
  },
];

function MenuIcon({ name }: { name: AdminNavItem['icon'] }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const shapes = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.2 2.5-5 6-5s6 1.8 6 5" /><path d="M16 5.3a3 3 0 0 1 0 5.4M17 15c2.5.4 4 2 4 5" /></>,
    roles: <><circle cx="8" cy="8" r="3" /><path d="M3 20c0-3.1 2-5 5-5 2 0 3.8 1 4.6 2.6" /><path d="M14 14h7M18 14v3M21 14v2" /></>,
    audit: <><path d="M8 5h13M8 12h13M8 19h13" /><circle cx="4" cy="5" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="19" r="1" /></>,
    operations: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="7" cy="18" r="2" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.4v-2.6h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.1H15v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1V14h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    jobs: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    pulse: <><path d="M3 12h4l2.5-6 4 12 2.5-6H21" /></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6l8-3z" /><path d="m9 12 2 2 4-4" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" {...common}>{shapes[name]}</svg>;
}

export function AdminSidebar() {
  const can = useAuthStore((state) => state.can);
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const groups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.permissions.every((permission) => can(permission))),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="admin-sidebar" aria-label="Navigation administration">
      <div className="admin-sidebar__heading">
        <div>
          <p className="admin-sidebar__eyebrow">AGRIKONNECT AFRICA</p>
          <h2 className="admin-sidebar__title">Espace d administration</h2>
        </div>
        <button
          className="admin-sidebar__toggle"
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="admin-sidebar-navigation"
          onClick={() => setMobileOpen((value) => !value)}
        >
          {mobileOpen ? 'Fermer' : 'Menu'}
        </button>
      </div>

      <nav
        id="admin-sidebar-navigation"
        className={`admin-sidebar__navigation${mobileOpen ? ' admin-sidebar__navigation--open' : ''}`}
        aria-label="Sections administratives"
      >
        {groups.length === 0 ? (
          <p className="admin-sidebar__empty">Aucun raccourci disponible pour les permissions actuelles.</p>
        ) : groups.map((group) => (
          <section className="admin-sidebar__group" key={group.label} aria-label={group.label}>
            <h3 className="admin-sidebar__group-title">{group.label}</h3>
            <ul className="admin-sidebar__list">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/admin/dashboard'}
                    className={({ isActive }) => `admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`}
                  >
                    <span className="admin-sidebar__icon"><MenuIcon name={item.icon} /></span>
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <p className="admin-sidebar__note">
        Les raccourcis suivent les permissions deja fournies par la session. Le serveur reste seul responsable de l autorisation.
      </p>
    </aside>
  );
}
