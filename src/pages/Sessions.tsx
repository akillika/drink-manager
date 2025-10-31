import { useState, useEffect } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Session, AlcoholEntry } from '../types';
import { db } from '../config/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  deleteField,
  doc, 
  Timestamp,
  where
} from 'firebase/firestore';

const AUTO_GROUP_THRESHOLD_MINUTES = 120; // Group entries within 2 hours

export default function Sessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [entries, setEntries] = useState<AlcoholEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      // Load sessions
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

      // Load entries
      const entriesQuery = query(
        collection(db, 'entries'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const entriesSnapshot = await getDocs(entriesQuery);
      const loadedEntries: AlcoholEntry[] = [];
      
      entriesSnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        loadedEntries.push({
          id: docSnapshot.id,
          ...data,
          date: data.date.toDate(),
        } as AlcoholEntry);
      });

      setSessions(loadedSessions);
      setEntries(loadedEntries);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoGroup = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const ungroupedEntries = entries.filter(e => !e.sessionId);
      
      if (ungroupedEntries.length === 0) {
        alert('No ungrouped entries to process.');
        return;
      }

      // Sort by date
      const sortedEntries = [...ungroupedEntries].sort((a, b) => 
        a.date.getTime() - b.date.getTime()
      );

      const groups: AlcoholEntry[][] = [];
      let currentGroup: AlcoholEntry[] = [sortedEntries[0]];

      for (let i = 1; i < sortedEntries.length; i++) {
        const prevEntry = sortedEntries[i - 1];
        const currentEntry = sortedEntries[i];
        const minutesDiff = differenceInMinutes(currentEntry.date, prevEntry.date);

        if (minutesDiff <= AUTO_GROUP_THRESHOLD_MINUTES) {
          currentGroup.push(currentEntry);
        } else {
          if (currentGroup.length > 0) {
            groups.push(currentGroup);
          }
          currentGroup = [currentEntry];
        }
      }

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }

      // Create sessions for groups with 2+ entries
      for (const group of groups) {
        if (group.length >= 2) {
          const startTime = group[0].date;
          const endTime = group[group.length - 1].date;
          const sessionName = `Session ${format(startTime, 'dd/MM/yyyy HH:mm')}`;

          const sessionData = {
            userId: user.uid,
            name: sessionName,
            startTime: Timestamp.fromDate(startTime),
            endTime: Timestamp.fromDate(endTime),
            entryIds: group.map(e => e.id!).filter(Boolean),
            createdAt: Timestamp.fromDate(new Date()),
          };

          const sessionRef = await addDoc(collection(db, 'sessions'), sessionData);

          // Update entries with sessionId
          for (const entry of group) {
            if (entry.id) {
              await updateDoc(doc(db, 'entries', entry.id), {
                sessionId: sessionRef.id,
              });
            }
          }
        }
      }

      await loadData();
      alert(`Created ${groups.filter(g => g.length >= 2).length} session(s) from auto-grouping.`);
    } catch (error) {
      console.error('Error auto-grouping:', error);
      alert('Failed to auto-group entries. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!user) {
      alert('You must be signed in to create a session.');
      return;
    }
    if (!sessionName.trim()) {
      alert('Please enter a session name.');
      return;
    }

    if (selectedEntries.length === 0) {
      alert('Please select at least one entry.');
      return;
    }

    try {
      const selectedEntriesData = entries.filter(e => selectedEntries.includes(e.id!));
      
      if (selectedEntriesData.length === 0) {
        alert('Selected entries not found. Please refresh and try again.');
        return;
      }

      if (selectedEntriesData.length !== selectedEntries.length) {
        const missingCount = selectedEntries.length - selectedEntriesData.length;
        console.warn(`${missingCount} selected entry(s) not found in entries array`);
      }

      const startTime = selectedEntriesData.reduce((earliest, entry) => 
        entry.date < earliest ? entry.date : earliest, 
        selectedEntriesData[0].date
      );
      const endTime = selectedEntriesData.reduce((latest, entry) => 
        entry.date > latest ? entry.date : latest, 
        selectedEntriesData[0].date
      );

      if (editingSession?.id) {
        // Editing existing session
        const sessionId = editingSession.id;
        const oldEntryIds = editingSession.entryIds || [];
        
        // Find entries to remove from session
        const entriesToRemove = oldEntryIds.filter(id => !selectedEntries.includes(id));
        // Find entries to add to session
        const entriesToAdd = selectedEntries.filter(id => !oldEntryIds.includes(id));

        // Remove sessionId from entries that were removed (only if entry exists)
        for (const entryId of entriesToRemove) {
          try {
            const entryDoc = doc(db, 'entries', entryId);
            // Check if entry exists by trying to update it
            await updateDoc(entryDoc, {
              sessionId: deleteField(),
            });
          } catch (error: any) {
            // Entry doesn't exist or can't be updated - skip it
            console.warn(`Entry ${entryId} not found or couldn't be updated, skipping`);
          }
        }

        // Add sessionId to entries that were newly added (only if entry exists)
        const validEntriesToAdd: string[] = [];
        for (const entryId of entriesToAdd) {
          try {
            const entryDoc = doc(db, 'entries', entryId);
            await updateDoc(entryDoc, {
              sessionId: sessionId,
            });
            validEntriesToAdd.push(entryId);
          } catch (error: any) {
            // Entry doesn't exist or can't be updated - skip it
            console.warn(`Entry ${entryId} not found or couldn't be updated, skipping`);
          }
        }

        // Update session document with only valid entries (preserve createdAt)
        const finalEntryIds = [
          ...oldEntryIds.filter(id => selectedEntries.includes(id)), // Keep existing valid entries
          ...validEntriesToAdd // Add newly added valid entries
        ];
        
        const trimmedDescription = sessionDescription.trim();
        const sessionData: any = {
          name: sessionName.trim(),
          startTime: Timestamp.fromDate(startTime),
          endTime: Timestamp.fromDate(endTime),
          entryIds: finalEntryIds,
        };
        
        // Only include description if it has a value (Firestore doesn't allow undefined)
        if (trimmedDescription) {
          sessionData.description = trimmedDescription;
        } else {
          // If description is empty, remove it using deleteField
          sessionData.description = deleteField();
        }
        
        await updateDoc(doc(db, 'sessions', sessionId), sessionData);
      } else {
        // Creating new session
        const trimmedDescription = sessionDescription.trim();
        const sessionData: any = {
          userId: user.uid,
          name: sessionName.trim(),
          startTime: Timestamp.fromDate(startTime),
          endTime: Timestamp.fromDate(endTime),
          entryIds: selectedEntries,
          createdAt: Timestamp.fromDate(new Date()),
        };
        
        // Only include description if it has a value (Firestore doesn't allow undefined)
        if (trimmedDescription) {
          sessionData.description = trimmedDescription;
        }

        const sessionRef = await addDoc(collection(db, 'sessions'), sessionData);
        
        // Update entries with sessionId (only if entry exists)
        const validEntryIds: string[] = [];
        for (const entryId of selectedEntries) {
          try {
            const entryDoc = doc(db, 'entries', entryId);
            await updateDoc(entryDoc, {
              sessionId: sessionRef.id,
            });
            validEntryIds.push(entryId);
          } catch (error: any) {
            // Entry doesn't exist or can't be updated - skip it
            console.warn(`Entry ${entryId} not found or couldn't be updated, skipping`);
          }
        }
        
        // Update session with only valid entry IDs
        if (validEntryIds.length !== selectedEntries.length) {
          await updateDoc(doc(db, 'sessions', sessionRef.id), {
            entryIds: validEntryIds,
          });
        }
      }

      setShowCreateModal(false);
      setSessionName('');
      setSessionDescription('');
      setSelectedEntries([]);
      setEditingSession(null);
      await loadData();
    } catch (error: any) {
      console.error('Error creating/updating session:', error);
      const errorMessage = error?.message || error?.code || 'Unknown error occurred';
      alert(`Failed to ${editingSession ? 'update' : 'create'} session: ${errorMessage}\n\nPlease check the browser console for more details.`);
    }
  };

  const handleEditSession = (session: Session) => {
    setEditingSession(session);
    setSessionName(session.name);
    setSessionDescription(session.description || '');
    // Only select entries that actually exist in the loaded entries array
    const validEntryIds = session.entryIds.filter(id => 
      entries.some(e => e.id === id)
    );
    setSelectedEntries(validEntryIds);
    setShowCreateModal(true);
    
    if (validEntryIds.length !== session.entryIds.length) {
      const missingCount = session.entryIds.length - validEntryIds.length;
      console.warn(`Warning: ${missingCount} entry(s) from this session are no longer available`);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? Entries will be ungrouped.')) {
      return;
    }

    try {
      const session = sessions.find(s => s.id === sessionId);
      
      // Remove sessionId from entries
      if (session) {
        for (const entryId of session.entryIds) {
          const entryRef = doc(db, 'entries', entryId);
          await updateDoc(entryRef, {
            sessionId: null,
          });
        }
      }

      await deleteDoc(doc(db, 'sessions', sessionId));
      await loadData();
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session. Please try again.');
    }
  };

  const getSessionEntries = (session: Session): AlcoholEntry[] => {
    return entries.filter(e => session.entryIds.includes(e.id!));
  };

  const calculateSessionStats = (sessionEntries: AlcoholEntry[]) => {
    const totalMl = sessionEntries.reduce((sum, e) => sum + e.amount, 0);
    const totalAlcohol = sessionEntries.reduce(
      (sum, e) => sum + (e.amount * e.alcoholPercentage / 100 * 0.789),
      0
    );
    return { totalMl, totalAlcohol, count: sessionEntries.length };
  };

  const ungroupedEntries = entries.filter(e => !e.sessionId);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center animate-fade-in-down">
        <h2 className="text-3xl font-bold text-gray-900">⏰ Sessions & Events</h2>
        <div className="flex gap-2">
          <button
            onClick={handleAutoGroup}
            disabled={ungroupedEntries.length < 2}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed button-bounce transition-all duration-200 hover:scale-105 active:scale-95"
            title={ungroupedEntries.length < 2 ? `Need at least 2 ungrouped entries to auto-group. Currently: ${ungroupedEntries.length}` : ''}
          >
            Auto-Group Entries
            {ungroupedEntries.length > 0 && ungroupedEntries.length < 2 && (
              <span className="ml-2 text-xs">({ungroupedEntries.length}/2)</span>
            )}
          </button>
          <button
            onClick={() => {
              setEditingSession(null);
              setSessionName('');
              setSessionDescription('');
              setSelectedEntries([]);
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 button-bounce transition-all duration-200 hover:scale-105 active:scale-95"
          >
            Create Session
          </button>
        </div>
      </div>

      {/* Auto-grouping info */}
      {ungroupedEntries.length >= 2 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> Click "Auto-Group Entries" to automatically create sessions 
            from consecutive entries within {AUTO_GROUP_THRESHOLD_MINUTES} minutes.
            ({ungroupedEntries.length} ungrouped entries available)
          </p>
        </div>
      ) : ungroupedEntries.length === 1 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⏳ Auto-Group requires at least <strong>2 ungrouped entries</strong>. 
            You currently have {ungroupedEntries.length} ungrouped entry. 
            Add one more entry to enable auto-grouping, or create a session manually.
          </p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            📝 No entries yet. <Link to="/add" className="text-indigo-600 hover:underline">Add your first entry</Link> to start tracking!
          </p>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            ✅ All entries are already grouped into sessions! You can still create new sessions manually.
          </p>
        </div>
      )}

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">No sessions created yet.</p>
          <p className="text-sm text-gray-400">
            Create a session manually or use auto-grouping to organize your entries.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session, index) => {
            const sessionEntries = getSessionEntries(session);
            const stats = calculateSessionStats(sessionEntries);
            
              return (
              <div key={session.id} className="bg-white rounded-lg shadow p-6 card-hover animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{session.name}</h3>
                    {session.description && (
                      <p className="text-sm text-gray-600 mt-1">{session.description}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      {format(session.startTime, 'dd/MM/yyyy HH:mm')} -{' '}
                      {session.endTime 
                        ? format(session.endTime, 'HH:mm')
                        : 'Ongoing'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditSession(session)}
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => session.id && handleDeleteSession(session.id)}
                      className="px-3 py-1 text-sm bg-red-200 text-red-700 rounded hover:bg-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Session Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-blue-600 font-medium">Total Volume</div>
                    <div className="text-lg font-bold text-blue-900">{stats.totalMl.toFixed(0)} ml</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="text-xs text-purple-600 font-medium">Total Alcohol</div>
                    <div className="text-lg font-bold text-purple-900">{stats.totalAlcohol.toFixed(1)} g</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-green-600 font-medium">Drinks</div>
                    <div className="text-lg font-bold text-green-900">{stats.count}</div>
                  </div>
                </div>

                {/* Session Entries */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Entries ({sessionEntries.length})
                  </h4>
                  <div className="space-y-2">
                    {sessionEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm"
                      >
                        <span className="text-gray-700">
                          {entry.type} - {entry.amount} ml @ {entry.alcoholPercentage}% ABV
                        </span>
                        <span className="text-gray-500">
                          {format(entry.date, 'h:mm a')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {editingSession ? 'Edit Session' : 'Create New Session'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session Name *
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g., Friday Night Dinner, Watching the Game"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  rows={2}
                  placeholder="Add details about this session..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Entries *
                </label>
                <div className="border border-gray-300 rounded-md p-4 max-h-64 overflow-y-auto">
                  {entries.length === 0 ? (
                    <p className="text-gray-500 text-sm">No entries available.</p>
                  ) : (
                    <div className="space-y-2">
                      {entries.map((entry) => (
                        <label
                          key={entry.id}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedEntries.includes(entry.id!)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEntries([...selectedEntries, entry.id!]);
                              } else {
                                setSelectedEntries(selectedEntries.filter(id => id !== entry.id));
                              }
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700">
                            {entry.type} - {entry.amount} ml @ {entry.alcoholPercentage}% - {format(entry.date, 'dd/MM/yyyy HH:mm')}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleCreateSession}
                  disabled={!sessionName.trim() || selectedEntries.length === 0}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingSession ? 'Update Session' : 'Create Session'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSessionName('');
                    setSessionDescription('');
                    setSelectedEntries([]);
                    setEditingSession(null);
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

