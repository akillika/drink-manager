import { Link, useLocation } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { IconChart, IconPlus, IconList, IconClock, IconBook, IconTarget, IconLogout, IconMenu, IconClose, IconMoon, IconSun, cx } from './ui';

interface LayoutProps {
  children: ReactNode;
}

const NAV = [
  { to: '/',        label: 'Dashboard', Icon: IconChart },
  { to: '/add',     label: 'Log entry',  Icon: IconPlus },
  { to: '/history', label: 'History',    Icon: IconList },
  { to: '/sessions',label: 'Sessions',   Icon: IconClock },
  { to: '/library', label: 'Library',    Icon: IconBook },
  { to: '/goals',   label: 'Goals',      Icon: IconTarget },
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

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-paper">
      <nav className="border-b border-rule bg-paper sticky top-0 z-20">
        <div className="max-w-page mx-auto flex items-center gap-2 px-5 sm:px-8 h-14">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 pr-4 mr-2 border-r border-rule h-6" aria-label="Drink Manager, home">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-ink text-paper text-xs font-semibold">DM</span>
            <span className="text-sm font-medium text-ink hidden sm:inline">Drink Manager</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {NAV.map(({ to, label, Icon }) => {
              const active = isActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cx(
                    'inline-flex items-center gap-2 h-8 px-3 rounded-md text-sm transition-colors',
                    active ? 'bg-paper3 text-ink' : 'text-ink2 hover:text-ink hover:bg-paper3',
                  )}
                >
                  <Icon width={14} height={14} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Theme */}
            <button
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-ink2 hover:text-ink hover:bg-paper3 transition-colors"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>

            {user && (
              <>
                <div className="hidden sm:flex items-center gap-3 pl-2 ml-1 border-l border-rule h-6">
                  <div className="hidden lg:flex flex-col items-end leading-tight">
                    <span className="text-xs text-ink font-medium">{user.displayName || user.email}</span>
                    <span className="text-2xs text-ink3">{user.email}</span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs text-ink2 hover:text-ink hover:bg-paper3 transition-colors"
                    title="Sign out"
                  >
                    <IconLogout />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </div>

                {/* Mobile menu button */}
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-md text-ink2 hover:text-ink hover:bg-paper3 transition-colors"
                  aria-label="Toggle navigation"
                >
                  {menuOpen ? <IconClose /> : <IconMenu />}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-rule bg-paper2">
            <div className="max-w-page mx-auto px-5 py-3 grid gap-1">
              {NAV.map(({ to, label, Icon }) => {
                const active = isActive(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className={cx(
                      'inline-flex items-center gap-3 h-10 px-3 rounded-md text-sm transition-colors',
                      active ? 'bg-paper3 text-ink' : 'text-ink2 hover:text-ink hover:bg-paper3',
                    )}
                  >
                    <Icon width={16} height={16} />
                    <span>{label}</span>
                  </Link>
                );
              })}
              {user && (
                <div className="border-t border-rule pt-3 mt-2">
                  <div className="px-3 pb-2">
                    <div className="text-sm text-ink font-medium">{user.displayName || user.email}</div>
                    <div className="text-xs text-ink3 truncate">{user.email}</div>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); signOut(); }}
                    className="w-full inline-flex items-center gap-3 h-10 px-3 rounded-md text-sm text-ink2 hover:text-ink hover:bg-paper3 transition-colors"
                  >
                    <IconLogout />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      <main>
        {children}
      </main>
    </div>
  );
}
