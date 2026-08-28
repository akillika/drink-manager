import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { collection, addDoc, Timestamp, query, where, getDocs, orderBy, updateDoc, doc } from 'firebase/firestore';
import { Session, DrinkLibraryItem } from '../types';
import { format, differenceInMinutes } from 'date-fns';
import {
  Page, PageHeader, Section, Card, Button, Field, Input, Select, Textarea, Badge,
  IconRefresh, IconArrowRight, cx,
} from '../components/ui';

const DRINK_TYPES = [
  { label: 'Beer',     defaultAmountOz: 12,  defaultAmountMl: 650, defaultPercentage: 5 },
  { label: 'Whisky',   defaultAmountOz: 1.5, defaultAmountMl: 30,  defaultPercentage: 40 },
  { label: 'Rum',      defaultAmountOz: 1.5, defaultAmountMl: 30,  defaultPercentage: 40 },
  { label: 'Vodka',    defaultAmountOz: 1.5, defaultAmountMl: 30,  defaultPercentage: 40 },
  { label: 'Cocktail', defaultAmountOz: 6,   defaultAmountMl: 150, defaultPercentage: 15 },
  { label: 'Other',    defaultAmountOz: 4,   defaultAmountMl: 100, defaultPercentage: 10 },
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

  const handleTypeChange = (newType: string) => {
    setType(newType);
    const drinkType = DRINK_TYPES.find((dt) => dt.label === newType);
    if (drinkType) {
      setUseOz(false);
      setAmountMl(drinkType.defaultAmountMl);
      setAmountOz(drinkType.defaultAmountOz);
      if (useDefaultABV) setAlcoholPercentage(drinkType.defaultPercentage);
    }
  };

  const handleUseDefaultABVToggle = () => {
    const newValue = !useDefaultABV;
    setUseDefaultABV(newValue);
    if (newValue) {
      const drinkType = DRINK_TYPES.find((dt) => dt.label === type);
      if (drinkType) setAlcoholPercentage(drinkType.defaultPercentage);
    }
  };

  const handleAmountChange = (value: number, isOz: boolean) => {
    if (isOz) { setAmountOz(value); setAmountMl(value * OZ_TO_ML); }
    else       { setAmountMl(value); setAmountOz(value / OZ_TO_ML); }
  };

  useEffect(() => {
    if (user) {
      loadSessions();
      loadDrinkLibrary();
      checkAutoSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logTime, customTime, user]);

  const loadDrinkLibrary = async () => {
    if (!user) return;
    try {
      const drinksQuery = query(
        collection(db, 'drinkLibrary'),
        where('userId', '==', user.uid),
        orderBy('timesUsed', 'desc')
      );
      const snapshot = await getDocs(drinksQuery);
      const loadedDrinks: DrinkLibraryItem[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        loadedDrinks.push({
          id: docSnapshot.id, ...data,
          createdAt: data.createdAt.toDate(),
          lastUsed: data.lastUsed?.toDate(),
        } as DrinkLibraryItem);
      });
      setDrinkLibrary(loadedDrinks);
    } catch (error) {
      console.error('Error loading drink library:', error);
    }
  };

  const handleLibraryDrinkSelect = (drinkId: string) => {
    const drink = drinkLibrary.find(d => d.id === drinkId);
    if (drink) {
      setSelectedLibraryDrink(drinkId);
      setType(drink.category || 'Other');
      setAlcoholPercentage(drink.abv);
      setUseDefaultABV(false);
      if (drink.typicalServingSizeMl) {
        setUseOz(false);
        setAmountMl(drink.typicalServingSizeMl);
        setAmountOz(drink.typicalServingSizeMl / OZ_TO_ML);
      } else if (drink.typicalServingSizeOz) {
        setUseOz(false);
        setAmountMl(drink.typicalServingSizeOz * OZ_TO_ML);
        setAmountOz(drink.typicalServingSizeOz);
      }
    }
  };

  const loadSessions = async () => {
    if (!user) return;
    try {
      const sessionsQuery = query(
        collection(db, 'sessions'),
        where('userId', '==', user.uid),
        orderBy('startTime', 'desc')
      );
      const snapshot = await getDocs(sessionsQuery);
      const loadedSessions: Session[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        loadedSessions.push({
          id: docSnapshot.id, ...data,
          startTime: data.startTime.toDate(),
          endTime: data.endTime?.toDate(),
          createdAt: data.createdAt.toDate(),
        } as Session);
      });
      const activeSessions = loadedSessions.filter(s => !s.endTime || differenceInMinutes(new Date(), s.endTime) < AUTO_SESSION_THRESHOLD_MINUTES);
      setSessions(activeSessions.slice(0, 10));
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const checkAutoSession = async () => {
    if (!user) return;
    try {
      const entryTime = customTime ? logTime : new Date();
      const recentQuery = query(
        collection(db, 'entries'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(recentQuery);
      let foundSession = false;
      snapshot.forEach((docSnapshot) => {
        if (foundSession) return;
        const data = docSnapshot.data();
        const entryDate = data.date.toDate();
        const minutesDiff = Math.abs(differenceInMinutes(entryTime, entryDate));
        if (minutesDiff <= AUTO_SESSION_THRESHOLD_MINUTES && data.sessionId) {
          setSelectedSessionId(data.sessionId);
          foundSession = true;
          setAutoSuggestSession(true);
        }
      });
      if (!foundSession) setAutoSuggestSession(false);
    } catch (error) {
      console.error('Error checking auto-session:', error);
    }
  };

  const handleResetToDefaults = () => {
    const drinkType = DRINK_TYPES.find((dt) => dt.label === type);
    if (drinkType) {
      setUseOz(false);
      setAmountMl(drinkType.defaultAmountMl);
      setAmountOz(drinkType.defaultAmountOz);
      setAlcoholPercentage(drinkType.defaultPercentage);
      setUseDefaultABV(true);
      setCustomTime(false);
      setLogTime(new Date());
      setSelectedSessionId('');
      setAutoSuggestSession(false);
      setNewSessionName('');
      setSelectedLibraryDrink('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const trimmedNotes = notes.trim();
      const dateToUse = customTime ? logTime : new Date();
      if (!user) { alert('You must be signed in to add an entry.'); return; }

      const entryData: any = {
        userId: user.uid,
        type,
        amount: amountMl,
        alcoholPercentage,
        date: Timestamp.fromDate(dateToUse),
      };
      if (trimmedNotes) entryData.notes = trimmedNotes;

      let entryId: string;
      if (selectedSessionId) {
        entryData.sessionId = selectedSessionId;
        const entryRef = await addDoc(collection(db, 'entries'), entryData);
        entryId = entryRef.id;
        const session = sessions.find(s => s.id === selectedSessionId);
        if (session) {
          await updateDoc(doc(db, 'sessions', selectedSessionId), {
            entryIds: [...session.entryIds, entryId],
            endTime: Timestamp.fromDate(dateToUse),
          });
        }
      } else if (newSessionName.trim()) {
        const entryRef = await addDoc(collection(db, 'entries'), entryData);
        entryId = entryRef.id;
        const sessionRef = await addDoc(collection(db, 'sessions'), {
          userId: user.uid,
          name: newSessionName.trim(),
          startTime: Timestamp.fromDate(dateToUse),
          endTime: Timestamp.fromDate(dateToUse),
          entryIds: [entryId],
          createdAt: Timestamp.fromDate(new Date()),
        });
        await updateDoc(doc(db, 'entries', entryId), { sessionId: sessionRef.id });
      } else {
        await addDoc(collection(db, 'entries'), entryData);
      }

      if (selectedLibraryDrink) {
        try {
          const currentDrink = drinkLibrary.find(d => d.id === selectedLibraryDrink);
          await updateDoc(doc(db, 'drinkLibrary', selectedLibraryDrink), {
            timesUsed: (currentDrink?.timesUsed || 0) + 1,
            lastUsed: Timestamp.fromDate(dateToUse),
          });
        } catch (error) {
          console.warn('Failed to update drink library usage:', error);
        }
      }

      const defaultDrink = DRINK_TYPES[0];
      setType(defaultDrink.label);
      setUseOz(false);
      setAmountMl(defaultDrink.defaultAmountMl);
      setAmountOz(defaultDrink.defaultAmountOz);
      setAlcoholPercentage(defaultDrink.defaultPercentage);
      setUseDefaultABV(true);
      setCustomTime(false);
      setLogTime(new Date());
      setNotes('');
      setSelectedSessionId('');
      setAutoSuggestSession(false);
      setNewSessionName('');
      setSelectedLibraryDrink('');
      await loadDrinkLibrary();
      navigate('/');
    } catch (error: any) {
      console.error('Error adding entry:', error);
      const errorMessage = error?.message || error?.code || 'Unknown error occurred';
      alert(`Failed to add entry: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const alcoholMl = (amountMl * alcoholPercentage) / 100;
  const stdDrinks = alcoholMl / STANDARD_DRINK_ALCOHOL_ML;

  return (
    <Page>
      <PageHeader
        eyebrow="Log"
        title="New entry"
        description="Pick a drink, set the amount, save. Under a second if you use a library preset."
      />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: form */}
        <Card>
          {drinkLibrary.length > 0 && (
            <Section title="From library" description="Quick-pick your saved drinks" className="mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {drinkLibrary.slice(0, 8).map((drink) => (
                  <button
                    key={drink.id}
                    type="button"
                    onClick={() => drink.id && handleLibraryDrinkSelect(drink.id)}
                    className={cx(
                      'h-9 px-2.5 rounded-md text-xs font-medium transition-colors border',
                      selectedLibraryDrink === drink.id
                        ? 'bg-ink text-paper border-ink'
                        : 'bg-paper2 text-ink border-rule hover:bg-paper3 hover:border-rule2',
                    )}
                    title={`${drink.abv}% ABV · ${drink.typicalServingSizeMl ? `${Math.round(drink.typicalServingSizeMl)} ml` : ''}`}
                  >
                    <span className="truncate block">{drink.name}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-2xs text-ink3">
                <Link to="/library" className="hover:text-ink inline-flex items-center gap-1">Manage library <IconArrowRight width={10} height={10} /></Link>
              </p>
            </Section>
          )}

          <Section title="Drink" className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={type} onChange={(e) => handleTypeChange(e.target.value)}>
                  {DRINK_TYPES.map((dt) => <option key={dt.label} value={dt.label}>{dt.label}</option>)}
                </Select>
              </Field>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-ink2">Volume</span>
                  <div className="inline-flex border border-rule rounded-md overflow-hidden">
                    <button type="button" onClick={() => setUseOz(false)}
                      className={cx('h-6 px-2 text-2xs font-medium transition-colors', !useOz ? 'bg-paper3 text-ink' : 'text-ink3 hover:text-ink')}>ml</button>
                    <button type="button" onClick={() => setUseOz(true)}
                      className={cx('h-6 px-2 text-2xs font-medium transition-colors border-l border-rule', useOz ? 'bg-paper3 text-ink' : 'text-ink3 hover:text-ink')}>oz</button>
                  </div>
                </div>
                <Input
                  type="number"
                  value={useOz ? Number(amountOz.toFixed(1)) : Math.round(amountMl)}
                  onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0, useOz)}
                  min={0}
                  step={useOz ? 0.1 : 1}
                  required
                  placeholder={useOz ? '12, 5, 1.5' : '650, 150, 30'}
                />
                <p className="mt-1.5 text-2xs text-ink3 font-mono tabular">
                  {useOz ? `${amountOz.toFixed(1)} oz = ${Math.round(amountMl)} ml` : `${Math.round(amountMl)} ml = ${amountOz.toFixed(1)} oz`}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-ink2">ABV (%)</span>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={useDefaultABV} onChange={handleUseDefaultABVToggle}
                    className="rounded border-rule2 text-ink focus:ring-0 focus:ring-offset-0" />
                  <span className="text-2xs text-ink3">Use category default</span>
                </label>
              </div>
              <Input
                type="number"
                value={alcoholPercentage}
                onChange={(e) => { setAlcoholPercentage(parseFloat(e.target.value) || 0); setUseDefaultABV(false); }}
                disabled={useDefaultABV}
                min={0} max={100} step={0.1} required
                className={cx(useDefaultABV && 'opacity-60 cursor-not-allowed')}
              />
            </div>

            <button
              type="button"
              onClick={handleResetToDefaults}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink3 hover:text-ink transition-colors"
            >
              <IconRefresh width={12} height={12} /> Reset to {type} defaults
            </button>
          </Section>

          <Section title="When" className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-ink3">Logged time</span>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={customTime} onChange={(e) => setCustomTime(e.target.checked)}
                  className="rounded border-rule2 text-ink focus:ring-0 focus:ring-offset-0" />
                <span className="text-2xs text-ink3">Custom time</span>
              </label>
            </div>
            {customTime ? (
              <Input
                type="datetime-local"
                value={(() => {
                  const localDate = new Date(logTime.getTime() - logTime.getTimezoneOffset() * 60000);
                  return localDate.toISOString().slice(0, 16);
                })()}
                onChange={(e) => setLogTime(new Date(e.target.value))}
              />
            ) : (
              <div className="h-10 flex items-center px-3 rounded-md border border-rule bg-paper text-sm text-ink2 font-mono tabular">
                {format(new Date(), 'dd/MM/yyyy HH:mm')} · now
              </div>
            )}
          </Section>

          <Section title="Session (optional)" description="Group with an existing session or start a new one" className="mb-6">
            {autoSuggestSession && selectedSessionId && (
              <div className="mb-3 px-3 py-2 rounded-md bg-paper3 border border-rule text-xs text-ink2">
                Auto-suggested: matching a recent entry within {AUTO_SESSION_THRESHOLD_MINUTES} minutes.
              </div>
            )}
            <Select
              value={selectedSessionId}
              onChange={(e) => { setSelectedSessionId(e.target.value); setNewSessionName(''); }}
            >
              <option value="">No session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} {session.endTime ? '(completed)' : '(active)'}
                </option>
              ))}
            </Select>
            <div className="my-2 text-2xs text-ink3 uppercase tracking-[0.06em]">or</div>
            <Input
              type="text"
              value={newSessionName}
              onChange={(e) => { setNewSessionName(e.target.value); setSelectedSessionId(''); }}
              placeholder="Name a new session"
            />
          </Section>

          <Section title="Notes (optional)" className="mb-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Anything worth remembering" />
          </Section>

          <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-rule">
            <Button type="button" onClick={() => navigate('/')}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save entry'}
            </Button>
          </div>
        </Card>

        {/* Right: live summary */}
        <div className="space-y-4">
          <Card>
            <h3 className="text-xs font-medium text-ink3 uppercase tracking-[0.06em] mb-4">This entry</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink3">Type</dt>
                <dd className="text-ink">{type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink3">Volume</dt>
                <dd className="text-ink font-mono tabular">{Math.round(amountMl)} ml</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink3">ABV</dt>
                <dd className="text-ink font-mono tabular">{alcoholPercentage.toFixed(1)}%</dd>
              </div>
              <div className="flex justify-between border-t border-rule pt-2 mt-2">
                <dt className="text-ink3">Pure alcohol</dt>
                <dd className="text-ink font-mono tabular">{alcoholMl.toFixed(1)} ml</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink3">Standard drinks</dt>
                <dd className="text-ink font-mono tabular">{stdDrinks.toFixed(2)}</dd>
              </div>
            </dl>
          </Card>

          {selectedLibraryDrink && (
            <div className="text-xs text-ink3 flex items-center gap-2 px-1">
              <Badge tone="accent">From library</Badge>
              <span>Form auto-filled from your presets.</span>
            </div>
          )}
        </div>
      </form>
    </Page>
  );
}
