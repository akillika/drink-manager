import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { DrinkLibraryItem } from '../types';
import { db } from '../config/firebase';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, where } from 'firebase/firestore';
import { PageBody, Button, Field, Input, Select, Textarea, IconPlus, IconEdit, IconTrash, IconClose, IconSearch, IconBook, IconGlass, cx } from '../components/ui';
import { DEMO_MODE } from '../config/demo';
import { DEMO_LIBRARY } from '../config/demoData';

const DRINK_CATEGORIES = ['Beer', 'Whisky', 'Rum', 'Vodka', 'Cocktail', 'Wine', 'Other'];
const OZ_TO_ML = 29.5735;

const CATEGORY_DEFAULTS: Record<string, { abv: number; servingSizeMl: number }> = {
  Beer:     { abv: 5,  servingSizeMl: 650 },
  Whisky:   { abv: 40, servingSizeMl: 30 },
  Rum:      { abv: 40, servingSizeMl: 30 },
  Vodka:    { abv: 40, servingSizeMl: 30 },
  Cocktail: { abv: 15, servingSizeMl: 150 },
  Wine:     { abv: 12.5, servingSizeMl: 150 },
  Other:    { abv: 10, servingSizeMl: 100 },
};

const TYPE_COLOR: Record<string, string> = {
  Beer: '#FF9F0A', Whisky: '#AC8E68', Rum: '#BF5AF2', Vodka: '#64D2FF',
  Wine: '#FF375F', Cocktail: '#5E5CE6', Water: '#40C8E0', Other: '#8e8e93',
};
const typeColor = (t: string) => TYPE_COLOR[t] || '#8e8e93';

export default function DrinkLibrary() {
  const { user } = useAuth();
  const [drinks, setDrinks] = useState<DrinkLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'frequency' | 'recent'>('frequency');
  const [showModal, setShowModal] = useState(false);
  const [editingDrink, setEditingDrink] = useState<DrinkLibraryItem | null>(null);

  const [name, setName] = useState('');
  const [abv, setAbv] = useState(5);
  const [useOz, setUseOz] = useState(false);
  const [servingSizeOz, setServingSizeOz] = useState(12);
  const [servingSizeMl, setServingSizeMl] = useState(650);
  const [category, setCategory] = useState('Beer');
  const [notes, setNotes] = useState('');

  useEffect(() => { if (user) loadDrinks(); /* eslint-disable-line */ }, [user]);

  const loadDrinks = async () => {
    if (!user) return;
    if (DEMO_MODE) {
      setDrinks([...DEMO_LIBRARY].sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0)));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, 'drinkLibrary'), where('userId', '==', user.uid), orderBy('timesUsed', 'desc')));
      const loaded: DrinkLibraryItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        loaded.push({ id: d.id, ...data, createdAt: data.createdAt.toDate(), lastUsed: data.lastUsed?.toDate() } as DrinkLibraryItem);
      });
      setDrinks(loaded);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleCategoryChange = (v: string) => {
    setCategory(v);
    const d = CATEGORY_DEFAULTS[v];
    if (d) { setAbv(d.abv); setUseOz(false); setServingSizeMl(d.servingSizeMl); setServingSizeOz(d.servingSizeMl / OZ_TO_ML); }
  };

  const handleServingSizeChange = (v: number, isOz: boolean) => {
    if (isOz) { setServingSizeOz(v); setServingSizeMl(v * OZ_TO_ML); }
    else { setServingSizeMl(v); setServingSizeOz(v / OZ_TO_ML); }
  };

  const resetForm = () => { setEditingDrink(null); setName(''); setAbv(5); setUseOz(false); setServingSizeMl(650); setServingSizeOz(650 / OZ_TO_ML); setCategory('Beer'); setNotes(''); };
  const openCreate = () => { resetForm(); setShowModal(true); };
  const closeModal = () => { setShowModal(false); resetForm(); };

  const handleSave = async () => {
    if (!user || !name.trim()) { return alert('Name required.'); }
    if (DEMO_MODE) { alert('Demo mode: writes disabled.'); closeModal(); return; }
    try {
      const trimNotes = notes.trim();
      const data: any = {
        userId: user.uid, name: name.trim(), abv, category,
        timesUsed: editingDrink?.timesUsed || 0,
        createdAt: editingDrink?.createdAt ? Timestamp.fromDate(editingDrink.createdAt) : Timestamp.fromDate(new Date()),
        typicalServingSizeMl: servingSizeMl, typicalServingSizeOz: servingSizeOz,
      };
      if (editingDrink?.lastUsed) data.lastUsed = Timestamp.fromDate(editingDrink.lastUsed);
      if (trimNotes) data.notes = trimNotes;
      if (editingDrink?.id) await updateDoc(doc(db, 'drinkLibrary', editingDrink.id), data);
      else await addDoc(collection(db, 'drinkLibrary'), data);
      closeModal();
      await loadDrinks();
    } catch (e: any) { console.error(e); alert(`Save failed: ${e?.message}`); }
  };

  const openEdit = (d: DrinkLibraryItem) => {
    setEditingDrink(d); setName(d.name); setAbv(d.abv); setCategory(d.category || 'Beer'); setNotes(d.notes || '');
    if (d.typicalServingSizeMl) { setUseOz(false); setServingSizeMl(d.typicalServingSizeMl); setServingSizeOz(d.typicalServingSizeMl / OZ_TO_ML); }
    else if (d.typicalServingSizeOz) { setUseOz(true); setServingSizeOz(d.typicalServingSizeOz); setServingSizeMl(d.typicalServingSizeOz * OZ_TO_ML); }
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this drink?')) return;
    if (DEMO_MODE) { setDrinks(drinks.filter((d) => d.id !== id)); return; }
    try { await deleteDoc(doc(db, 'drinkLibrary', id)); await loadDrinks(); } catch { alert('Delete failed.'); }
  };

  const filtered = () => {
    let list = drinks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q) || d.category?.toLowerCase().includes(q) || d.notes?.toLowerCase().includes(q));
    }
    if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'frequency') list.sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0));
    else list.sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0));
    return list;
  };

  const display = filtered();

  return (
    <div>
      <div className="sticky top-12 md:top-0 z-10 bg-bg/95 md:bg-bg2/85 backdrop-blur border-b border-separator px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-3 rise">
        <div className="min-w-0">
          <div className="text-[10px] md:text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">Presets</div>
          <h1 className="text-lg md:text-2xl font-bold text-ink tracking-[-0.02em]">Library</h1>
        </div>
        <Button variant="primary" onClick={openCreate} size="sm">
          <IconPlus />
          <span className="hidden md:inline">Add drink</span>
          <span className="md:hidden">Add</span>
        </Button>
      </div>

      <PageBody className="!px-4 md:!px-8 !py-4 md:!py-6">
        <div className="bg-card rounded-3xl p-4 mb-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <div className="flex items-center h-11 rounded-2xl bg-card2 px-4 gap-3">
            <IconSearch className="text-ink3" width={15} height={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library"
              className="flex-1 outline-none bg-transparent text-sm text-ink placeholder:text-ink3"
            />
          </div>
          <div className="inline-flex bg-card2 rounded-2xl p-1">
            {(['frequency', 'recent', 'name'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSortBy(k)}
                className={cx('h-9 px-4 text-xs font-semibold rounded-xl transition-colors',
                  sortBy === k ? 'bg-card text-ink shadow-sm' : 'text-ink3 hover:text-ink')}
              >
                {k === 'frequency' ? 'Most used' : k === 'recent' ? 'Recent' : 'A–Z'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-sm text-ink3">Loading…</div>
        ) : display.length === 0 ? (
          <div className="bg-card rounded-3xl py-20 px-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--orange)22] text-orange mb-4">
              <IconBook width={22} height={22} />
            </div>
            <div className="text-lg font-semibold text-ink mb-1">
              {searchQuery ? 'No matches' : 'Library is empty'}
            </div>
            <div className="text-sm text-ink3 max-w-sm mx-auto mb-6">
              {searchQuery ? 'Try a shorter query.' : 'Save the drinks you log often. They pre-fill the entry form.'}
            </div>
            {!searchQuery && (
              <Button variant="primary" onClick={openCreate} className="bg-pink text-white border-pink hover:brightness-110">
                <IconPlus /> Add your first drink
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {display.map((drink) => {
              const c = typeColor(drink.category || 'Other');
              return (
                <div key={drink.id} className="bg-card rounded-3xl p-5 border border-separator hover:border-separator2 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl shrink-0" style={{ background: `${c}22`, color: c }}>
                        <IconGlass width={18} height={18} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-md font-bold text-ink truncate">{drink.name}</div>
                        {drink.category && (
                          <div className="inline-flex items-center h-5 px-2 mt-1 rounded-full text-2xs font-semibold uppercase tracking-[0.06em]" style={{ background: `${c}22`, color: c }}>
                            {drink.category}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => openEdit(drink)} title="Edit" className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-ink3 hover:text-ink hover:bg-card2 transition-colors"><IconEdit /></button>
                      <button onClick={() => drink.id && handleDelete(drink.id)} title="Delete" className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-ink3 hover:text-red hover:bg-[var(--red)18] transition-colors"><IconTrash /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-separator rounded-2xl overflow-hidden mb-3">
                    <div className="bg-card2 p-3">
                      <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">ABV</div>
                      <div className="text-md font-bold text-ink tabular mt-0.5">{drink.abv}%</div>
                    </div>
                    <div className="bg-card2 p-3">
                      <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">Serving</div>
                      <div className="text-md font-bold text-ink tabular mt-0.5">
                        {drink.typicalServingSizeMl ? `${Math.round(drink.typicalServingSizeMl)}` : '—'}
                        <span className="text-xs text-ink3 font-mono ml-1">ml</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-ink3">
                    <span className="font-mono tabular">
                      Used {drink.timesUsed || 0}× {drink.lastUsed && `· ${format(drink.lastUsed, 'dd MMM')}`}
                    </span>
                  </div>

                  {drink.notes && <div className="mt-3 pt-3 border-t border-separator text-xs text-ink2 italic">{drink.notes}</div>}
                </div>
              );
            })}
          </div>
        )}
      </PageBody>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-card rounded-t-3xl md:rounded-3xl shadow-popover w-full md:max-w-lg md:w-full max-h-[92vh] md:max-h-[90vh] overflow-hidden flex flex-col ink-in"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="md:hidden mx-auto mt-2 mb-1 w-10 h-1 rounded-full bg-separator2" />
            <div className="flex items-center justify-between p-5 border-b border-separator">
              <h3 className="text-lg font-bold text-ink">{editingDrink ? 'Edit drink' : 'Add to library'}</h3>
              <button onClick={closeModal} className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-ink3 hover:text-ink hover:bg-card2 transition-colors"><IconClose /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kingfisher Strong" className="!bg-card2 !border-separator" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ABV (%)">
                  <Input type="number" value={abv} onChange={(e) => setAbv(parseFloat(e.target.value) || 0)} min={0} max={100} step={0.1} className="!bg-card2 !border-separator" />
                </Field>
                <Field label="Category">
                  <Select value={category} onChange={(e) => handleCategoryChange(e.target.value)} className="!bg-card2 !border-separator">
                    {DRINK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-ink2">Typical serving size</span>
                  <div className="inline-flex bg-card2 rounded-full p-0.5">
                    <button type="button" onClick={() => setUseOz(false)} className={cx('h-6 px-2.5 text-2xs font-semibold rounded-full transition-colors', !useOz ? 'bg-card text-ink' : 'text-ink3')}>ml</button>
                    <button type="button" onClick={() => setUseOz(true)}  className={cx('h-6 px-2.5 text-2xs font-semibold rounded-full transition-colors',  useOz ? 'bg-card text-ink' : 'text-ink3')}>oz</button>
                  </div>
                </div>
                <Input type="number" value={useOz ? Number(servingSizeOz.toFixed(1)) : Math.round(servingSizeMl)}
                  onChange={(e) => handleServingSizeChange(parseFloat(e.target.value) || 0, useOz)}
                  min={0} step={useOz ? 0.1 : 1} className="!bg-card2 !border-separator" />
                <p className="mt-1 text-2xs text-ink3 font-mono tabular">
                  {useOz ? `${servingSizeOz.toFixed(1)} oz = ${Math.round(servingSizeMl)} ml` : `${Math.round(servingSizeMl)} ml = ${servingSizeOz.toFixed(1)} oz`}
                </p>
              </div>
              <Field label="Notes (optional)">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="!bg-card2 !border-separator" />
              </Field>
            </div>
            <div className="flex gap-2 justify-end p-5 border-t border-separator">
              <Button onClick={closeModal} className="!bg-card2 !border-separator">Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={!name.trim()} className="bg-pink text-white border-pink hover:brightness-110">
                {editingDrink ? 'Save' : 'Add drink'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
