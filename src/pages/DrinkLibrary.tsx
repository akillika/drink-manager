import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { DrinkLibraryItem } from '../types';
import { db } from '../config/firebase';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  where,
} from 'firebase/firestore';

const DRINK_CATEGORIES = ['Beer', 'Whisky', 'Rum', 'Vodka', 'Cocktail', 'Other'];
const OZ_TO_ML = 29.5735;

// Category defaults matching AddEntry.tsx
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
  
  // Form state
  const [name, setName] = useState('');
  const [abv, setAbv] = useState(5);
  const [useOz, setUseOz] = useState(false); // Default to ml (Indian standard)
  const [servingSizeOz, setServingSizeOz] = useState(12);
  const [servingSizeMl, setServingSizeMl] = useState(650); // Indian beer bottle size
  const [category, setCategory] = useState('Beer');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (user) {
      loadDrinks();
    }
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
          id: docSnapshot.id,
          ...data,
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
      setUseOz(false); // Always use ml (Indian standard)
      setServingSizeMl(defaults.servingSizeMl);
      setServingSizeOz(defaults.servingSizeMl / OZ_TO_ML);
    }
  };

  const handleServingSizeChange = (value: number, isOz: boolean) => {
    if (isOz) {
      setServingSizeOz(value);
      setServingSizeMl(value * OZ_TO_ML);
    } else {
      setServingSizeMl(value);
      setServingSizeOz(value / OZ_TO_ML);
    }
  };

  const handleSave = async () => {
    if (!user) {
      alert('You must be signed in to save a drink.');
      return;
    }
    if (!name.trim()) {
      alert('Please enter a drink name.');
      return;
    }

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
      
      // Only include lastUsed if it has a value (Firestore doesn't allow undefined)
      if (editingDrink?.lastUsed) {
        drinkData.lastUsed = Timestamp.fromDate(editingDrink.lastUsed);
      }

      if (useOz) {
        drinkData.typicalServingSizeOz = servingSizeOz;
        drinkData.typicalServingSizeMl = servingSizeMl;
      } else {
        drinkData.typicalServingSizeMl = servingSizeMl;
        drinkData.typicalServingSizeOz = servingSizeOz;
      }

      if (trimmedNotes) {
        drinkData.notes = trimmedNotes;
      }

      if (editingDrink?.id) {
        await updateDoc(doc(db, 'drinkLibrary', editingDrink.id), drinkData);
      } else {
        await addDoc(collection(db, 'drinkLibrary'), drinkData);
      }

      setShowModal(false);
      resetForm();
      await loadDrinks();
    } catch (error: any) {
      console.error('Error saving drink:', error);
      alert(`Failed to save drink: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleEdit = (drink: DrinkLibraryItem) => {
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
      setUseOz(false);
      setServingSizeMl(650);
      setServingSizeOz(650 / OZ_TO_ML);
    }
    
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this drink from your library?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'drinkLibrary', id));
      await loadDrinks();
    } catch (error) {
      console.error('Error deleting drink:', error);
      alert('Failed to delete drink. Please try again.');
    }
  };

  const resetForm = () => {
    setEditingDrink(null);
    setName('');
    setAbv(5);
    setUseOz(false);
    setServingSizeMl(650);
    setServingSizeOz(650 / OZ_TO_ML);
    setCategory('Beer');
    setNotes('');
  };

  const filteredAndSortedDrinks = () => {
    let filtered = drinks;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (drink) =>
          drink.name.toLowerCase().includes(query) ||
          drink.category?.toLowerCase().includes(query) ||
          drink.notes?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'frequency') {
      filtered.sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0));
    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => {
        const aDate = a.lastUsed?.getTime() || 0;
        const bDate = b.lastUsed?.getTime() || 0;
        return bDate - aDate;
      });
    }

    return filtered;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const displayDrinks = filteredAndSortedDrinks();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center animate-fade-in-down">
        <h2 className="text-3xl font-bold text-gray-900">📝 Drink Library</h2>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          + Add Drink
        </button>
      </div>

      {/* Search and Sort */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Drinks
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, category, or notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'frequency' | 'recent')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="frequency">Most Used</option>
              <option value="recent">Recently Used</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Drink List */}
      {displayDrinks.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center animate-fade-in-up card-hover">
          <p className="text-gray-500 mb-4">
            {searchQuery ? 'No drinks found matching your search.' : 'No drinks in your library yet.'}
          </p>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 button-bounce transition-all duration-200 hover:scale-105 active:scale-95"
          >
            Add Your First Drink
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayDrinks.map((drink, index) => (
            <div key={drink.id} className="bg-white rounded-lg shadow p-4 card-hover animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{drink.name}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(drink)}
                    className="text-indigo-600 hover:text-indigo-800 text-sm button-bounce transition-all duration-200 hover:scale-110 active:scale-95"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => drink.id && handleDelete(drink.id)}
                    className="text-red-600 hover:text-red-800 text-sm button-bounce transition-all duration-200 hover:scale-110 active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <div className="space-y-1 text-sm text-gray-600">
                <div>
                  <span className="font-medium">ABV:</span> {drink.abv}%
                </div>
                {drink.category && (
                  <div>
                    <span className="font-medium">Category:</span> {drink.category}
                  </div>
                )}
                    {(drink.typicalServingSizeMl || drink.typicalServingSizeOz) && (
                      <div>
                        <span className="font-medium">Typical Serving:</span>{' '}
                        {drink.typicalServingSizeMl ? `${drink.typicalServingSizeMl} ml` : `${drink.typicalServingSizeOz?.toFixed(1)} oz`}
                        {drink.typicalServingSizeOz && drink.typicalServingSizeMl && (
                          <span className="text-gray-500"> ({drink.typicalServingSizeOz.toFixed(1)} oz)</span>
                        )}
                      </div>
                    )}
                {drink.notes && (
                  <div className="text-gray-500 italic">{drink.notes}</div>
                )}
                <div className="text-xs text-gray-400 pt-2 border-t">
                  Used {drink.timesUsed || 0} time{drink.timesUsed !== 1 ? 's' : ''}
                  {drink.lastUsed && ` • Last: ${format(drink.lastUsed, 'dd/MM/yyyy')}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {editingDrink ? 'Edit Drink' : 'Add Drink to Library'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Drink Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Budweiser, Pinot Noir, Old Fashioned"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ABV (%) *
                  </label>
                  <input
                    type="number"
                    value={abv}
                    onChange={(e) => setAbv(parseFloat(e.target.value) || 0)}
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {DRINK_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Typical Serving Size
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUseOz(false)}
                      className={`px-3 py-1 text-sm rounded ${
                        !useOz
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      ml
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseOz(true)}
                      className={`px-3 py-1 text-sm rounded ${
                        useOz
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      oz
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  value={useOz ? servingSizeOz.toFixed(1) : Math.round(servingSizeMl)}
                  onChange={(e) => handleServingSizeChange(parseFloat(e.target.value) || 0, useOz)}
                  min="0"
                  step={useOz ? "0.1" : "1"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {useOz ? `${servingSizeOz.toFixed(1)} oz = ${Math.round(servingSizeMl)} ml` : `${Math.round(servingSizeMl)} ml = ${servingSizeOz.toFixed(1)} oz`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Add any notes about this drink..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleSave}
                  disabled={!name.trim()}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingDrink ? 'Update Drink' : 'Add Drink'}
                </button>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
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

