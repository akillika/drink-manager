import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  IconChart, IconPlus, IconList, IconClock, IconBook, IconTarget,
  IconLogout, IconMenu, IconClose, IconMoon, IconSun, cx,
} from './ui';

interface LayoutProps { children: ReactNode }

const NAV = [
  { to: '/',         label: 'Summary',   Icon: IconChart, color: 'var(--pink)' },
  { to: '/history',  label: 'History',   Icon: IconList,  color: 'var(--blue)' },
  { to: '/sessions', label: 'Sessions',  Icon: IconClock, color: 'var(--purple)' },
  { to: '/library',  label: 'Library',   Icon: IconBook,  color: 'var(--orange)' },
  { to: '/goals',    label: 'Goals',     Icon: IconTarget, color: 'var(--green)' },
] as const;

const LS_THEME = 'dm.theme';

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const s = localStorage.getItem(LS_THEME);
    if (s === 'light' || s === 'dark') return s;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Global keyboard shortcuts.
  //   N or n → new drink entry (matches the sidebar hint)
  //   G then D → go to Dashboard, G then H → History, G then L → Library, etc.
  useEffect(() => {
    let sequence: 'idle' | 'g' = 'idle';
    let seqTimer: number | null = null;
    const isEditable = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;
      const k = e.key.toLowerCase();
      if (sequence === 'g') {
        const map: Record<string, string> = { d: '/', h: '/history', s: '/sessions', l: '/library', o: '/goals', a: '/add' };
        if (map[k]) { e.preventDefault(); navigate(map[k]); }
        sequence = 'idle';
        if (seqTimer) window.clearTimeout(seqTimer);
        return;
      }
      if (k === 'n') { e.preventDefault(); navigate('/add'); return; }
      if (k === 'g') { sequence = 'g'; if (seqTimer) window.clearTimeout(seqTimer); seqTimer = window.setTimeout(() => (sequence = 'idle'), 700); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (seqTimer) window.clearTimeout(seqTimer); };
  }, [navigate]);

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const initials = (user?.displayName || user?.email || 'A').split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 bg-bg/85 backdrop-blur border-b border-separator flex items-center h-14 px-4">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-pink text-white text-xs font-bold">DM</span>
          <span className="text-md font-semibold text-ink">Drinks</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink3 hover:text-ink hover:bg-bg3 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink3 hover:text-ink hover:bg-bg3 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {/* Mobile menu drop */}
      {menuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 bottom-0 z-30 bg-bg2 flex flex-col">
          <div className="p-4 grid gap-1 flex-1 overflow-y-auto">
            {NAV.map(({ to, label, Icon, color }) => {
              const active = isActive(to);
              return (
                <Link key={to} to={to}
                  className={cx(
                    'inline-flex items-center gap-3 h-12 px-3 rounded-xl text-base transition-colors',
                    active ? 'bg-card text-ink' : 'text-ink2 hover:text-ink hover:bg-card',
                  )}
                >
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: active ? color : 'var(--bg-3)' }}>
                    <Icon width={15} height={15} style={{ color: active ? 'white' : color }} />
                  </span>
                  <span className="font-medium">{label}</span>
                </Link>
              );
            })}
            <Link to="/add"
              className="mt-2 inline-flex items-center gap-3 h-12 px-3 rounded-xl bg-pink text-white transition-transform active:scale-[0.98]"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
                <IconPlus />
              </span>
              <span className="font-semibold">Add drink</span>
            </Link>
          </div>
          {user && (
            <div className="border-t border-separator p-4 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-card text-ink text-sm font-semibold">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-ink truncate font-medium">{user.displayName || user.email}</div>
                <div className="text-xs text-ink3 truncate">{user.email}</div>
              </div>
              <button
                onClick={() => signOut()}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-ink3 hover:text-ink hover:bg-card transition-colors"
                aria-label="Sign out"
              >
                <IconLogout />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Desktop shell */}
      <div className="hidden md:grid md:grid-cols-[260px_1fr] min-h-screen">
        <aside className="p-3 flex flex-col sticky top-0 h-screen">
          <div className="bg-card rounded-2xl flex flex-col flex-1 overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-pink text-white text-sm font-bold">DM</span>
              <div>
                <div className="text-md font-semibold text-ink leading-tight">Drinks</div>
                <div className="text-2xs text-ink3">by Akil</div>
              </div>
            </div>

            <Link
              to="/add"
              className="mx-3 mt-3 mb-1 inline-flex items-center gap-2.5 h-11 px-3 rounded-xl bg-pink text-white font-semibold text-sm transition-transform active:scale-[0.98] hover:brightness-110"
            >
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white/20">
                <IconPlus width={13} height={13} />
              </span>
              Add drink
              <span className="ml-auto text-2xs opacity-80 font-mono">N</span>
            </Link>

            <nav className="px-2 py-2 flex flex-col gap-0.5 flex-1 overflow-y-auto">
              {NAV.map(({ to, label, Icon, color }) => {
                const active = isActive(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={cx(
                      'group inline-flex items-center gap-3 h-10 px-2 rounded-xl text-sm transition-colors shrink-0',
                      active ? 'bg-card2 text-ink' : 'text-ink2 hover:text-ink hover:bg-card2',
                    )}
                  >
                    <span
                      className={cx(
                        'inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors',
                      )}
                      style={{
                        background: active ? color : 'transparent',
                        border: active ? 'none' : `1.5px solid ${color}30`,
                      }}
                    >
                      <Icon width={15} height={15} style={{ color: active ? 'white' : color }} />
                    </span>
                    <span className="font-medium">{label}</span>
                  </Link>
                );
              })}
            </nav>

            {user && (
              <div className="border-t border-separator p-2">
                <div className="flex items-center gap-2 px-2 py-2 rounded-xl">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br text-white text-xs font-bold shrink-0"
                    style={{ backgroundImage: 'linear-gradient(135deg, var(--pink), var(--purple))' }}>
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-ink font-semibold truncate leading-tight">{user.displayName || user.email}</div>
                    <div className="text-2xs text-ink3 truncate leading-tight">{user.email}</div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-ink3 hover:text-ink hover:bg-card2 transition-colors"
                      aria-label="Toggle theme"
                      title="Toggle theme"
                    >
                      {theme === 'dark' ? <IconSun /> : <IconMoon />}
                    </button>
                    <button
                      onClick={() => signOut()}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-ink3 hover:text-red hover:bg-[var(--red)18] transition-colors"
                      aria-label="Sign out"
                      title="Sign out"
                    >
                      <IconLogout />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 pr-3 py-3 pl-0">
          <div className="bg-bg2 rounded-2xl min-h-[calc(100vh-24px)] overflow-hidden">
            {children}
          </div>
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
          className="md:hidden fixed bottom-6 right-5 inline-flex items-center gap-2 h-14 pl-5 pr-6 rounded-full bg-pink text-white shadow-raised transition-transform active:scale-95 z-20"
          aria-label="Add drink"
        >
          <IconPlus />
          <span className="text-base font-semibold">Add drink</span>
        </Link>
      )}
    </div>
  );
}
