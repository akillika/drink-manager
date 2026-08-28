import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { AlcoholEntry, Session } from '../types';
import { db } from '../config/firebase';
import { collection, query, orderBy, getDocs, deleteDoc, doc, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageBody, Card, Empty, Button, Badge, IconClock, IconTrash, IconPlus, cx } from '../components/ui';

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
    try {
      setLoading(true);
      const entriesQuery = query(collection(db, 'entries'), where('userId', '==', user.uid));
      const snapshot = await getDocs(entriesQuery);
      const loadedEntries: AlcoholEntry[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const entry: AlcoholEntry = { id: docSnapshot.id, ...data, date: data.date.toDate() } as AlcoholEntry;
        if (entry.userId !== user.uid) return;
        if (filter !== 'all') {
          const now = new Date();
          const startDate = new Date(now);
          if (filter === 'week') startDate.setDate(startDate.getDate() - 7);
          else startDate.setMonth(startDate.getMonth() - 1);
          if (entry.date >= startDate) loadedEntries.push(entry);
        } else {
          loadedEntries.push(entry);
        }
      });
      loadedEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
      setEntries(loadedEntries);

      const sessionsQuery = query(
        collection(db, 'sessions'),
        where('userId', '==', user.uid),
        orderBy('startTime', 'desc')
      );
      const sessionsSnapshot = await getDocs(sessionsQuery);
      const loadedSessions: Session[] = [];
      sessionsSnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        loadedSessions.push({
          id: docSnapshot.id,
          ...data,
          startTime: data.startTime.toDate(),
          endTime: data.endTime?.toDate(),
          createdAt: data.createdAt.toDate(),
        } as Session);
      });
      setSessions(loadedSessions);
    } catch (error: any) {
      console.error('Error loading entries:', error);
      if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
        alert(`Firestore Query Error: ${error.message}\n\nYou may need to create a composite index. Check the browser console for the link.`);
      } else {
        alert(`Error loading entries: ${error?.message || 'Unknown error'}`);
      }
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const getSessionName = (sessionId?: string): string | null => {
    if (!sessionId) return null;
    const session = sessions.find(s => s.id === sessionId);
    return session ? session.name : null;
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await deleteDoc(doc(db, 'entries', id));
      setEntries(entries.filter((e) => e.id !== id));
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry. Please try again.');
    }
  };

  const groupEntriesByDate = (entries: AlcoholEntry[]) => {
    const grouped = new Map<string, AlcoholEntry[]>();
    entries.forEach((entry) => {
      const dateKey = format(entry.date, 'yyyy-MM-dd');
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey)!.push(entry);
    });
    return grouped;
  };

  const calculateDayTotal = (dayEntries: AlcoholEntry[]) => {
    const totalMl = dayEntries.reduce((sum, e) => sum + e.amount, 0);
    const totalAlcohol = dayEntries.reduce((sum, e) => sum + (e.amount * e.alcoholPercentage / 100), 0);
    return { totalMl, totalAlcohol };
  };

  const filterBtn = (v: 'all' | 'week' | 'month', label: string) => (
    <button
      onClick={() => setFilter(v)}
      className={cx(
        'h-8 px-3 text-xs font-medium transition-colors border-r border-rule last:border-r-0',
        filter === v ? 'bg-paper3 text-ink' : 'text-ink3 hover:text-ink hover:bg-paper3',
      )}
    >
      {label}
    </button>
  );

  if (loading) {
    return (
      <Page>
        <PageHeader eyebrow="Log" title="History" />
        <PageBody>
          <div className="flex items-center justify-center py-24 text-sm text-ink3">Loading…</div>
        </PageBody>
      </Page>
    );
  }

  const groupedEntries = groupEntriesByDate(entries);

  return (
    <Page>
      <PageHeader
        eyebrow="Log"
        title="History"
        description="Every drink you've logged, grouped by day."
        actions={
          <>
            <div className="inline-flex border border-rule rounded-md overflow-hidden">
              {filterBtn('all', 'All time')}
              {filterBtn('week', 'Last week')}
              {filterBtn('month', 'Last month')}
            </div>
            <Link to="/add">
              <Button variant="primary"><IconPlus /> Log entry</Button>
            </Link>
          </>
        }
      />

      <PageBody>
      {groupedEntries.size === 0 ? (
        <Empty
          title="Nothing to show yet"
          description="Log your first entry and it'll appear here."
          action={<Link to="/add"><Button variant="primary"><IconPlus /> Log entry</Button></Link>}
        />
      ) : (
        <div className="space-y-4">
          {Array.from(groupedEntries.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, dayEntries]) => {
              const { totalMl, totalAlcohol } = calculateDayTotal(dayEntries);
              return (
                <Card key={date} padded={false} className="rise">
                  <div className="flex items-baseline justify-between px-5 py-4 border-b border-rule">
                    <h3 className="text-sm font-medium text-ink">
                      {format(new Date(date), 'EEEE, dd MMMM yyyy')}
                    </h3>
                    <div className="text-xs font-mono tabular text-ink3 flex gap-4">
                      <span>{totalMl.toFixed(0)} ml</span>
                      <span>{totalAlcohol.toFixed(1)} ml pure</span>
                      <span>{dayEntries.length} {dayEntries.length === 1 ? 'drink' : 'drinks'}</span>
                    </div>
                  </div>
                  <div className="divide-y divide-rule">
                    {dayEntries.map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between px-5 py-3.5 hover:bg-paper3/40 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-ink font-medium">{entry.type}</span>
                            {entry.sessionId && getSessionName(entry.sessionId) && (
                              <Link to="/sessions">
                                <Badge tone="neutral" className="!normal-case tracking-normal">
                                  <IconClock width={10} height={10} /> {getSessionName(entry.sessionId)}
                                </Badge>
                              </Link>
                            )}
                          </div>
                          <div className="text-xs text-ink3 font-mono tabular">
                            {entry.amount} ml · {entry.alcoholPercentage}% ABV · {(entry.amount * entry.alcoholPercentage / 100).toFixed(1)} ml pure
                          </div>
                          {entry.notes && (
                            <div className="text-xs text-ink3 mt-1">{entry.notes}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 ml-4 shrink-0">
                          <span className="text-xs font-mono tabular text-ink3">{format(entry.date, 'HH:mm')}</span>
                          <button
                            onClick={() => entry.id && handleDelete(entry.id)}
                            className="p-1.5 rounded-md text-ink3 hover:text-danger hover:bg-paper3 transition-colors"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
        </div>
      )}
      </PageBody>
    </Page>
  );
}
