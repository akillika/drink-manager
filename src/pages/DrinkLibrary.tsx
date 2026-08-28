import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { DrinkLibraryItem } from '../types';
import { db } from '../config/firebase';
import {
  collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, where,
} from 'firebase/firestore';
import {
  Page, PageHeader, PageBody, Card, Empty, Button, Field, Input, Select, Textarea, Badge,
  IconPlus, IconEdit, IconTrash, IconClose, IconSearch, cx,
} from '../components/ui';

const DRINK_CATEGORIES = ['Beer', 'Whisky', 'Rum', 'Vodka', 'Cocktail', 'Other'];
const OZ_TO_ML = 29.5735;

const CATEGORY_DEFAULTS: Record<string, { abv: number; servingSizeMl: number }> = {
  'Beer': { abv: 5, servingSizeMl: 650 },
  'Whisky': { abv: 40, servingSizeMl: 30 },
  'Rum': { abv: 40, servingSizeMl: 30 },
  'Vodka': { abv: 40, servingSizeMl: 30 },
  'Cocktail': { abv: 15, servingSizeMl: 150 },
  'Other': { abv: 10, servingSizeMl: 100 },
};

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

  useEffect(() => {
    if (user) loadDrinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadDrinks = async () => {
    if (!user) return;
    try {
      setLoading(true);
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
      setDrinks(loadedDrinks);
    } catch (error) {
      console.error('Error loading drinks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    const defaults = CATEGORY_DEFAULTS[newCategory];
    if (defaults) {
      setAbv(defaults.abv);
      setUseOz(false);
      setServingSizeMl(defaults.servingSizeMl);
      setServingSizeOz(defaults.servingSizeMl / OZ_TO_ML);
    }
  };

  const handleServingSizeChange = (value: number, isOz: boolean) => {
    if (isOz) { setServingSizeOz(value); setServingSizeMl(value * OZ_TO_ML); }
    else       { setServingSizeMl(value); setServingSizeOz(value / OZ_TO_ML); }
  };

  const resetForm = () => {
    setEditingDrink(null); setName(''); setAbv(5); setUseOz(false);
    setServingSizeMl(650); setServingSizeOz(650 / OZ_TO_ML);
    setCategory('Beer'); setNotes('');
  };

  const openCreate = () => { resetForm(); setShowModal(true); };
  const closeModal = () => { setShowModal(false); resetForm(); };

  const handleSave = async () => {
    if (!user) return alert('You must be signed in to save a drink.');
    if (!name.trim()) return alert('Please enter a drink name.');
    try {
      const trimmedNotes = notes.trim();
      const drinkData: any = {
        userId: user.uid,
        name: name.trim(),
        abv,
        category,
        timesUsed: editingDrink?.timesUsed || 0,
        createdAt: editingDrink?.createdAt ? Timestamp.fromDate(editingDrink.createdAt) : Timestamp.fromDate(new Date()),
      };
      if (editingDrink?.lastUsed) drinkData.lastUsed = Timestamp.fromDate(editingDrink.lastUsed);
      drinkData.typicalServingSizeMl = servingSizeMl;
      drinkData.typicalServingSizeOz = servingSizeOz;
      if (trimmedNotes) drinkData.notes = trimmedNotes;

      if (editingDrink?.id) {
        await updateDoc(doc(db, 'drinkLibrary', editingDrink.id), drinkData);
      } else {
        await addDoc(collection(db, 'drinkLibrary'), drinkData);
      }
      closeModal();
      await loadDrinks();
    } catch (error: any) {
      console.error('Error saving drink:', error);
      alert(`Failed to save drink: ${error?.message || 'Unknown error'}`);
    }
  };

  const openEdit = (drink: DrinkLibraryItem) => {
    setEditingDrink(drink);
    setName(drink.name);
    setAbv(drink.abv);
    setCategory(drink.category || 'Beer');
    setNotes(drink.notes || '');
    if (drink.typicalServingSizeOz) {
      setUseOz(true);
      setServingSizeOz(drink.typicalServingSizeOz);
      setServingSizeMl(drink.typicalServingSizeOz * OZ_TO_ML);
    } else if (drink.typicalServingSizeMl) {
      setUseOz(false);
      setServingSizeMl(drink.typicalServingSizeMl);
      setServingSizeOz(drink.typicalServingSizeMl / OZ_TO_ML);
    } else {
      setUseOz(false); setServingSizeMl(650); setServingSizeOz(650 / OZ_TO_ML);
    }
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this drink from your library?')) return;
    try {
      await deleteDoc(doc(db, 'drinkLibrary', id));
      await loadDrinks();
    } catch (error) {
      console.error('Error deleting drink:', error);
      alert('Failed to delete drink. Please try again.');
    }
  };

  const filteredAndSortedDrinks = () => {
    let filtered = drinks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((d) => d.name.toLowerCase().includes(q) || d.category?.toLowerCase().includes(q) || d.notes?.toLowerCase().includes(q));
    }
    if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'frequency') filtered.sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0));
    else if (sortBy === 'recent') filtered.sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0));
    return filtered;
  };

  if (loading) {
    return (
      <Page>
        <PageHeader eyebrow="Presets" title="Library" />
        <PageBody>
          <div className="flex items-center justify-center py-24 text-sm text-ink3">Loading…</div>
        </PageBody>
      </Page>
    );
  }

  const displayDrinks = filteredAndSortedDrinks();

  return (
    <Page>
      <PageHeader
        eyebrow="Presets"
        title="Library"
        description="Save the drinks you log often. They'll pre-fill the entry form."
        actions={<Button variant="primary" onClick={openCreate}><IconPlus /> Add drink</Button>}
      />

      <PageBody>
      <Card padded={false} className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 p-4">
          <div className="flex items-center h-10 rounded-md bg-paper border border-rule px-3 gap-2">
            <IconSearch className="text-ink3" width={14} height={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, category, or notes"
              className="flex-1 outline-none bg-transparent text-sm text-ink placeholder:text-ink3"
            />
          </div>
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="frequency">Most used</option>
            <option value="recent">Recently used</option>
            <option value="name">Name (A–Z)</option>
          </Select>
        </div>
      </Card>

      {displayDrinks.length === 0 ? (
        <Empty
          title={searchQuery ? 'No drinks match your search' : 'Library is empty'}
          description={searchQuery ? 'Try a different query.' : 'Save the drinks you log most often. They\'ll show up here.'}
          action={!searchQuery && <Button variant="primary" onClick={openCreate}><IconPlus /> Add your first drink</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayDrinks.map((drink) => (
            <Card key={drink.id} className="rise">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="text-md font-medium text-ink truncate">{drink.name}</h3>
                  {drink.category && <div className="mt-1"><Badge>{drink.category}</Badge></div>}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button className="p-1.5 rounded-md text-ink3 hover:text-ink hover:bg-paper3 transition-colors" onClick={() => openEdit(drink)} title="Edit"><IconEdit /></button>
                  <button className="p-1.5 rounded-md text-ink3 hover:text-danger hover:bg-paper3 transition-colors" onClick={() => drink.id && handleDelete(drink.id)} title="Delete"><IconTrash /></button>
                </div>
              </div>

              <div className="border-t border-rule pt-3 grid gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink3">ABV</span>
                  <span className="text-ink font-mono tabular">{drink.abv}%</span>
                </div>
                {(drink.typicalServingSizeMl || drink.typicalServingSizeOz) && (
                  <div className="flex justify-between">
                    <span className="text-ink3">Typical serving</span>
                    <span className="text-ink font-mono tabular">
                      {drink.typicalServingSizeMl ? `${Math.round(drink.typicalServingSizeMl)} ml` : `${drink.typicalServingSizeOz?.toFixed(1)} oz`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-ink3">Used</span>
                  <span className="text-ink font-mono tabular">
                    {drink.timesUsed || 0} {drink.timesUsed === 1 ? 'time' : 'times'}
                    {drink.lastUsed && <span className="text-ink3"> · {format(drink.lastUsed, 'dd/MM/yy')}</span>}
                  </span>
                </div>
              </div>

              {drink.notes && <div className="mt-3 text-xs text-ink3 italic border-t border-rule pt-3">{drink.notes}</div>}
            </Card>
          ))}
        </div>
      )}
      </PageBody>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40" onClick={closeModal} />
          <div className="relative bg-paper2 border border-rule2 rounded-lg shadow-popover max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col rise">
            <div className="flex items-center justify-between p-5 border-b border-rule">
              <h3 className="text-md font-medium text-ink">{editingDrink ? 'Edit drink' : 'Add drink to library'}</h3>
              <button className="p-1.5 rounded-md text-ink3 hover:text-ink hover:bg-paper3 transition-colors" onClick={closeModal} title="Close"><IconClose /></button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <Field label="Name">
                <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Budweiser, Pinot Noir, Old Fashioned" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="ABV (%)">
                  <Input type="number" value={abv} onChange={(e) => setAbv(parseFloat(e.target.value) || 0)} min={0} max={100} step={0.1} />
                </Field>
                <Field label="Category">
                  <Select value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
                    {DRINK_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </Select>
                </Field>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-ink2">Typical serving size</span>
                  <div className="inline-flex border border-rule rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setUseOz(false)}
                      className={cx('h-6 px-2 text-2xs font-medium transition-colors', !useOz ? 'bg-paper3 text-ink' : 'text-ink3 hover:text-ink')}
                    >
                      ml
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseOz(true)}
                      className={cx('h-6 px-2 text-2xs font-medium transition-colors border-l border-rule', useOz ? 'bg-paper3 text-ink' : 'text-ink3 hover:text-ink')}
                    >
                      oz
                    </button>
                  </div>
                </div>
                <Input
                  type="number"
                  value={useOz ? Number(servingSizeOz.toFixed(1)) : Math.round(servingSizeMl)}
                  onChange={(e) => handleServingSizeChange(parseFloat(e.target.value) || 0, useOz)}
                  min={0}
                  step={useOz ? 0.1 : 1}
                />
                <p className="mt-1.5 text-2xs text-ink3 font-mono tabular">
                  {useOz ? `${servingSizeOz.toFixed(1)} oz = ${Math.round(servingSizeMl)} ml` : `${Math.round(servingSizeMl)} ml = ${servingSizeOz.toFixed(1)} oz`}
                </p>
              </div>

              <Field label="Notes (optional)">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes about this drink" />
              </Field>
            </div>

            <div className="flex gap-2 justify-end p-5 border-t border-rule">
              <Button onClick={closeModal}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>
                {editingDrink ? 'Save changes' : 'Add drink'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
