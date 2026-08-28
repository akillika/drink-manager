import { Link, useLocation } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  IconChart, IconPlus, IconList, IconClock, IconBook, IconTarget,
  IconLogout, IconMenu, IconClose, IconMoon, IconSun, cx,
} from './ui';

interface LayoutProps { children: ReactNode }

const NAV = [
  { to: '/',         label: 'Dashboard', Icon: IconChart },
  { to: '/history',  label: 'History',   Icon: IconList },
  { to: '/sessions', label: 'Sessions',  Icon: IconClock },
  { to: '/library',  label: 'Library',   Icon: IconBook },
  { to: '/goals',    label: 'Goals',     Icon: IconTarget },
] as const;

const LS_THEME = 'dm.theme';

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const s = localStorage.getItem(LS_THEME);
    if (s === 'light' || s === 'dark') return s;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const initials = (user?.displayName || user?.email || 'A').split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-paper">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 bg-paper2 border-b border-rule flex items-center h-14 px-4">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-ink text-paper text-xs font-semibold">DM</span>
          <span className="text-sm font-medium text-ink">Drink Manager</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md text-ink2 hover:text-ink hover:bg-paper3 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md text-ink2 hover:text-ink hover:bg-paper3 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {/* Mobile menu drop */}
      {menuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 bottom-0 z-30 bg-paper2 flex flex-col">
          <div className="p-3 grid gap-1 flex-1 overflow-y-auto">
            {NAV.map(({ to, label, Icon }) => {
              const active = isActive(to);
              return (
                <Link key={to} to={to}
                  className={cx(
                    'inline-flex items-center gap-3 h-11 px-3 rounded-md text-sm transition-colors',
                    active ? 'bg-ink text-paper' : 'text-ink hover:bg-paper3',
                  )}
                >
                  <Icon width={16} height={16} />
                  <span>{label}</span>
                </Link>
              );
            })}
            <Link to="/add"
              className="mt-2 inline-flex items-center gap-3 h-11 px-3 rounded-md text-sm bg-ink text-paper hover:bg-ink2 transition-colors"
            >
              <IconPlus />
              <span>Log entry</span>
            </Link>
          </div>
          {user && (
            <div className="border-t border-rule p-3 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-paper3 text-ink text-xs font-semibold">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-ink truncate">{user.displayName || user.email}</div>
                <div className="text-xs text-ink3 truncate">{user.email}</div>
              </div>
              <button
                onClick={() => signOut()}
                className="inline-flex items-center justify-center w-9 h-9 rounded-md text-ink3 hover:text-ink hover:bg-paper3 transition-colors"
                aria-label="Sign out"
              >
                <IconLogout />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Desktop shell */}
      <div className="hidden md:grid md:grid-cols-[248px_1fr] min-h-screen">
        <aside className="border-r border-rule bg-paper2 flex flex-col sticky top-0 h-screen">
          <div className="px-5 pt-5 pb-6">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-ink text-paper text-sm font-semibold">DM</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink leading-tight">Drink Manager</div>
                <div className="text-2xs text-ink3 font-mono uppercase tracking-[0.1em]">Vol. I</div>
              </div>
            </Link>
          </div>

          <Link
            to="/add"
            className={cx(
              'mx-4 mb-5 inline-flex items-center justify-between h-9 px-3 rounded-md transition-colors',
              isActive('/add') ? 'bg-ink text-paper' : 'bg-ink text-paper hover:bg-ink2',
            )}
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <IconPlus />
              Log entry
            </span>
            <kbd className="text-2xs font-mono uppercase tracking-[0.1em] opacity-70">N</kbd>
          </Link>

          <div className="px-3 flex-1 overflow-y-auto">
            <div className="text-2xs font-mono uppercase tracking-[0.14em] text-ink3 px-3 mb-2">
              Ledger
            </div>
            <nav className="grid gap-0.5">
              {NAV.map(({ to, label, Icon }) => {
                const active = isActive(to);
                return (
                  <Link key={to} to={to}
                    className={cx(
                      'group inline-flex items-center gap-3 h-9 px-3 rounded-md text-sm transition-colors relative',
                      active ? 'bg-paper3 text-ink' : 'text-ink2 hover:text-ink hover:bg-paper3',
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-ink" />
                    )}
                    <Icon width={15} height={15} className={active ? 'text-ink' : 'text-ink3 group-hover:text-ink2'} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {user && (
            <div className="border-t border-rule p-3 space-y-1">
              <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-paper3 transition-colors group cursor-default">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-paper3 text-ink text-xs font-semibold shrink-0">
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-ink font-medium truncate leading-tight">{user.displayName || user.email}</div>
                  <div className="text-2xs text-ink3 truncate leading-tight">{user.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                  className="flex-1 inline-flex items-center gap-2 h-8 px-2.5 rounded-md text-xs text-ink3 hover:text-ink hover:bg-paper3 transition-colors"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <IconSun /> : <IconMoon />}
                  <span>Theme</span>
                </button>
                <button
                  onClick={() => signOut()}
                  className="flex-1 inline-flex items-center gap-2 h-8 px-2.5 rounded-md text-xs text-ink3 hover:text-ink hover:bg-paper3 transition-colors"
                  aria-label="Sign out"
                >
                  <IconLogout />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </aside>

        <main className="min-w-0">
          {children}
        </main>
      </div>

      {/* Mobile main */}
      <main className="md:hidden">
        {children}
      </main>

      {/* Mobile floating primary action */}
      {!isActive('/add') && (
        <Link
          to="/add"
          className="md:hidden fixed bottom-5 right-5 inline-flex items-center gap-2 h-12 pl-4 pr-5 rounded-full bg-ink text-paper shadow-raised transition-transform active:scale-95 z-20"
          aria-label="Log entry"
        >
          <IconPlus />
          <span className="text-sm font-medium">Log entry</span>
        </Link>
      )}
    </div>
  );
}
