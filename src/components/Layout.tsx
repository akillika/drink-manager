import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  IconChart, IconPlus, IconList, IconClock, IconBook, IconTarget,
  IconLogout, IconMoon, IconSun, cx,
} from './ui';

interface LayoutProps { children: ReactNode }

const NAV = [
  { to: '/',         label: 'Summary',  Icon: IconChart,  color: 'var(--pink)' },
  { to: '/history',  label: 'History',  Icon: IconList,   color: 'var(--blue)' },
  { to: '/sessions', label: 'Sessions', Icon: IconClock,  color: 'var(--purple)' },
  { to: '/library',  label: 'Library',  Icon: IconBook,   color: 'var(--orange)' },
  { to: '/goals',    label: 'Goals',    Icon: IconTarget, color: 'var(--green)' },
] as const;

const LS_THEME = 'dm.theme';

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
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

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));
  const initials = (user?.displayName || user?.email || 'A').split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();
  const onAddPage = isActive('/add');

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Mobile top bar - compact, just brand + theme */}
      <div className="md:hidden sticky top-0 z-30 bg-bg/85 backdrop-blur border-b border-separator flex items-center h-12 px-4 safe-top">
        <Link to="/" className="inline-flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-pink text-white text-2xs font-bold">DM</span>
          <span className="text-sm font-bold text-ink tracking-[-0.01em]">Drinks</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {user && (
            <div className="inline-flex items-center gap-1.5 h-8 px-2 rounded-full bg-card mr-1">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold"
                style={{ backgroundImage: 'linear-gradient(135deg, var(--pink), var(--purple))' }}>
                {initials}
              </span>
              <span className="text-2xs text-ink font-semibold pr-1 max-w-[80px] truncate">{user.displayName?.split(' ')[0] || 'You'}</span>
            </div>
          )}
          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-ink3 hover:text-ink hover:bg-card transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          {user && (
            <button
              onClick={() => signOut()}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-ink3 hover:text-red hover:bg-[var(--red)18] transition-colors"
              aria-label="Sign out"
            >
              <IconLogout />
            </button>
          )}
        </div>
      </div>

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
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
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
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white text-xs font-bold shrink-0"
                    style={{ backgroundImage: 'linear-gradient(135deg, var(--pink), var(--purple))' }}
                  >
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
                    >
                      {theme === 'dark' ? <IconSun /> : <IconMoon />}
                    </button>
                    <button
                      onClick={() => signOut()}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-ink3 hover:text-red hover:bg-[var(--red)18] transition-colors"
                      aria-label="Sign out"
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

      {/* Mobile main - has bottom padding for the tab bar + safe area */}
      <main className="md:hidden pb-[calc(80px+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      {!onAddPage && (
        <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-bg/95 backdrop-blur border-t border-separator" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="grid grid-cols-5 h-[62px]">
            {NAV.map(({ to, label, Icon, color }) => {
              const active = isActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className="flex flex-col items-center justify-center gap-0.5 transition-colors relative"
                >
                  {active && (
                    <span
                      className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full"
                      style={{ background: color }}
                    />
                  )}
                  <Icon
                    width={20}
                    height={20}
                    style={{ color: active ? color : 'var(--ink-3)' }}
                    strokeWidth={active ? 2 : 1.6}
                  />
                  <span
                    className="text-[10px] font-semibold tracking-[0.02em]"
                    style={{ color: active ? color : 'var(--ink-3)' }}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Mobile floating pink Add button - sits above the tab bar */}
      {!onAddPage && (
        <Link
          to="/add"
          className="md:hidden fixed z-50 bg-pink text-white shadow-raised transition-transform active:scale-95 flex items-center justify-center rounded-full w-14 h-14"
          style={{
            bottom: 'calc(80px + env(safe-area-inset-bottom))',
            right: '16px',
            boxShadow: '0 8px 24px -8px rgba(255, 55, 95, 0.5), 0 4px 12px rgba(0,0,0,0.2)',
          }}
          aria-label="Add drink"
        >
          <IconPlus width={22} height={22} />
        </Link>
      )}
    </div>
  );
}
