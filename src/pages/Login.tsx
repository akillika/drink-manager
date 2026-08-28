import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { IconGoogle, IconRefresh } from '../components/ui';

/**
 * The Ledger. A login page that behaves like the inside cover of a private
 * drinking journal. Warm paper, editorial masthead/footer, a sample ledger
 * with entries that get "written in" on load, a hand-drawn glass that fills
 * with ink, and a small living time in the top rail.
 */
export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState<string>('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = (now.getUTCHours() + 5) % 24;
      const rawMin = now.getUTCMinutes() + 30;
      const min = rawMin % 60;
      const hh = String(rawMin >= 60 ? (h + 1) % 24 : h).padStart(2, '0');
      const mm = String(min).padStart(2, '0');
      setClock(`${hh}:${mm} IST`);
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Failed to sign in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper login-paper flex flex-col">
      {/* Slim masthead */}
      <div className="w-full flex items-center justify-between px-6 sm:px-10 py-5 text-2xs font-mono uppercase tracking-[0.14em] text-ink3">
        <span>Drink Manager · Vol. I</span>
        <span className="hidden sm:inline">A private ledger</span>
        <span className="hidden sm:inline tabular">
          {clock ? clock : 'Est. MMXXVI'}
        </span>
      </div>

      <div className="w-full h-px bg-rule" />

      {/* Book spread */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.15fr_1px_0.85fr] max-w-[1200px] mx-auto w-full">
        {/* Left page */}
        <section className="p-8 sm:p-14 lg:pr-16 flex flex-col">
          {/* Hand-drawn glass motif — fill draws in on mount */}
          <svg
            viewBox="0 0 120 160"
            className="w-14 h-auto text-ink mb-10 ink-in"
            style={{ animationDelay: '80ms' }}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M25 20 L95 20 L82 90 A28 28 0 0 1 38 90 Z" />
            <path d="M60 118 L60 148" />
            <path d="M36 148 L84 148" />
            <path
              d="M31 65 C 45 62, 75 62, 89 65"
              className="glass-fill"
              pathLength={60}
              opacity="0"
            />
          </svg>

          <h1
            className="font-serif text-ink text-[42px] sm:text-[56px] lg:text-[72px] leading-[1.0] tracking-[-0.03em] font-medium max-w-[11ch] ink-in"
            style={{ animationDelay: '180ms' }}
          >
            A private ledger<br />
            of what you<br />
            <span className="italic text-ink">drink.</span>
          </h1>

          <p
            className="mt-8 text-md text-ink2 max-w-md leading-[1.55] ink-in"
            style={{ animationDelay: '360ms' }}
          >
            No streaks, no shame, no scoreboard. A quiet accounting of what you had,
            when, and how much. Kept only for you.
          </p>

          {/* Sample ledger */}
          <div className="mt-12 lg:mt-16">
            <div
              className="flex items-baseline justify-between mb-3 ink-in"
              style={{ animationDelay: '480ms' }}
            >
              <span className="text-2xs font-mono uppercase tracking-[0.12em] text-ink3">
                Sample page
              </span>
              <span className="text-2xs font-mono uppercase tracking-[0.12em] text-ink4">
                fri, 22 aug
              </span>
            </div>
            <div className="border-t border-b border-rule">
              <LedgerRow time="18:42" drink="Old Fashioned" amount="60 ml" abv="40%" pure="24 ml" delay="580ms" />
              <LedgerRow time="19:15" drink="Porter"        amount="440 ml" abv="4.8%" pure="21 ml" delay="700ms" />
              <LedgerRow time="20:03" drink="House red"     amount="150 ml" abv="12.5%" pure="19 ml" delay="820ms" />
              <LedgerRow time="21:47" drink="Water"         amount="500 ml" abv="—"     pure="0 ml"  delay="940ms" muted />
            </div>
            <div
              className="flex items-center justify-between mt-3 text-2xs font-mono uppercase tracking-[0.12em] ink-in"
              style={{ animationDelay: '1080ms' }}
            >
              <span className="text-ink3">total</span>
              <span className="text-ink tabular">64 ml pure · 5.0 std</span>
            </div>
          </div>

          {/* Footer marginalia */}
          <p
            className="mt-auto pt-14 lg:pt-20 font-serif italic text-ink3 text-[15px] leading-[1.55] max-w-md ink-in"
            style={{ animationDelay: '1240ms' }}
          >
            "A number is easier to argue with than a memory."
          </p>
        </section>

        {/* Center hairline */}
        <div className="hidden lg:block bg-rule w-px" />

        {/* Right page */}
        <section className="p-8 sm:p-14 lg:pl-16 flex flex-col justify-center min-h-[540px] border-t border-rule lg:border-t-0">
          <div className="max-w-sm ink-in" style={{ animationDelay: '260ms' }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xs font-mono uppercase tracking-[0.12em] text-ink3">
                Chapter one
              </span>
              <span className="flex-1 h-px bg-rule" />
              <span className="text-2xs font-mono uppercase tracking-[0.12em] text-ink4">
                Sign in
              </span>
            </div>
            <h2 className="font-serif text-ink text-[36px] leading-[1.05] tracking-[-0.02em] font-medium">
              Open the book.
            </h2>
            <p className="mt-3 text-sm text-ink2 leading-[1.55]">
              Signing in creates a private ledger under your Google account.
              Only you can read from it or write to it.
            </p>

            <div className="mt-8">
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="group w-full inline-flex items-center justify-between h-12 px-4 rounded-md bg-paper2 border border-rule hover:border-ink2 hover:bg-paper3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-3">
                  {loading ? <IconRefresh className="animate-spin text-ink2" /> : <IconGoogle width={16} height={16} />}
                  <span className="text-ink text-sm font-medium">
                    {loading ? 'Opening…' : 'Continue with Google'}
                  </span>
                </span>
                <span className="text-ink3 text-2xs font-mono tabular tracking-[0.06em] group-hover:text-ink transition-colors">
                  Return ↵
                </span>
              </button>

              {error && (
                <div className="mt-3 text-xs text-danger px-3 py-2 rounded-md border border-rule2">
                  {error}
                </div>
              )}
            </div>

            <div className="mt-10 border-t border-rule pt-5 grid gap-2.5 text-xs text-ink3">
              <FootnoteRow label="No streaks" hint="Numbers, not scores" />
              <FootnoteRow label="No sharing" hint="Data stays on your account" />
              <FootnoteRow label="No ads or trackers" hint="Loaded once, then quiet" />
            </div>

            <div className="mt-10 flex items-center justify-between text-2xs font-mono uppercase tracking-[0.14em] text-ink4">
              <span>drinks.akil.codes</span>
              <span className="tabular">MMXXVI</span>
            </div>
          </div>
        </section>
      </div>

      <div className="w-full h-px bg-rule" />
      <div className="w-full flex items-center justify-between px-6 sm:px-10 py-5 text-2xs font-mono uppercase tracking-[0.14em] text-ink4">
        <span>By Akil</span>
        <span className="hidden sm:inline">Made in Chennai</span>
        <span className="tabular">Page 001</span>
      </div>
    </div>
  );
}

function LedgerRow({
  time, drink, amount, abv, pure, muted, delay,
}: {
  time: string; drink: string; amount: string; abv: string; pure: string; muted?: boolean; delay?: string;
}) {
  return (
    <div
      className={
        'grid grid-cols-[48px_1fr_auto_auto_72px] items-baseline gap-3 border-t border-rule py-2.5 first:border-t-0 ink-in ' +
        (muted ? 'opacity-55' : '')
      }
      style={{ animationDelay: delay }}
    >
      <span className="text-2xs font-mono text-ink3 tabular">{time}</span>
      <span className={muted ? 'text-sm text-ink italic' : 'text-sm text-ink'}>{drink}</span>
      <span className="text-2xs font-mono text-ink2 tabular">{amount}</span>
      <span className="text-2xs font-mono text-ink3 tabular">{abv}</span>
      <span className="text-2xs font-mono text-ink tabular text-right">{pure}</span>
    </div>
  );
}

function FootnoteRow({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink">{label}</span>
      <span className="text-ink3">{hint}</span>
    </div>
  );
}
