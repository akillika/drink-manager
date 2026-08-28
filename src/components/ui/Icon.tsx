import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

type P = SVGProps<SVGSVGElement>;

export const IconPlus = (p: P) => <svg {...base} {...p}><path d="M8 3v10M3 8h10"/></svg>;
export const IconMinus = (p: P) => <svg {...base} {...p}><path d="M3 8h10"/></svg>;
export const IconClose = (p: P) => <svg {...base} {...p}><path d="M4 4l8 8M12 4l-8 8"/></svg>;
export const IconCheck = (p: P) => <svg {...base} {...p}><path d="m3 8.5 3.2 3L13 4.5"/></svg>;
export const IconChevronDown = (p: P) => <svg {...base} {...p}><path d="m4 6 4 4 4-4"/></svg>;
export const IconChevronRight = (p: P) => <svg {...base} {...p}><path d="m6 4 4 4-4 4"/></svg>;
export const IconArrowRight = (p: P) => <svg {...base} {...p}><path d="M3 8h10M9 4l4 4-4 4"/></svg>;
export const IconArrowUpRight = (p: P) => <svg {...base} {...p}><path d="m5 11 6-6M6 5h5v5"/></svg>;
export const IconSearch = (p: P) => <svg {...base} {...p}><circle cx="7" cy="7" r="4"/><path d="m10.5 10.5 3 3"/></svg>;
export const IconCalendar = (p: P) => <svg {...base} {...p}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/></svg>;
export const IconClock = (p: P) => <svg {...base} {...p}><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1.5"/></svg>;
export const IconChart = (p: P) => <svg {...base} {...p}><path d="M3 12V6M6.5 12V4M10 12V8M13.5 12V3M2 13.5h12"/></svg>;
export const IconTarget = (p: P) => <svg {...base} {...p}><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2.5"/></svg>;
export const IconBook = (p: P) => <svg {...base} {...p}><path d="M3 3h6a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2Z"/><path d="M11 3h1.5a.5.5 0 0 1 .5.5V14h-2"/></svg>;
export const IconList = (p: P) => <svg {...base} {...p}><path d="M3 4h10M3 8h10M3 12h10"/></svg>;
export const IconGlass = (p: P) => <svg {...base} {...p}><path d="M4 3h8l-1.2 6a3 3 0 0 1-5.6 0Z"/><path d="M8 12v2M6 14h4"/></svg>;
export const IconHome = (p: P) => <svg {...base} {...p}><path d="m2 8 6-5 6 5v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z"/></svg>;
export const IconEdit = (p: P) => <svg {...base} {...p}><path d="M11 3.5 12.5 5 5 12.5H3.5V11Z"/><path d="M10 4.5 11.5 6"/></svg>;
export const IconTrash = (p: P) => <svg {...base} {...p}><path d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8"/></svg>;
export const IconLogout = (p: P) => <svg {...base} {...p}><path d="M9 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h5"/><path d="m11 5 3 3-3 3M6 8h8"/></svg>;
export const IconMenu = (p: P) => <svg {...base} {...p}><path d="M3 5h10M3 8h10M3 11h10"/></svg>;
export const IconSun = (p: P) => <svg {...base} {...p}><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9"/></svg>;
export const IconMoon = (p: P) => <svg {...base} {...p}><path d="M13 9.5A5 5 0 0 1 6.5 3a.5.5 0 0 0-.7-.55A6 6 0 1 0 13.5 10.2a.5.5 0 0 0-.5-.7Z"/></svg>;
export const IconWarn = (p: P) => <svg {...base} {...p}><path d="M8 2.5 14 13H2Z"/><path d="M8 7v3M8 11.5v.01"/></svg>;
export const IconInfo = (p: P) => <svg {...base} {...p}><circle cx="8" cy="8" r="5.5"/><path d="M8 7.5v3M8 5.5v.01"/></svg>;
export const IconRefresh = (p: P) => <svg {...base} {...p}><path d="M13.5 6A5.5 5.5 0 0 0 3 6V4M2.5 10a5.5 5.5 0 0 0 10.5 0v2"/><path d="M13.5 4v2.5H11M2.5 12V9.5H5"/></svg>;
export const IconGoogle = (p: P) => (
  <svg {...base} {...p} width={p.width ?? 16} height={p.height ?? 16} viewBox="0 0 18 18" stroke="none" fill="currentColor">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.56 2.68-3.87 2.68-6.62Z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.35-1.59-5.06-3.72H.92v2.33A9 9 0 0 0 9 18Z"/>
    <path fill="#FBBC05" d="M3.94 10.7A5.4 5.4 0 0 1 3.65 9c0-.6.1-1.17.29-1.7V4.97H.92A9 9 0 0 0 0 9c0 1.45.35 2.83.92 4.03l3.02-2.33Z"/>
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .92 4.97l3.02 2.33C4.65 5.17 6.65 3.58 9 3.58Z"/>
  </svg>
);
