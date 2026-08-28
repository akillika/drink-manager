import { useState, useEffect } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Session, AlcoholEntry } from '../types';
import { db } from '../config/firebase';
import {
  collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, deleteField, doc, Timestamp, where,
} from 'firebase/firestore';
import { Page, PageHeader, PageBody, Section, Card, Button, Empty, Badge, Field, Input, Textarea, IconPlus, IconEdit, IconTrash, IconClose, IconRefresh } from '../components/ui';
import { DEMO_MODE } from '../config/demo';
import { DEMO_ENTRIES, DEMO_SESSIONS } from '../config/demoData';

const AUTO_GROUP_THRESHOLD_MINUTES = 120;

export default function Sessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [entries, setEntries] = useState<AlcoholEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    if (DEMO_MODE) {
      setSessions([...DEMO_SESSIONS].sort((a, b) => b.startTime.getTime() - a.startTime.getTime()));
      setEntries([...DEMO_ENTRIES].sort((a, b) => b.date.getTime() - a.date.getTime()));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
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
          id: docSnapshot.id, ...data,
          startTime: data.startTime.toDate(),
          endTime: data.endTime?.toDate(),
          createdAt: data.createdAt.toDate(),
        } as Session);
      });

      const entriesQuery = query(
        collection(db, 'entries'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const entriesSnapshot = await getDocs(entriesQuery);
      const loadedEntries: AlcoholEntry[] = [];
      entriesSnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        loadedEntries.push({ id: docSnapshot.id, ...data, date: data.date.toDate() } as AlcoholEntry);
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
      if (ungroupedEntries.length === 0) { alert('No ungrouped entries to process.'); return; }
      const sortedEntries = [...ungroupedEntries].sort((a, b) => a.date.getTime() - b.date.getTime());
      const groups: AlcoholEntry[][] = [];
      let currentGroup: AlcoholEntry[] = [sortedEntries[0]];
      for (let i = 1; i < sortedEntries.length; i++) {
        const prevEntry = sortedEntries[i - 1];
        const currentEntry = sortedEntries[i];
        const minutesDiff = differenceInMinutes(currentEntry.date, prevEntry.date);
        if (minutesDiff <= AUTO_GROUP_THRESHOLD_MINUTES) {
          currentGroup.push(currentEntry);
        } else {
          if (currentGroup.length > 0) groups.push(currentGroup);
          currentGroup = [currentEntry];
        }
      }
      if (currentGroup.length > 0) groups.push(currentGroup);

      let created = 0;
      for (const group of groups) {
        if (group.length >= 2) {
          const startTime = group[0].date;
          const endTime = group[group.length - 1].date;
          const name = `Session ${format(startTime, 'dd/MM/yyyy HH:mm')}`;
          const sessionRef = await addDoc(collection(db, 'sessions'), {
            userId: user.uid, name,
            startTime: Timestamp.fromDate(startTime),
            endTime: Timestamp.fromDate(endTime),
            entryIds: group.map(e => e.id!).filter(Boolean),
            createdAt: Timestamp.fromDate(new Date()),
          });
          for (const entry of group) {
            if (entry.id) await updateDoc(doc(db, 'entries', entry.id), { sessionId: sessionRef.id });
          }
          created++;
        }
      }
      await loadData();
      alert(`Created ${created} session(s) from auto-grouping.`);
    } catch (error) {
      console.error('Error auto-grouping:', error);
      alert('Failed to auto-group entries. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingSession(null);
    setSessionName(''); setSessionDescription(''); setSelectedEntries([]);
    setShowModal(true);
  };

  const openEdit = (session: Session) => {
    setEditingSession(session);
    setSessionName(session.name);
    setSessionDescription(session.description || '');
    const validEntryIds = session.entryIds.filter(id => entries.some(e => e.id === id));
    setSelectedEntries(validEntryIds);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSessionName(''); setSessionDescription(''); setSelectedEntries([]);
    setEditingSession(null);
  };

  const handleSave = async () => {
    if (!user) return alert('You must be signed in to create a session.');
    if (!sessionName.trim()) return alert('Please enter a session name.');
    if (selectedEntries.length === 0) return alert('Please select at least one entry.');
    try {
      setSaving(true);
      const selectedEntriesData = entries.filter(e => selectedEntries.includes(e.id!));
      if (selectedEntriesData.length === 0) return alert('Selected entries not found. Please refresh and try again.');
      const startTime = selectedEntriesData.reduce((earliest, e) => e.date < earliest ? e.date : earliest, selectedEntriesData[0].date);
      const endTime = selectedEntriesData.reduce((latest, e) => e.date > latest ? e.date : latest, selectedEntriesData[0].date);

      if (editingSession?.id) {
        const sessionId = editingSession.id;
        const oldEntryIds = editingSession.entryIds || [];
        const toRemove = oldEntryIds.filter(id => !selectedEntries.includes(id));
        const toAdd = selectedEntries.filter(id => !oldEntryIds.includes(id));

        for (const entryId of toRemove) {
          try { await updateDoc(doc(db, 'entries', entryId), { sessionId: deleteField() }); }
          catch { console.warn(`Entry ${entryId} skipped`); }
        }
        const validToAdd: string[] = [];
        for (const entryId of toAdd) {
          try {
            await updateDoc(doc(db, 'entries', entryId), { sessionId });
            validToAdd.push(entryId);
          } catch { console.warn(`Entry ${entryId} skipped`); }
        }

        const finalEntryIds = [
          ...oldEntryIds.filter(id => selectedEntries.includes(id)),
          ...validToAdd,
        ];
        const trimmedDescription = sessionDescription.trim();
        const sessionData: any = {
          name: sessionName.trim(),
          startTime: Timestamp.fromDate(startTime),
          endTime: Timestamp.fromDate(endTime),
          entryIds: finalEntryIds,
        };
        sessionData.description = trimmedDescription || deleteField();
        await updateDoc(doc(db, 'sessions', sessionId), sessionData);
      } else {
        const trimmedDescription = sessionDescription.trim();
        const sessionData: any = {
          userId: user.uid,
          name: sessionName.trim(),
          startTime: Timestamp.fromDate(startTime),
          endTime: Timestamp.fromDate(endTime),
          entryIds: selectedEntries,
          createdAt: Timestamp.fromDate(new Date()),
        };
        if (trimmedDescription) sessionData.description = trimmedDescription;

        const sessionRef = await addDoc(collection(db, 'sessions'), sessionData);
        const validEntryIds: string[] = [];
        for (const entryId of selectedEntries) {
          try {
            await updateDoc(doc(db, 'entries', entryId), { sessionId: sessionRef.id });
            validEntryIds.push(entryId);
          } catch { console.warn(`Entry ${entryId} skipped`); }
        }
        if (validEntryIds.length !== selectedEntries.length) {
          await updateDoc(doc(db, 'sessions', sessionRef.id), { entryIds: validEntryIds });
        }
      }

      closeModal();
      await loadData();
    } catch (error: any) {
      console.error('Error saving session:', error);
      alert(`Failed to ${editingSession ? 'update' : 'create'} session: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Delete this session? Entries will be un-grouped.')) return;
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        for (const entryId of session.entryIds) {
          await updateDoc(doc(db, 'entries', entryId), { sessionId: null });
        }
      }
      await deleteDoc(doc(db, 'sessions', sessionId));
      await loadData();
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session. Please try again.');
    }
  };

  const getSessionEntries = (session: Session): AlcoholEntry[] => entries.filter(e => session.entryIds.includes(e.id!));
  const calcStats = (es: AlcoholEntry[]) => ({
    totalMl: es.reduce((sum, e) => sum + e.amount, 0),
    totalAlcohol: es.reduce((sum, e) => sum + (e.amount * e.alcoholPercentage / 100), 0),
    count: es.length,
  });

  const ungroupedEntries = entries.filter(e => !e.sessionId);

  if (loading) {
    return (
      <Page>
        <PageHeader eyebrow="Grouping" title="Sessions" />
        <PageBody>
          <div className="flex items-center justify-center py-24 text-sm text-ink3">Loading…</div>
        </PageBody>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Grouping"
        title="Sessions"
        description="Group entries that belong together. An evening out, a dinner, a work event."
        actions={
          <>
            <Button
              onClick={handleAutoGroup}
              disabled={ungroupedEntries.length < 2}
              title={ungroupedEntries.length < 2 ? `Need at least 2 ungrouped entries. Currently: ${ungroupedEntries.length}` : `Auto-group ${ungroupedEntries.length} ungrouped entries within ${AUTO_GROUP_THRESHOLD_MINUTES} minutes`}
            >
              <IconRefresh /> Auto-group
            </Button>
            <Button variant="primary" onClick={openCreate}><IconPlus /> New session</Button>
          </>
        }
      />

      <PageBody>
      {ungroupedEntries.length >= 2 ? (
        <div className="mb-8 rounded-md border border-rule bg-paper2 px-4 py-3 text-xs text-ink2">
          {ungroupedEntries.length} ungrouped {ungroupedEntries.length === 1 ? 'entry' : 'entries'} available. Auto-group creates sessions from consecutive entries within {AUTO_GROUP_THRESHOLD_MINUTES} minutes of each other.
        </div>
      ) : entries.length === 0 ? (
        <div className="mb-8 rounded-md border border-rule bg-paper2 px-4 py-3 text-xs text-ink2">
          No entries yet. <Link to="/add" className="text-ink underline">Log your first entry</Link> to start tracking.
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <Empty
          title="No sessions yet"
          description="Create a session manually, or use auto-group to bundle entries logged close together."
          action={<Button variant="primary" onClick={openCreate}><IconPlus /> New session</Button>}
        />
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const sessionEntries = getSessionEntries(session);
            const stats = calcStats(sessionEntries);
            return (
              <Card key={session.id} className="rise">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="min-w-0">
                    <h3 className="text-md font-medium text-ink">{session.name}</h3>
                    {session.description && <p className="text-xs text-ink3 mt-1">{session.description}</p>}
                    <p className="text-xs text-ink3 font-mono tabular mt-2">
                      {format(session.startTime, 'dd/MM/yyyy HH:mm')} → {session.endTime ? format(session.endTime, 'HH:mm') : 'Ongoing'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="p-1.5 rounded-md text-ink3 hover:text-ink hover:bg-paper3 transition-colors" onClick={() => openEdit(session)} title="Edit"><IconEdit /></button>
                    <button className="p-1.5 rounded-md text-ink3 hover:text-danger hover:bg-paper3 transition-colors" onClick={() => session.id && handleDelete(session.id)} title="Delete"><IconTrash /></button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-px bg-rule border border-rule rounded-md overflow-hidden mb-5">
                  <StatCell label="Volume" value={`${stats.totalMl.toFixed(0)}`} unit="ml" />
                  <StatCell label="Pure alcohol" value={`${stats.totalAlcohol.toFixed(1)}`} unit="ml" />
                  <StatCell label="Drinks" value={String(stats.count)} unit={stats.count === 1 ? 'drink' : 'drinks'} />
                </div>

                <div className="border-t border-rule pt-3">
                  <div className="text-xs text-ink3 mb-2 flex items-center gap-2">
                    Entries <Badge>{sessionEntries.length}</Badge>
                  </div>
                  <div className="space-y-1">
                    {sessionEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-paper3 transition-colors">
                        <span className="text-ink">{entry.type} <span className="text-ink3 font-mono tabular">· {entry.amount} ml · {entry.alcoholPercentage}%</span></span>
                        <span className="text-ink3 font-mono tabular">{format(entry.date, 'HH:mm')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      </PageBody>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40" onClick={closeModal} />
          <div className="relative bg-paper2 border border-rule2 rounded-lg shadow-popover max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col rise">
            <div className="flex items-center justify-between p-5 border-b border-rule">
              <h3 className="text-md font-medium text-ink">{editingSession ? 'Edit session' : 'New session'}</h3>
              <button className="p-1.5 rounded-md text-ink3 hover:text-ink hover:bg-paper3 transition-colors" onClick={closeModal} title="Close"><IconClose /></button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <Field label="Name">
                <Input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Friday night dinner"
                />
              </Field>

              <Field label="Description (optional)">
                <Textarea
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  placeholder="Notes about the occasion"
                  rows={2}
                />
              </Field>

              <Section title={`Select entries`} description={`${selectedEntries.length} selected`} className="mb-0">
                <Card padded={false} className="max-h-64 overflow-y-auto">
                  {entries.length === 0 ? (
                    <p className="text-sm text-ink3 p-4 text-center">No entries available.</p>
                  ) : (
                    <div className="divide-y divide-rule">
                      {entries.map((entry) => (
                        <label key={entry.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-paper3 transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedEntries.includes(entry.id!)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedEntries([...selectedEntries, entry.id!]);
                              else setSelectedEntries(selectedEntries.filter(id => id !== entry.id));
                            }}
                            className="rounded border-rule2 text-ink focus:ring-0 focus:ring-offset-0"
                          />
                          <span className="text-sm text-ink flex-1">{entry.type}</span>
                          <span className="text-xs font-mono tabular text-ink3">{entry.amount} ml · {entry.alcoholPercentage}%</span>
                          <span className="text-xs font-mono tabular text-ink3">{format(entry.date, 'dd/MM HH:mm')}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </Card>
              </Section>
            </div>

            <div className="flex gap-2 justify-end p-5 border-t border-rule">
              <Button onClick={closeModal}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={!sessionName.trim() || selectedEntries.length === 0 || saving}>
                {saving ? 'Saving…' : editingSession ? 'Save' : 'Create session'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function StatCell({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-paper2 p-3">
      <div className="text-2xs uppercase tracking-[0.06em] text-ink3 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-md text-ink font-medium tabular">{value}</span>
        <span className="text-2xs text-ink3 font-mono">{unit}</span>
      </div>
    </div>
  );
}
