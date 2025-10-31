import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { AlcoholEntry, Session } from '../types';
import { db } from '../config/firebase';
import { collection, query, orderBy, getDocs, deleteDoc, doc, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function History() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AlcoholEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'week' | 'month'>('all');

  useEffect(() => {
    if (user) {
      loadEntries();
    }
  }, [filter, user]);

  const loadEntries = async () => {
    if (!user) return;
    try {
      setLoading(true);
      console.log('Loading entries for user:', user.uid);
      
      // Query with userId (no orderBy to avoid composite index requirement)
      // We'll sort client-side instead
      const entriesQuery = query(
        collection(db, 'entries'),
        where('userId', '==', user.uid)
      );

      const snapshot = await getDocs(entriesQuery);
      console.log('Query returned', snapshot.size, 'documents');
      
      const loadedEntries: AlcoholEntry[] = [];

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        console.log('Entry data:', { id: docSnapshot.id, userId: data.userId, type: data.type });
        
        const entry: AlcoholEntry = {
          id: docSnapshot.id,
          ...data,
          date: data.date.toDate(),
        } as AlcoholEntry;

        // Ensure entry belongs to current user (extra safety check)
        if (entry.userId !== user.uid) {
          console.log('Skipping entry - userId mismatch:', entry.userId, 'vs', user.uid);
          return; // Skip entries that don't belong to this user
        }

        // Apply client-side filter for date ranges
        if (filter !== 'all') {
          const now = new Date();
          let startDate: Date;
          
          if (filter === 'week') {
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
          } else {
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
          }

          if (entry.date >= startDate) {
            loadedEntries.push(entry);
          }
        } else {
          loadedEntries.push(entry);
        }
      });

      console.log('Loaded', loadedEntries.length, 'entries after filtering');
      
      // Sort by date descending (most recent first)
      loadedEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setEntries(loadedEntries);

      // Load sessions for reference
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
      // Check if it's a missing index error
      if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
        console.error('Firestore index required. The error should provide a link to create the index.');
        alert(`Firestore Query Error: ${error.message}\n\nYou may need to create a composite index. Check the browser console for the link.`);
      } else {
        alert(`Error loading entries: ${error?.message || 'Unknown error'}\n\nPlease check the browser console for details.`);
      }
      setEntries([]); // Set empty array on error
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
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

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
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(entry);
    });
    return grouped;
  };

  const calculateDayTotal = (dayEntries: AlcoholEntry[]) => {
    const totalMl = dayEntries.reduce((sum, e) => sum + e.amount, 0);
    const totalAlcohol = dayEntries.reduce(
      (sum, e) => sum + (e.amount * e.alcoholPercentage / 100),
      0
    );
    return { totalMl, totalAlcohol };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const groupedEntries = groupEntriesByDate(entries);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center animate-fade-in-down">
        <h2 className="text-3xl font-bold text-gray-900">History</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md button-bounce transition-all duration-200 hover:scale-105 active:scale-95 ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('week')}
            className={`px-4 py-2 rounded-md button-bounce transition-all duration-200 hover:scale-105 active:scale-95 ${
              filter === 'week'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Last Week
          </button>
          <button
            onClick={() => setFilter('month')}
            className={`px-4 py-2 rounded-md button-bounce transition-all duration-200 hover:scale-105 active:scale-95 ${
              filter === 'month'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Last Month
          </button>
        </div>
      </div>

      {groupedEntries.size === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No entries found</p>
        </div>
      ) : (
            <div className="space-y-4">
              {Array.from(groupedEntries.entries())
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([date, dayEntries], index) => {
                  const { totalMl, totalAlcohol } = calculateDayTotal(dayEntries);
                  return (
                    <div key={date} className="bg-white rounded-lg shadow p-6 card-hover animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {format(new Date(date), 'EEEE, dd MMMM yyyy')}
                    </h3>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{totalMl.toFixed(0)} ml</span>
                      {' • '}
                      <span className="font-medium">{totalAlcohol.toFixed(1)} ml alcohol</span>
                      {' • '}
                      <span>{dayEntries.length} {dayEntries.length === 1 ? 'drink' : 'drinks'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                        {dayEntries.map((entry, entryIndex) => (
                          <div
                            key={entry.id}
                            className="flex justify-between items-start p-3 bg-gray-50 rounded card-hover transition-all duration-200 hover:bg-gray-100 animate-fade-in-up"
                            style={{ animationDelay: `${(index * 0.1) + (entryIndex * 0.05)}s` }}
                          >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{entry.type}</span>
                            {entry.sessionId && getSessionName(entry.sessionId) && (
                              <Link
                                to="/sessions"
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                              >
                                ⏰ {getSessionName(entry.sessionId)}
                              </Link>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {entry.amount} ml @ {entry.alcoholPercentage}% ABV
                            {' • '}
                            {(entry.amount * entry.alcoholPercentage / 100).toFixed(1)} ml alcohol
                          </div>
                          {entry.notes && (
                            <div className="text-sm text-gray-500 mt-1 italic">{entry.notes}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            {format(entry.date, 'HH:mm')}
                          </div>
                        </div>
                        <button
                          onClick={() => entry.id && handleDelete(entry.id)}
                          className="ml-4 text-red-600 hover:text-red-800 text-sm font-medium button-bounce transition-all duration-200 hover:scale-110 active:scale-95"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

