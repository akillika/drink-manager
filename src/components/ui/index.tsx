import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';

export * from './Icon';

// ---- helpers -------------------------------------------------------
function cx(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(' ');
}

// ---- Page shell ----------------------------------------------------
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('w-full', className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 bg-paper/85 backdrop-blur border-b border-rule">
      <div className="max-w-page mx-auto w-full px-5 sm:px-8 py-4 flex items-center justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-2xs uppercase tracking-[0.14em] text-ink3 font-mono">{eyebrow}</div>
          )}
          <h1 className="text-xl font-medium text-ink leading-tight mt-0.5">{title}</h1>
          {description && (
            <p className="text-ink3 text-xs mt-0.5 hidden sm:block">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('max-w-page mx-auto w-full px-5 sm:px-8 py-6 sm:py-8', className)}>{children}</div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('mb-10 rise', className)}>
      {(title || actions) && (
        <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-medium text-ink">{title}</h2>}
            {description && <p className="text-ink3 text-sm mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// ---- Card ---------------------------------------------------------
export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={cx('bg-paper2 border border-rule rounded-lg', padded && 'p-5', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, meta, className }: { children: ReactNode; meta?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 mb-4', className)}>
      <h3 className="text-sm font-medium text-ink">{children}</h3>
      {meta && <span className="text-xs text-ink3 font-mono tabular">{meta}</span>}
    </div>
  );
}

// ---- Button -------------------------------------------------------
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg';

const btnBase = 'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap select-none';

const btnSize: Record<BtnSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-11 px-5 text-base',
};

const btnVariant: Record<BtnVariant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink2',
  secondary: 'bg-paper2 text-ink border border-rule hover:bg-paper3 hover:border-rule2',
  ghost: 'text-ink2 hover:text-ink hover:bg-paper3',
  danger: 'text-danger hover:bg-paper3',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }>(
  ({ variant = 'secondary', size = 'md', className, children, ...rest }, ref) => (
    <button ref={ref} className={cx(btnBase, btnSize[size], btnVariant[variant], className)} {...rest}>
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export function IconButton({
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx('inline-flex items-center justify-center w-8 h-8 rounded-md text-ink2 hover:text-ink hover:bg-paper3 transition-colors', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---- Field / Input / Select / Textarea ----------------------------
export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cx('block text-xs font-medium text-ink2 mb-1.5', className)}>
      {children}
    </label>
  );
}

const fieldBase =
  'block w-full bg-paper2 border border-rule rounded-md text-ink text-sm placeholder:text-ink3 outline-none transition-colors focus:border-rule2 focus:bg-paper2 disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cx(fieldBase, 'h-10 px-3', className)} {...rest} />
  ),
);
Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...rest }, ref) => (
    <select ref={ref} className={cx(fieldBase, 'h-10 pl-3 pr-8 appearance-none bg-[url("data:image/svg+xml;utf8,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27none%27%20stroke=%27currentColor%27%20stroke-width=%271.5%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27m4%206%204%204%204-4%27/%3E%3C/svg%3E")] bg-[length:14px_14px] bg-no-repeat bg-[right_10px_center]', className)} {...rest}>
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => (
    <textarea ref={ref} className={cx(fieldBase, 'py-2 px-3 resize-y min-h-[72px]', className)} {...rest} />
  ),
);
Textarea.displayName = 'Textarea';

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-2xs text-ink3 mt-1.5">{hint}</p>}
    </div>
  );
}

// ---- Badge --------------------------------------------------------
type BadgeTone = 'neutral' | 'success' | 'warn' | 'danger' | 'accent';
const badgeTone: Record<BadgeTone, string> = {
  neutral: 'bg-paper3 text-ink2',
  success: 'bg-paper3 text-success',
  warn: 'bg-paper3 text-warn',
  danger: 'bg-paper3 text-danger',
  accent: 'bg-ink text-paper',
};
export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 h-5 px-2 rounded text-2xs font-medium font-mono uppercase tracking-[0.06em]', badgeTone[tone], className)}>
      {children}
    </span>
  );
}

// ---- Stat ---------------------------------------------------------
export function Stat({
  label,
  value,
  hint,
  unit,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <div className="text-2xs uppercase tracking-[0.06em] text-ink3 font-medium">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <div className="text-3xl font-medium text-ink tabular">{value}</div>
        {unit && <div className="text-sm text-ink3 font-mono">{unit}</div>}
      </div>
      {hint && <div className="text-xs text-ink3">{hint}</div>}
    </div>
  );
}

// ---- Progress -----------------------------------------------------
export function Progress({
  value,
  max = 100,
  tone = 'accent',
}: {
  value: number;
  max?: number;
  tone?: 'accent' | 'warn' | 'danger' | 'success';
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bar = { accent: 'bg-ink', warn: 'bg-warn', danger: 'bg-danger', success: 'bg-success' }[tone];
  return (
    <div className="w-full h-1.5 bg-paper3 rounded-full overflow-hidden">
      <div className={cx(bar, 'h-full transition-[width] duration-500 ease-out')} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---- Ring gauge — for goal progress ------------------------------
export function Ring({
  value,
  max = 100,
  size = 72,
  stroke = 6,
  tone = 'accent',
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  tone?: 'accent' | 'warn' | 'danger' | 'success';
  children?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = { accent: 'var(--ink)', warn: 'var(--warn)', danger: 'var(--danger)', success: 'var(--success)' }[tone];
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--rule)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.2, 0.7, 0.3, 1)' }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}

// ---- StatCard — a real app-like stat tile ------------------------
export function StatCard({
  label, value, unit, hint, accent, className,
}: {
  label: ReactNode; value: ReactNode; unit?: ReactNode; hint?: ReactNode;
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'pink' | 'none';
  className?: string;
}) {
  const stripe = accent && accent !== 'none' ? {
    blue:   'before:bg-[#305a9a]',
    green:  'before:bg-[#3f7a3f]',
    amber:  'before:bg-[#8e5d17]',
    red:    'before:bg-[#9c2e2e]',
    purple: 'before:bg-[#6a3f8c]',
    pink:   'before:bg-[#a45078]',
  }[accent] : '';
  return (
    <div className={cx(
      'relative bg-paper2 border border-rule rounded-lg p-5 overflow-hidden',
      'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5', stripe,
      className,
    )}>
      <div className="text-2xs uppercase tracking-[0.06em] text-ink3 font-medium mb-2">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <div className="text-3xl font-medium text-ink tabular tracking-[-0.02em]">{value}</div>
        {unit && <div className="text-xs text-ink3 font-mono">{unit}</div>}
      </div>
      {hint && <div className="text-2xs text-ink3 mt-2 tabular">{hint}</div>}
    </div>
  );
}

// ---- Chip - small pill for quick actions -------------------------
export function Chip({
  children, tone, onClick, active,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent';
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cx(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors border',
        active
          ? 'bg-ink text-paper border-ink'
          : tone === 'accent'
            ? 'bg-paper3 text-ink border-rule2 hover:bg-paper4'
            : 'bg-paper2 text-ink2 border-rule hover:text-ink hover:bg-paper3 hover:border-rule2',
      )}
    >
      {children}
    </button>
  );
}

// ---- Empty --------------------------------------------------------
export function Empty({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-rule2 py-16 px-6 text-center">
      <div className="text-md font-medium text-ink mb-1">{title}</div>
      {description && <div className="text-sm text-ink3 max-w-sm mx-auto">{description}</div>}
      {action && <div className="mt-4 inline-flex">{action}</div>}
    </div>
  );
}

// ---- KV row -------------------------------------------------------
export function KVRow({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-center justify-between py-2 text-sm border-b border-rule last:border-0', className)}>
      <span className="text-ink3">{label}</span>
      <span className="text-ink font-mono tabular">{value}</span>
    </div>
  );
}

export { cx };
