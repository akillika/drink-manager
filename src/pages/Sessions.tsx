import { useState, useEffect } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { Session, AlcoholEntry } from '../types';
import { db } from '../config/firebase';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, deleteField, doc, Timestamp, where } from 'firebase/firestore';
import { PageBody, Button, Field, Input, Textarea, IconPlus, IconEdit, IconTrash, IconClose, IconRefresh, IconClock, IconGlass, cx } from '../components/ui';
import { DEMO_MODE } from '../config/demo';
import { DEMO_ENTRIES, DEMO_SESSIONS } from '../config/demoData';

const AUTO_GROUP_THRESHOLD_MINUTES = 120;

const TYPE_COLOR: Record<string, string> = {
  Beer: '#FF9F0A', Whisky: '#AC8E68', Rum: '#BF5AF2', Vodka: '#64D2FF',
  Wine: '#FF375F', Cocktail: '#5E5CE6', Water: '#40C8E0', Other: '#8e8e93',
};
const typeColor = (t: string) => TYPE_COLOR[t] || '#8e8e93';

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

  useEffect(() => { if (user) loadData(); /* eslint-disable-line */ }, [user]);

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
      const sSnap = await getDocs(query(collection(db, 'sessions'), where('userId', '==', user.uid), orderBy('startTime', 'desc')));
      const loaded: Session[] = [];
      sSnap.forEach((d) => {
        const data = d.data();
        loaded.push({ id: d.id, ...data, startTime: data.startTime.toDate(), endTime: data.endTime?.toDate(), createdAt: data.createdAt.toDate() } as Session);
      });
      const eSnap = await getDocs(query(collection(db, 'entries'), where('userId', '==', user.uid), orderBy('date', 'desc')));
      const loadedE: AlcoholEntry[] = [];
      eSnap.forEach((d) => { const data = d.data(); loadedE.push({ id: d.id, ...data, date: data.date.toDate() } as AlcoholEntry); });
      setSessions(loaded);
      setEntries(loadedE);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAutoGroup = async () => {
    if (!user) return;
    const ungrouped = entries.filter((e) => !e.sessionId);
    if (ungrouped.length === 0) { alert('Nothing to group.'); return; }
    if (DEMO_MODE) { alert('Demo mode: this would auto-group ungrouped entries.'); return; }
    try {
      setLoading(true);
      const sorted = [...ungrouped].sort((a, b) => a.date.getTime() - b.date.getTime());
      const groups: AlcoholEntry[][] = [];
      let current: AlcoholEntry[] = [sorted[0]];
      for (let i = 1; i < sorted.length; i++) {
        const minutes = differenceInMinutes(sorted[i].date, sorted[i - 1].date);
        if (minutes <= AUTO_GROUP_THRESHOLD_MINUTES) current.push(sorted[i]);
        else { if (current.length) groups.push(current); current = [sorted[i]]; }
      }
      if (current.length) groups.push(current);
      let created = 0;
      for (const g of groups) {
        if (g.length >= 2) {
          const ref = await addDoc(collection(db, 'sessions'), {
            userId: user.uid,
            name: `Session ${format(g[0].date, 'dd/MM/yyyy HH:mm')}`,
            startTime: Timestamp.fromDate(g[0].date),
            endTime: Timestamp.fromDate(g[g.length - 1].date),
            entryIds: g.map((e) => e.id!).filter(Boolean),
            createdAt: Timestamp.fromDate(new Date()),
          });
          for (const e of g) if (e.id) await updateDoc(doc(db, 'entries', e.id), { sessionId: ref.id });
          created++;
        }
      }
      await loadData();
      alert(`Created ${created} session(s).`);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openCreate = () => { setEditingSession(null); setSessionName(''); setSessionDescription(''); setSelectedEntries([]); setShowModal(true); };
  const openEdit = (s: Session) => {
    setEditingSession(s); setSessionName(s.name); setSessionDescription(s.description || '');
    setSelectedEntries(s.entryIds.filter((id) => entries.some((e) => e.id === id)));
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setSessionName(''); setSessionDescription(''); setSelectedEntries([]); setEditingSession(null); };

  const handleSave = async () => {
    if (!user || !sessionName.trim() || selectedEntries.length === 0) { return alert('Name and at least one entry required.'); }
    if (DEMO_MODE) { alert('Demo mode: writes disabled.'); closeModal(); return; }
    try {
      setSaving(true);
      const sel = entries.filter((e) => selectedEntries.includes(e.id!));
      const startTime = sel.reduce((min, e) => (e.date < min ? e.date : min), sel[0].date);
      const endTime = sel.reduce((max, e) => (e.date > max ? e.date : max), sel[0].date);
      const trimDesc = sessionDescription.trim();
      if (editingSession?.id) {
        const data: any = { name: sessionName.trim(), startTime: Timestamp.fromDate(startTime), endTime: Timestamp.fromDate(endTime), entryIds: selectedEntries };
        data.description = trimDesc || deleteField();
        await updateDoc(doc(db, 'sessions', editingSession.id), data);
      } else {
        const data: any = { userId: user.uid, name: sessionName.trim(), startTime: Timestamp.fromDate(startTime), endTime: Timestamp.fromDate(endTime), entryIds: selectedEntries, createdAt: Timestamp.fromDate(new Date()) };
        if (trimDesc) data.description = trimDesc;
        const ref = await addDoc(collection(db, 'sessions'), data);
        for (const id of selectedEntries) try { await updateDoc(doc(db, 'entries', id), { sessionId: ref.id }); } catch {}
      }
      closeModal();
      await loadData();
    } catch (e: any) { console.error(e); alert(`Save failed: ${e?.message}`); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    if (DEMO_MODE) { setSessions(sessions.filter((s) => s.id !== id)); return; }
    try {
      const s = sessions.find((x) => x.id === id);
      if (s) for (const eid of s.entryIds) await updateDoc(doc(db, 'entries', eid), { sessionId: null });
      await deleteDoc(doc(db, 'sessions', id));
      await loadData();
    } catch (e) { console.error(e); alert('Delete failed.'); }
  };

  const getSessionEntries = (s: Session) => entries.filter((e) => s.entryIds.includes(e.id!));
  const ungroupedCount = entries.filter((e) => !e.sessionId).length;

  return (
    <div>
      <div className="sticky top-0 z-10 bg-bg2/85 backdrop-blur border-b border-separator px-6 lg:px-8 py-4 flex items-center justify-between rise">
        <div>
          <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">Grouping</div>
          <h1 className="text-2xl font-bold text-ink tracking-[-0.02em]">Sessions</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleAutoGroup} disabled={ungroupedCount < 2} className="!bg-card !border-separator hover:!bg-card2">
            <IconRefresh /> Auto-group
          </Button>
          <Button variant="primary" onClick={openCreate} className="bg-pink text-white border-pink hover:brightness-110">
            <IconPlus /> New session
          </Button>
        </div>
      </div>

      <PageBody className="!px-6 lg:!px-8 !py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-sm text-ink3">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="bg-card rounded-3xl py-20 px-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--purple)22] text-purple mb-4">
              <IconClock width={22} height={22} />
            </div>
            <div className="text-lg font-semibold text-ink mb-1">No sessions yet</div>
            <div className="text-sm text-ink3 max-w-sm mx-auto mb-6">Group entries that belong together — a night out, a dinner, an event.</div>
            <Button variant="primary" onClick={openCreate} className="bg-pink text-white border-pink hover:brightness-110">
              <IconPlus /> Create your first session
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {sessions.map((s) => {
              const sEntries = getSessionEntries(s);
              const totalMl = sEntries.reduce((acc, e) => acc + e.amount, 0);
              const totalAlcohol = sEntries.reduce((acc, e) => acc + (e.amount * e.alcoholPercentage / 100), 0);
              return (
                <div key={s.id} className="bg-card rounded-3xl overflow-hidden">
                  <div className="p-6 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-[var(--purple)22] text-purple shrink-0">
                          <IconClock width={17} height={17} />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-ink tracking-[-0.015em]">{s.name}</h3>
                          {s.description && <p className="text-xs text-ink3 mt-0.5">{s.description}</p>}
                        </div>
                      </div>
                      <p className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3 tabular ml-14">
                        {format(s.startTime, 'dd MMM, HH:mm')} → {s.endTime ? format(s.endTime, 'HH:mm') : 'Ongoing'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-ink3 hover:text-ink hover:bg-card2 transition-colors" onClick={() => openEdit(s)} title="Edit">
                        <IconEdit />
                      </button>
                      <button className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-ink3 hover:text-red hover:bg-[var(--red)18] transition-colors" onClick={() => s.id && handleDelete(s.id)} title="Delete">
                        <IconTrash />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-px bg-separator border-t border-separator">
                    <StatCell label="Volume" value={totalMl.toFixed(0)} unit="ml" color="var(--cyan)" />
                    <StatCell label="Pure alcohol" value={totalAlcohol.toFixed(1)} unit="ml" color="var(--pink)" />
                    <StatCell label="Drinks" value={String(sEntries.length)} unit={sEntries.length === 1 ? 'entry' : 'entries'} color="var(--orange)" />
                  </div>

                  <div className="border-t border-separator">
                    <div className="px-6 py-3 text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">Entries</div>
                    <div className="divide-y divide-separator">
                      {sEntries.map((e) => {
                        const c = typeColor(e.type);
                        return (
                          <div key={e.id} className="flex items-center gap-3 px-6 py-3 hover:bg-bg3/40 transition-colors">
                            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ background: `${c}22`, color: c }}>
                              <IconGlass width={14} height={14} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-ink font-semibold">{e.type}</div>
                              <div className="text-2xs text-ink3 font-mono tabular">{e.amount} ml · {e.alcoholPercentage}%</div>
                            </div>
                            <div className="text-xs text-ink3 font-mono tabular shrink-0">{format(e.date, 'HH:mm')}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageBody>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-card rounded-3xl shadow-popover max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-separator">
              <h3 className="text-lg font-bold text-ink">{editingSession ? 'Edit session' : 'New session'}</h3>
              <button className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-ink3 hover:text-ink hover:bg-card2 transition-colors" onClick={closeModal} title="Close"><IconClose /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <Field label="Name">
                <Input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Friday night dinner" className="!bg-card2 !border-separator" />
              </Field>
              <Field label="Description (optional)">
                <Textarea value={sessionDescription} onChange={(e) => setSessionDescription(e.target.value)} rows={2} className="!bg-card2 !border-separator" placeholder="Notes about the occasion" />
              </Field>
              <div>
                <div className="text-xs font-semibold text-ink2 mb-2 flex items-baseline justify-between">
                  <span>Entries</span>
                  <span className="text-2xs text-ink3">{selectedEntries.length} selected</span>
                </div>
                <div className="bg-card2 rounded-2xl max-h-64 overflow-y-auto">
                  {entries.length === 0 ? (
                    <p className="text-sm text-ink3 p-4 text-center">No entries available.</p>
                  ) : (
                    <div className="divide-y divide-separator">
                      {entries.map((e) => {
                        const c = typeColor(e.type);
                        const selected = selectedEntries.includes(e.id!);
                        return (
                          <label key={e.id} className={cx('flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors', selected ? 'bg-[var(--blue)18]' : 'hover:bg-bg3/40')}>
                            <input type="checkbox" checked={selected} onChange={(ev) => {
                              if (ev.target.checked) setSelectedEntries([...selectedEntries, e.id!]);
                              else setSelectedEntries(selectedEntries.filter((id) => id !== e.id));
                            }} className="w-4 h-4 rounded" />
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0" style={{ background: `${c}22`, color: c }}>
                              <IconGlass width={12} height={12} />
                            </span>
                            <span className="text-sm text-ink flex-1 font-medium">{e.type}</span>
                            <span className="text-xs font-mono tabular text-ink3">{e.amount} ml · {format(e.date, 'dd/MM HH:mm')}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end p-5 border-t border-separator">
              <Button onClick={closeModal} className="!bg-card2 !border-separator">Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={!sessionName.trim() || selectedEntries.length === 0 || saving} className="bg-pink text-white border-pink hover:brightness-110">
                {saving ? 'Saving…' : editingSession ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="bg-card p-4">
      <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-lg font-bold tabular" style={{ color }}>{value}</span>
        <span className="text-xs text-ink3 font-mono">{unit}</span>
      </div>
    </div>
  );
}
