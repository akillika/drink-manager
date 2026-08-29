import { useState, useEffect } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { AlcoholEntry, Session } from '../types';
import { db } from '../config/firebase';
import { collection, query, orderBy, getDocs, deleteDoc, doc, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { PageBody, Button, IconClock, IconTrash, IconPlus, IconGlass, IconList, cx } from '../components/ui';
import { DEMO_MODE } from '../config/demo';
import { DEMO_ENTRIES, DEMO_SESSIONS } from '../config/demoData';

const STANDARD_DRINK_ALCOHOL_ML = 12.68;

const TYPE_COLOR: Record<string, string> = {
  Beer: '#FF9F0A', Whisky: '#AC8E68', Rum: '#BF5AF2', Vodka: '#64D2FF',
  Wine: '#FF375F', Cocktail: '#5E5CE6', Water: '#40C8E0', Other: '#8e8e93',
};
const typeColor = (t: string) => TYPE_COLOR[t] || '#8e8e93';

export default function History() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AlcoholEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'week' | 'month'>('all');

  useEffect(() => {
    if (user) loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, user]);

  const loadEntries = async () => {
    if (!user) return;
    if (DEMO_MODE) {
      const now = new Date();
      let filtered = DEMO_ENTRIES;
      if (filter !== 'all') {
        const startDate = new Date(now);
        if (filter === 'week') startDate.setDate(startDate.getDate() - 7);
        else startDate.setMonth(startDate.getMonth() - 1);
        filtered = filtered.filter((e) => e.date >= startDate);
      }
      setEntries([...filtered].sort((a, b) => b.date.getTime() - a.date.getTime()));
      setSessions(DEMO_SESSIONS);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const snapshot = await getDocs(query(collection(db, 'entries'), where('userId', '==', user.uid)));
      const loaded: AlcoholEntry[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const entry: AlcoholEntry = { id: d.id, ...data, date: data.date.toDate() } as AlcoholEntry;
        if (entry.userId !== user.uid) return;
        if (filter !== 'all') {
          const startDate = new Date();
          if (filter === 'week') startDate.setDate(startDate.getDate() - 7);
          else startDate.setMonth(startDate.getMonth() - 1);
          if (entry.date >= startDate) loaded.push(entry);
        } else {
          loaded.push(entry);
        }
      });
      loaded.sort((a, b) => b.date.getTime() - a.date.getTime());
      setEntries(loaded);

      const sessionsSnap = await getDocs(query(collection(db, 'sessions'), where('userId', '==', user.uid), orderBy('startTime', 'desc')));
      const loadedSessions: Session[] = [];
      sessionsSnap.forEach((d) => {
        const data = d.data();
        loadedSessions.push({
          id: d.id, ...data,
          startTime: data.startTime.toDate(),
          endTime: data.endTime?.toDate(),
          createdAt: data.createdAt.toDate(),
        } as Session);
      });
      setSessions(loadedSessions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getSessionName = (sessionId?: string): string | null => {
    if (!sessionId) return null;
    return sessions.find((s) => s.id === sessionId)?.name || null;
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this drink?')) return;
    if (DEMO_MODE) { setEntries(entries.filter((e) => e.id !== id)); return; }
    try {
      await deleteDoc(doc(db, 'entries', id));
      setEntries(entries.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete.');
    }
  };

  const grouped = new Map<string, AlcoholEntry[]>();
  entries.forEach((e) => {
    const key = format(e.date, 'yyyy-MM-dd');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  });

  const dayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEEE, dd MMMM');
  };

  const stdOf = (e: AlcoholEntry) => (e.amount * e.alcoholPercentage / 100) / STANDARD_DRINK_ALCOHOL_ML;

  const filterPill = (v: 'all' | 'week' | 'month', label: string) => (
    <button
      onClick={() => setFilter(v)}
      className={cx(
        'h-8 px-4 text-xs font-semibold rounded-full transition-colors',
        filter === v ? 'bg-card text-ink shadow-sm' : 'text-ink3 hover:text-ink',
      )}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="sticky top-0 z-10 bg-bg2/85 backdrop-blur border-b border-separator px-6 lg:px-8 py-4 flex items-center justify-between rise">
        <div>
          <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">Timeline</div>
          <h1 className="text-2xl font-bold text-ink tracking-[-0.02em]">History</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex bg-bg3 rounded-full p-1">
            {filterPill('all', 'All')}
            {filterPill('week', 'Week')}
            {filterPill('month', 'Month')}
          </div>
          <Link to="/add">
            <Button variant="primary" className="bg-pink text-white border-pink hover:brightness-110">
              <IconPlus /> Add drink
            </Button>
          </Link>
        </div>
      </div>

      <PageBody className="!px-6 lg:!px-8 !py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-sm text-ink3">Loading…</div>
        ) : grouped.size === 0 ? (
          <div className="bg-card rounded-3xl py-20 px-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--blue)22] text-blue mb-4">
              <IconList width={22} height={22} />
            </div>
            <div className="text-lg font-semibold text-ink mb-1">Nothing here yet</div>
            <div className="text-sm text-ink3 max-w-sm mx-auto mb-6">Log your first drink and every entry will show up here, grouped by day.</div>
            <Link to="/add">
              <Button variant="primary" className="bg-pink text-white border-pink hover:brightness-110">
                <IconPlus /> Log your first drink
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {Array.from(grouped.entries())
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([date, dayEntries]) => {
                const totalMl = dayEntries.reduce((s, e) => s + e.amount, 0);
                const totalAlcohol = dayEntries.reduce((s, e) => s + (e.amount * e.alcoholPercentage / 100), 0);
                const std = dayEntries.reduce((s, e) => s + stdOf(e), 0);
                return (
                  <div key={date} className="bg-card rounded-3xl overflow-hidden">
                    <div className="flex items-baseline justify-between px-6 pt-5 pb-3">
                      <div>
                        <div className="text-lg font-bold text-ink tracking-[-0.015em]">{dayLabel(date)}</div>
                        <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3 mt-0.5">
                          {format(new Date(date), 'dd MMMM')} · {dayEntries.length} {dayEntries.length === 1 ? 'drink' : 'drinks'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-pink tabular tracking-[-0.02em]">{std.toFixed(1)}</div>
                        <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">std drinks</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-px bg-separator border-t border-separator">
                      <MetricCell label="Volume" value={`${totalMl.toFixed(0)}`} unit="ml" />
                      <MetricCell label="Pure alcohol" value={`${totalAlcohol.toFixed(1)}`} unit="ml" />
                      <MetricCell label="Drinks" value={String(dayEntries.length)} unit={dayEntries.length === 1 ? 'entry' : 'entries'} />
                    </div>
                    <div className="divide-y divide-separator border-t border-separator">
                      {dayEntries.map((entry) => {
                        const c = typeColor(entry.type);
                        const s = stdOf(entry);
                        return (
                          <div key={entry.id} className="flex items-center gap-4 px-6 py-4 hover:bg-bg3/40 transition-colors group">
                            <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl shrink-0" style={{ background: `${c}22`, color: c }}>
                              <IconGlass width={17} height={17} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-md text-ink font-semibold">{entry.type}</span>
                                {entry.sessionId && getSessionName(entry.sessionId) && (
                                  <Link to="/sessions" className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[var(--purple)22] text-purple text-2xs font-semibold">
                                    <IconClock width={9} height={9} /> {getSessionName(entry.sessionId)}
                                  </Link>
                                )}
                              </div>
                              <div className="text-xs text-ink3 font-mono tabular">
                                {entry.amount} ml · {entry.alcoholPercentage}% · {s.toFixed(2)} std
                              </div>
                              {entry.notes && <div className="text-xs text-ink2 mt-1">{entry.notes}</div>}
                            </div>
                            <div className="text-right shrink-0 flex items-center gap-4">
                              <div>
                                <div className="text-sm text-ink font-semibold tabular">{format(entry.date, 'HH:mm')}</div>
                                <div className="text-2xs text-ink3 tabular">{(entry.amount * entry.alcoholPercentage / 100).toFixed(1)} ml pure</div>
                              </div>
                              <button
                                onClick={() => entry.id && handleDelete(entry.id)}
                                className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-ink3 hover:text-red hover:bg-[var(--red)18] transition-colors opacity-0 group-hover:opacity-100"
                                aria-label="Delete"
                                title="Delete"
                              >
                                <IconTrash />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </PageBody>
    </div>
  );
}

function MetricCell({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-card p-4">
      <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-lg font-bold text-ink tabular">{value}</span>
        <span className="text-xs text-ink3 font-mono">{unit}</span>
      </div>
    </div>
  );
}
