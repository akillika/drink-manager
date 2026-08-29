import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { collection, addDoc, Timestamp, query, where, getDocs, orderBy, updateDoc, doc } from 'firebase/firestore';
import { Session, DrinkLibraryItem } from '../types';
import { format, differenceInMinutes } from 'date-fns';
import {
  PageBody, Button, Field, Input, Select, Textarea,
  IconRefresh, IconGlass, IconClock, IconChart, IconTarget, cx,
} from '../components/ui';
import { DEMO_MODE } from '../config/demo';
import { DEMO_LIBRARY, DEMO_SESSIONS } from '../config/demoData';

const DRINK_TYPES = [
  { label: 'Beer',     defaultAmountOz: 12,  defaultAmountMl: 650, defaultPercentage: 5,  color: '#FF9F0A' },
  { label: 'Whisky',   defaultAmountOz: 1.5, defaultAmountMl: 30,  defaultPercentage: 40, color: '#AC8E68' },
  { label: 'Rum',      defaultAmountOz: 1.5, defaultAmountMl: 30,  defaultPercentage: 40, color: '#BF5AF2' },
  { label: 'Vodka',    defaultAmountOz: 1.5, defaultAmountMl: 30,  defaultPercentage: 40, color: '#64D2FF' },
  { label: 'Wine',     defaultAmountOz: 5,   defaultAmountMl: 150, defaultPercentage: 12.5, color: '#FF375F' },
  { label: 'Cocktail', defaultAmountOz: 6,   defaultAmountMl: 150, defaultPercentage: 15, color: '#5E5CE6' },
  { label: 'Other',    defaultAmountOz: 4,   defaultAmountMl: 100, defaultPercentage: 10, color: '#8e8e93' },
];

const OZ_TO_ML = 29.5735;
const AUTO_SESSION_THRESHOLD_MINUTES = 120;
const STANDARD_DRINK_ALCOHOL_ML = 12.68;

export default function AddEntry() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState('Beer');
  const [useOz, setUseOz] = useState(false);
  const [amountOz, setAmountOz] = useState(12);
  const [amountMl, setAmountMl] = useState(650);
  const [useDefaultABV, setUseDefaultABV] = useState(true);
  const [alcoholPercentage, setAlcoholPercentage] = useState(5);
  const [customTime, setCustomTime] = useState(false);
  const [logTime, setLogTime] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [autoSuggestSession, setAutoSuggestSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  const [drinkLibrary, setDrinkLibrary] = useState<DrinkLibraryItem[]>([]);
  const [selectedLibraryDrink, setSelectedLibraryDrink] = useState<string>('');

  const currentColor = DRINK_TYPES.find((d) => d.label === type)?.color || '#8e8e93';

  const handleTypeChange = (v: string) => {
    setType(v);
    const dt = DRINK_TYPES.find((d) => d.label === v);
    if (dt) {
      setUseOz(false);
      setAmountMl(dt.defaultAmountMl); setAmountOz(dt.defaultAmountOz);
      if (useDefaultABV) setAlcoholPercentage(dt.defaultPercentage);
    }
  };

  const handleUseDefaultABVToggle = () => {
    const newVal = !useDefaultABV;
    setUseDefaultABV(newVal);
    if (newVal) {
      const dt = DRINK_TYPES.find((d) => d.label === type);
      if (dt) setAlcoholPercentage(dt.defaultPercentage);
    }
  };

  const handleAmountChange = (v: number, isOz: boolean) => {
    if (isOz) { setAmountOz(v); setAmountMl(v * OZ_TO_ML); }
    else       { setAmountMl(v); setAmountOz(v / OZ_TO_ML); }
  };

  useEffect(() => {
    if (user) { loadSessions(); loadDrinkLibrary(); checkAutoSession(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logTime, customTime, user]);

  const loadDrinkLibrary = async () => {
    if (!user) return;
    if (DEMO_MODE) { setDrinkLibrary(DEMO_LIBRARY); return; }
    try {
      const snap = await getDocs(query(collection(db, 'drinkLibrary'), where('userId', '==', user.uid), orderBy('timesUsed', 'desc')));
      const loaded: DrinkLibraryItem[] = [];
      snap.forEach((d) => { const data = d.data(); loaded.push({ id: d.id, ...data, createdAt: data.createdAt.toDate(), lastUsed: data.lastUsed?.toDate() } as DrinkLibraryItem); });
      setDrinkLibrary(loaded);
    } catch (e) { console.error(e); }
  };

  const handleLibraryDrinkSelect = (id: string) => {
    const d = drinkLibrary.find((x) => x.id === id);
    if (!d) return;
    setSelectedLibraryDrink(id);
    setType(d.category || 'Other');
    setAlcoholPercentage(d.abv);
    setUseDefaultABV(false);
    if (d.typicalServingSizeMl) { setUseOz(false); setAmountMl(d.typicalServingSizeMl); setAmountOz(d.typicalServingSizeMl / OZ_TO_ML); }
    else if (d.typicalServingSizeOz) { setUseOz(false); setAmountMl(d.typicalServingSizeOz * OZ_TO_ML); setAmountOz(d.typicalServingSizeOz); }
  };

  const loadSessions = async () => {
    if (!user) return;
    if (DEMO_MODE) { setSessions(DEMO_SESSIONS); return; }
    try {
      const snap = await getDocs(query(collection(db, 'sessions'), where('userId', '==', user.uid), orderBy('startTime', 'desc')));
      const loaded: Session[] = [];
      snap.forEach((d) => { const data = d.data(); loaded.push({ id: d.id, ...data, startTime: data.startTime.toDate(), endTime: data.endTime?.toDate(), createdAt: data.createdAt.toDate() } as Session); });
      setSessions(loaded.filter((s) => !s.endTime || differenceInMinutes(new Date(), s.endTime) < AUTO_SESSION_THRESHOLD_MINUTES).slice(0, 10));
    } catch (e) { console.error(e); }
  };

  const checkAutoSession = async () => {
    if (!user) return;
    if (DEMO_MODE) return;
    try {
      const snap = await getDocs(query(collection(db, 'entries'), where('userId', '==', user.uid), orderBy('date', 'desc')));
      let found = false;
      const entryTime = customTime ? logTime : new Date();
      snap.forEach((d) => {
        if (found) return;
        const data = d.data();
        const minutes = Math.abs(differenceInMinutes(entryTime, data.date.toDate()));
        if (minutes <= AUTO_SESSION_THRESHOLD_MINUTES && data.sessionId) {
          setSelectedSessionId(data.sessionId);
          found = true;
          setAutoSuggestSession(true);
        }
      });
      if (!found) setAutoSuggestSession(false);
    } catch (e) { console.error(e); }
  };

  const handleResetToDefaults = () => {
    const dt = DRINK_TYPES.find((d) => d.label === type);
    if (!dt) return;
    setUseOz(false); setAmountMl(dt.defaultAmountMl); setAmountOz(dt.defaultAmountOz);
    setAlcoholPercentage(dt.defaultPercentage); setUseDefaultABV(true);
    setCustomTime(false); setLogTime(new Date());
    setSelectedSessionId(''); setAutoSuggestSession(false); setNewSessionName(''); setSelectedLibraryDrink('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (DEMO_MODE) { alert('Demo mode: writes disabled.'); setSubmitting(false); navigate('/'); return; }
    try {
      const trimNotes = notes.trim();
      const date = customTime ? logTime : new Date();
      if (!user) { alert('Sign in first.'); return; }
      const entryData: any = { userId: user.uid, type, amount: amountMl, alcoholPercentage, date: Timestamp.fromDate(date) };
      if (trimNotes) entryData.notes = trimNotes;

      let entryId: string;
      if (selectedSessionId) {
        entryData.sessionId = selectedSessionId;
        const ref = await addDoc(collection(db, 'entries'), entryData);
        entryId = ref.id;
        const s = sessions.find((x) => x.id === selectedSessionId);
        if (s) await updateDoc(doc(db, 'sessions', selectedSessionId), { entryIds: [...s.entryIds, entryId], endTime: Timestamp.fromDate(date) });
      } else if (newSessionName.trim()) {
        const ref = await addDoc(collection(db, 'entries'), entryData);
        entryId = ref.id;
        const sRef = await addDoc(collection(db, 'sessions'), {
          userId: user.uid, name: newSessionName.trim(),
          startTime: Timestamp.fromDate(date), endTime: Timestamp.fromDate(date),
          entryIds: [entryId], createdAt: Timestamp.fromDate(new Date()),
        });
        await updateDoc(doc(db, 'entries', entryId), { sessionId: sRef.id });
      } else {
        await addDoc(collection(db, 'entries'), entryData);
      }
      if (selectedLibraryDrink) {
        try {
          const cur = drinkLibrary.find((x) => x.id === selectedLibraryDrink);
          await updateDoc(doc(db, 'drinkLibrary', selectedLibraryDrink), { timesUsed: (cur?.timesUsed || 0) + 1, lastUsed: Timestamp.fromDate(date) });
        } catch {}
      }
      navigate('/');
    } catch (e: any) { console.error(e); alert(`Failed: ${e?.message}`); } finally { setSubmitting(false); }
  };

  const alcoholMl = (amountMl * alcoholPercentage) / 100;
  const stdDrinks = alcoholMl / STANDARD_DRINK_ALCOHOL_ML;

  return (
    <div>
      <div className="sticky top-0 z-10 bg-bg2/85 backdrop-blur border-b border-separator px-6 lg:px-8 py-4 flex items-center justify-between rise">
        <div>
          <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">New</div>
          <h1 className="text-2xl font-bold text-ink tracking-[-0.02em]">Add drink</h1>
        </div>
        <Button onClick={() => navigate('/')} className="!bg-card2 !border-separator">Cancel</Button>
      </div>

      <PageBody className="!px-6 lg:!px-8 !py-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          <div className="space-y-5">
            {/* Library quick select */}
            {drinkLibrary.length > 0 && (
              <div className="bg-card rounded-3xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[var(--orange)22] text-orange"><IconGlass width={13} height={13} /></span>
                    <span className="text-md font-semibold text-ink">From library</span>
                  </div>
                  <Link to="/library" className="text-xs text-blue hover:brightness-110">Manage →</Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {drinkLibrary.slice(0, 8).map((d) => {
                    const c = DRINK_TYPES.find((dt) => dt.label === (d.category || 'Other'))?.color || '#8e8e93';
                    const selected = selectedLibraryDrink === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => d.id && handleLibraryDrinkSelect(d.id)}
                        className={cx('rounded-2xl p-3 text-left transition-all border',
                          selected ? 'bg-card2 border-transparent ring-2' : 'bg-card2 border-separator hover:border-separator2')}
                        style={selected ? { boxShadow: `inset 0 0 0 2px ${c}` } : undefined}
                      >
                        <div className="text-sm font-semibold text-ink truncate">{d.name}</div>
                        <div className="text-2xs text-ink3 font-mono tabular mt-0.5" style={{ color: c }}>{d.abv}% · {Math.round(d.typicalServingSizeMl || 0)} ml</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Drink type */}
            <div className="bg-card rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl" style={{ background: `${currentColor}22`, color: currentColor }}><IconGlass width={13} height={13} /></span>
                <span className="text-md font-semibold text-ink">Drink</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mb-5">
                {DRINK_TYPES.map((dt) => {
                  const active = dt.label === type;
                  return (
                    <button
                      key={dt.label}
                      type="button"
                      onClick={() => handleTypeChange(dt.label)}
                      className={cx('rounded-2xl p-2.5 text-center transition-colors border',
                        active ? 'text-white border-transparent' : 'bg-card2 text-ink2 border-separator hover:bg-bg3')}
                      style={active ? { background: dt.color } : undefined}
                    >
                      <div className="text-xs font-semibold">{dt.label}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-ink2">Volume</span>
                    <div className="inline-flex bg-card2 rounded-full p-0.5">
                      <button type="button" onClick={() => setUseOz(false)} className={cx('h-6 px-2.5 text-2xs font-semibold rounded-full transition-colors', !useOz ? 'bg-card text-ink' : 'text-ink3')}>ml</button>
                      <button type="button" onClick={() => setUseOz(true)}  className={cx('h-6 px-2.5 text-2xs font-semibold rounded-full transition-colors',  useOz ? 'bg-card text-ink' : 'text-ink3')}>oz</button>
                    </div>
                  </div>
                  <Input type="number" required min={0} step={useOz ? 0.1 : 1}
                    value={useOz ? Number(amountOz.toFixed(1)) : Math.round(amountMl)}
                    onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0, useOz)}
                    className="!bg-card2 !border-separator !h-12 !text-lg" />
                  <p className="mt-1.5 text-2xs text-ink3 font-mono tabular">
                    {useOz ? `${amountOz.toFixed(1)} oz = ${Math.round(amountMl)} ml` : `${Math.round(amountMl)} ml = ${amountOz.toFixed(1)} oz`}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-ink2">ABV (%)</span>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-2xs text-ink3">
                      <input type="checkbox" checked={useDefaultABV} onChange={handleUseDefaultABVToggle} className="rounded" />
                      <span>Default</span>
                    </label>
                  </div>
                  <Input type="number" required min={0} max={100} step={0.1}
                    value={alcoholPercentage}
                    onChange={(e) => { setAlcoholPercentage(parseFloat(e.target.value) || 0); setUseDefaultABV(false); }}
                    disabled={useDefaultABV}
                    className={cx('!bg-card2 !border-separator !h-12 !text-lg', useDefaultABV && '!opacity-60')} />
                </div>
              </div>

              <button type="button" onClick={handleResetToDefaults} className="mt-4 inline-flex items-center gap-1.5 text-xs text-ink3 hover:text-ink transition-colors">
                <IconRefresh width={12} height={12} /> Reset to {type} defaults
              </button>
            </div>

            {/* When */}
            <div className="bg-card rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[var(--cyan)22] text-cyan"><IconClock width={13} height={13} /></span>
                <span className="text-md font-semibold text-ink">When</span>
                <label className="ml-auto inline-flex items-center gap-2 cursor-pointer text-2xs text-ink3">
                  <input type="checkbox" checked={customTime} onChange={(e) => setCustomTime(e.target.checked)} className="rounded" />
                  <span>Custom time</span>
                </label>
              </div>
              {customTime ? (
                <Input type="datetime-local"
                  value={(() => {
                    const l = new Date(logTime.getTime() - logTime.getTimezoneOffset() * 60000);
                    return l.toISOString().slice(0, 16);
                  })()}
                  onChange={(e) => setLogTime(new Date(e.target.value))}
                  className="!bg-card2 !border-separator !h-12" />
              ) : (
                <div className="h-12 flex items-center px-4 rounded-2xl bg-card2 text-md text-ink font-mono tabular">
                  {format(new Date(), 'dd MMM, HH:mm')} · <span className="text-ink3 ml-1.5">now</span>
                </div>
              )}
            </div>

            {/* Session */}
            <div className="bg-card rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[var(--purple)22] text-purple"><IconClock width={13} height={13} /></span>
                <span className="text-md font-semibold text-ink">Session</span>
                <span className="text-2xs text-ink3 ml-auto">Optional</span>
              </div>
              {autoSuggestSession && selectedSessionId && (
                <div className="mb-3 px-3 py-2.5 rounded-2xl bg-[var(--purple)18] text-2xs text-purple">
                  Auto-suggested: matching a recent entry.
                </div>
              )}
              <Select value={selectedSessionId} onChange={(e) => { setSelectedSessionId(e.target.value); setNewSessionName(''); }}
                className="!bg-card2 !border-separator !h-12">
                <option value="">No session</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <div className="my-2 text-center text-2xs text-ink3 uppercase tracking-[0.08em] font-semibold">or</div>
              <Input type="text" value={newSessionName}
                onChange={(e) => { setNewSessionName(e.target.value); setSelectedSessionId(''); }}
                placeholder="Name a new session"
                className="!bg-card2 !border-separator !h-12" />
            </div>

            {/* Notes */}
            <div className="bg-card rounded-3xl p-5">
              <Field label="Notes (optional)">
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering" className="!bg-card2 !border-separator" />
              </Field>
            </div>
          </div>

          {/* Right: live summary */}
          <div className="space-y-4">
            <div className="rounded-3xl p-6" style={{ background: `linear-gradient(160deg, ${currentColor}22 0%, var(--card) 65%)` }}>
              <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3 mb-3">This entry</div>
              <div className="text-5xl font-bold tabular tracking-[-0.03em]" style={{ color: currentColor }}>
                {stdDrinks.toFixed(2)}
              </div>
              <div className="text-md text-ink3 font-medium mt-1">standard drinks</div>

              <div className="mt-5 pt-4 border-t border-separator space-y-2.5">
                <SummaryRow label="Type" value={type} />
                <SummaryRow label="Volume" value={`${Math.round(amountMl)} ml`} />
                <SummaryRow label="ABV" value={`${alcoholPercentage.toFixed(1)}%`} />
                <SummaryRow label="Pure alcohol" value={`${alcoholMl.toFixed(1)} ml`} strong color={currentColor} />
              </div>
            </div>

            <Button type="submit" variant="primary" disabled={submitting} className="w-full !h-12 !text-md bg-pink text-white border-pink hover:brightness-110">
              {submitting ? 'Saving…' : 'Save drink'}
            </Button>

            <div className="grid grid-cols-3 gap-2">
              <MiniStat icon={<IconChart width={12} height={12} />} label="Progress" value="→ Summary" to="/" />
              <MiniStat icon={<IconTarget width={12} height={12} />} label="Goals" value="→ Set" to="/goals" />
              <MiniStat icon={<IconGlass width={12} height={12} />} label="Library" value="→ Manage" to="/library" />
            </div>
          </div>
        </form>
      </PageBody>
    </div>
  );
}

function SummaryRow({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink3">{label}</span>
      <span className={cx('font-mono tabular', strong ? 'font-bold' : 'text-ink')} style={color && strong ? { color } : undefined}>{value}</span>
    </div>
  );
}

function MiniStat({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: string; to: string }) {
  return (
    <Link to={to} className="bg-card rounded-2xl p-3 hover:bg-card2 transition-colors block">
      <div className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">
        {icon} {label}
      </div>
      <div className="text-xs text-ink font-medium mt-1">{value}</div>
    </Link>
  );
}
