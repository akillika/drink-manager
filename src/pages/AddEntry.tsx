import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { collection, addDoc, Timestamp, query, where, getDocs, orderBy, updateDoc, doc } from 'firebase/firestore';
import { AlcoholEntry, Session, DrinkLibraryItem } from '../types';
import { format, differenceInMinutes } from 'date-fns';

// Common drink presets with Indian standard serving sizes (ml)
const DRINK_TYPES = [
  { 
    label: 'Beer', 
    defaultAmountOz: 12, 
    defaultAmountMl: 650, // Standard Indian beer bottle (650ml)
    defaultPercentage: 5 
  },
  { 
    label: 'Whisky', 
    defaultAmountOz: 1.5, 
    defaultAmountMl: 30, // Standard Indian peg (30ml)
    defaultPercentage: 40 
  },
  { 
    label: 'Rum', 
    defaultAmountOz: 1.5, 
    defaultAmountMl: 30, // Standard Indian peg (30ml)
    defaultPercentage: 40 
  },
  { 
    label: 'Vodka', 
    defaultAmountOz: 1.5, 
    defaultAmountMl: 30, // Standard Indian peg (30ml)
    defaultPercentage: 40 
  },
  { 
    label: 'Cocktail', 
    defaultAmountOz: 6, 
    defaultAmountMl: 150, 
    defaultPercentage: 15 
  },
  { 
    label: 'Other', 
    defaultAmountOz: 4, 
    defaultAmountMl: 100, 
    defaultPercentage: 10 
  },
];

// Conversion: 1 oz = 29.5735 ml
const OZ_TO_ML = 29.5735;

const AUTO_SESSION_THRESHOLD_MINUTES = 120; // Suggest session if entry is within 2 hours

export default function AddEntry() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState('Beer');
  const [useOz, setUseOz] = useState(false); // Default to ml (Indian standard)
  const [amountOz, setAmountOz] = useState(12);
  const [amountMl, setAmountMl] = useState(650); // Indian beer bottle size
  const [useDefaultABV, setUseDefaultABV] = useState(true);
  const [alcoholPercentage, setAlcoholPercentage] = useState(5);
  const [customTime, setCustomTime] = useState(false);
  const [logTime, setLogTime] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Session-related state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [autoSuggestSession, setAutoSuggestSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  
  // Drink Library state
  const [drinkLibrary, setDrinkLibrary] = useState<DrinkLibraryItem[]>([]);
  const [selectedLibraryDrink, setSelectedLibraryDrink] = useState<string>('');
  const [showLibraryDropdown, setShowLibraryDropdown] = useState(false);

  const handleTypeChange = (newType: string) => {
    setType(newType);
    const drinkType = DRINK_TYPES.find((dt) => dt.label === newType);
    if (drinkType) {
      setUseOz(false); // Default to ml (Indian standard)
      setAmountMl(drinkType.defaultAmountMl);
      setAmountOz(drinkType.defaultAmountOz);
      if (useDefaultABV) {
        setAlcoholPercentage(drinkType.defaultPercentage);
      }
    }
  };

  const handleUseDefaultABVToggle = () => {
    const newValue = !useDefaultABV;
    setUseDefaultABV(newValue);
    if (newValue) {
      const drinkType = DRINK_TYPES.find((dt) => dt.label === type);
      if (drinkType) {
        setAlcoholPercentage(drinkType.defaultPercentage);
      }
    }
  };

  const handleAmountChange = (value: number, isOz: boolean) => {
    if (isOz) {
      setAmountOz(value);
      setAmountMl(value * OZ_TO_ML);
    } else {
      setAmountMl(value);
      setAmountOz(value / OZ_TO_ML);
    }
  };

  useEffect(() => {
    if (user) {
      loadSessions();
      loadDrinkLibrary();
      checkAutoSession();
    }
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
          id: docSnapshot.id,
          ...data,
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
      setUseDefaultABV(false); // Disable default ABV since we're using library value
      
      // Prefer ml (Indian standard)
      if (drink.typicalServingSizeMl) {
        setUseOz(false);
        setAmountMl(drink.typicalServingSizeMl);
        setAmountOz(drink.typicalServingSizeMl / OZ_TO_ML);
      } else if (drink.typicalServingSizeOz) {
        setUseOz(false); // Still use ml as default, convert from oz
        setAmountMl(drink.typicalServingSizeOz * OZ_TO_ML);
        setAmountOz(drink.typicalServingSizeOz);
      }
      
      setShowLibraryDropdown(false);
    }
  };

  const loadSessions = async () => {
    if (!user) return;
    try {
      // Load active sessions (sessions without endTime) and recent sessions
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
          id: docSnapshot.id,
          ...data,
          startTime: data.startTime.toDate(),
          endTime: data.endTime?.toDate(),
          createdAt: data.createdAt.toDate(),
        } as Session);
      });

      // Filter to show active sessions (no endTime) or recent sessions
      const activeSessions = loadedSessions.filter(s => !s.endTime || 
        differenceInMinutes(new Date(), s.endTime) < AUTO_SESSION_THRESHOLD_MINUTES
      );
      
      setSessions(activeSessions.slice(0, 10)); // Show top 10
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const checkAutoSession = async () => {
    if (!user) return;
    try {
      const entryTime = customTime ? logTime : new Date();

      // Get recent entries
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
      
      if (!foundSession) {
        setAutoSuggestSession(false);
      }
    } catch (error) {
      console.error('Error checking auto-session:', error);
    }
  };

  const handleResetToDefaults = () => {
    const drinkType = DRINK_TYPES.find((dt) => dt.label === type);
    if (drinkType) {
      setUseOz(false); // Default to ml (Indian standard)
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
      
      if (!user) {
        alert('You must be signed in to add an entry.');
        return;
      }

      const entryData: any = {
        userId: user.uid,
        type,
        amount: useOz ? amountMl : amountMl, // Always store in ml for consistency
        alcoholPercentage,
        date: Timestamp.fromDate(dateToUse),
      };

      // Only include notes if it has a value (Firestore doesn't allow undefined)
      if (trimmedNotes) {
        entryData.notes = trimmedNotes;
      }

      // Handle session assignment
      let entryId: string;
      if (selectedSessionId) {
        // Add to existing session
        entryData.sessionId = selectedSessionId;
        const entryRef = await addDoc(collection(db, 'entries'), entryData);
        entryId = entryRef.id;
        
        // Update session
        const session = sessions.find(s => s.id === selectedSessionId);
        if (session) {
          const sessionRef = doc(db, 'sessions', selectedSessionId);
          await updateDoc(sessionRef, {
            entryIds: [...session.entryIds, entryId],
            endTime: Timestamp.fromDate(dateToUse), // Update end time
          });
        }
      } else if (newSessionName.trim()) {
        // Create new session
        const sessionData = {
          userId: user.uid,
          name: newSessionName.trim(),
          startTime: Timestamp.fromDate(dateToUse),
          endTime: Timestamp.fromDate(dateToUse),
          entryIds: [],
          createdAt: Timestamp.fromDate(new Date()),
        };
        
        const entryRef = await addDoc(collection(db, 'entries'), entryData);
        entryId = entryRef.id;
        
        const sessionRef = await addDoc(collection(db, 'sessions'), {
          ...sessionData,
          entryIds: [entryId],
        });
        
        // Update entry with sessionId (use doc reference)
        await updateDoc(doc(db, 'entries', entryId), {
          sessionId: sessionRef.id,
        });
      } else {
        // No session
        await addDoc(collection(db, 'entries'), entryData);
      }

      // Update drink library usage if selected from library
      if (selectedLibraryDrink) {
        try {
          const drinkDoc = doc(db, 'drinkLibrary', selectedLibraryDrink);
          const currentDrink = drinkLibrary.find(d => d.id === selectedLibraryDrink);
          await updateDoc(drinkDoc, {
            timesUsed: (currentDrink?.timesUsed || 0) + 1,
            lastUsed: Timestamp.fromDate(dateToUse),
          });
        } catch (error) {
          console.warn('Failed to update drink library usage:', error);
        }
      }

      // Reset form to defaults
      const defaultDrink = DRINK_TYPES[0];
      setType(defaultDrink.label);
      setUseOz(false); // Default to ml (Indian standard)
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
      
      // Reload drink library to update usage counts
      await loadDrinkLibrary();
      
      // Navigate to dashboard
      navigate('/');
    } catch (error: any) {
      console.error('Error adding entry:', error);
      const errorMessage = error?.message || error?.code || 'Unknown error occurred';
      const errorCode = error?.code || 'unknown';
      
      console.error('Full error details:', {
        code: error?.code,
        message: error?.message,
        stack: error?.stack
      });
      
      let userMessage = `Failed to add entry: ${errorMessage}`;
      
      if (errorCode === 'permission-denied') {
        userMessage += '\n\n⚠️ Firestore security rules are blocking writes.\n\nTo fix:\n1. Go to Firebase Console → Firestore Database → Rules\n2. Update rules to allow writes (for development):\n\nrules_version = \'2\';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}\n\n⚠️ WARNING: These rules allow anyone to read/write. Only use for development!';
      }
      
      alert(userMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-900 mb-6 animate-fade-in-down">🍹 Quick Log Entry</h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6 animate-fade-in-up card-hover">
        {/* Drink Library Quick Select */}
        {drinkLibrary.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                📝 Quick Select from Library
              </label>
              <Link
                to="/library"
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Manage Library →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {drinkLibrary.slice(0, 8).map((drink, index) => (
                    <button
                      key={drink.id}
                      type="button"
                      onClick={() => drink.id && handleLibraryDrinkSelect(drink.id)}
                      className={`px-3 py-2 text-sm rounded-md border transition-all duration-200 button-bounce animate-stagger-1 ${
                    selectedLibraryDrink === drink.id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {drink.name}
                  {(drink.timesUsed ?? 0) > 0 && (
                    <span className="ml-1 text-xs opacity-75">
                      ({drink.timesUsed})
                    </span>
                  )}
                </button>
              ))}
            </div>
            {selectedLibraryDrink && (
              <p className="mt-2 text-xs text-indigo-600">
                ✓ Selected from library - form auto-filled
              </p>
            )}
          </div>
        )}

        {/* Drink Type */}
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
            Type of Drink
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 focus:scale-[1.02]"
          >
            {DRINK_TYPES.map((dt) => (
              <option key={dt.label} value={dt.label}>
                {dt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
          >
            ↺ Reset to defaults for {type}
          </button>
        </div>

        {/* Volume with unit toggle */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Volume
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
            id="amount"
            value={useOz ? amountOz.toFixed(1) : Math.round(amountMl)}
            onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0, useOz)}
            min="0"
            step={useOz ? "0.1" : "1"}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 focus:scale-[1.02]"
            placeholder={useOz ? "e.g., 12, 5, 1.5" : "e.g., 650, 150, 30"}
          />
          <p className="mt-1 text-xs text-gray-500">
            {useOz ? `${amountOz.toFixed(1)} oz = ${Math.round(amountMl)} ml` : `${Math.round(amountMl)} ml = ${amountOz.toFixed(1)} oz`}
          </p>
        </div>

        {/* ABV with toggle */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="alcoholPercentage" className="block text-sm font-medium text-gray-700">
              ABV (Alcohol by Volume) %
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useDefaultABV}
                onChange={handleUseDefaultABVToggle}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-600">Use default</span>
            </label>
          </div>
          <input
            type="number"
            id="alcoholPercentage"
            value={alcoholPercentage}
            onChange={(e) => {
              setAlcoholPercentage(parseFloat(e.target.value) || 0);
              setUseDefaultABV(false);
            }}
            disabled={useDefaultABV}
            min="0"
            max="100"
            step="0.1"
            required
            className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
              useDefaultABV ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
          />
        </div>

        {/* Time Logged */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="time" className="block text-sm font-medium text-gray-700">
              Time Logged
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={customTime}
                onChange={(e) => setCustomTime(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-600">Custom time</span>
            </label>
          </div>
          {customTime ? (
            <input
              type="datetime-local"
              id="time"
              value={(() => {
                const localDate = new Date(logTime.getTime() - logTime.getTimezoneOffset() * 60000);
                return localDate.toISOString().slice(0, 16);
              })()}
              onChange={(e) => setLogTime(new Date(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 focus:scale-[1.02]"
            />
          ) : (
            <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
              {format(new Date(), 'dd/MM/yyyy HH:mm')} (current time)
            </div>
          )}
        </div>

        {/* Session Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Session / Event (optional)
          </label>
          
          {autoSuggestSession && selectedSessionId && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              💡 Auto-suggested: Recent entry found in same session
            </div>
          )}

          <select
            value={selectedSessionId}
            onChange={(e) => {
              setSelectedSessionId(e.target.value);
              setNewSessionName(''); // Clear new session name when selecting existing
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 mb-2"
          >
            <option value="">No session (standalone entry)</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name} {session.endTime ? '(Completed)' : '(Active)'}
              </option>
            ))}
          </select>

          <div className="text-sm text-gray-600 mb-2">or</div>

          <input
            type="text"
            value={newSessionName}
            onChange={(e) => {
              setNewSessionName(e.target.value);
              setSelectedSessionId(''); // Clear selected session when typing new name
            }}
            placeholder="Create new session (e.g., Friday Night Dinner, Watching the Game)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 focus:scale-[1.02]"
          />
          
          <p className="mt-1 text-xs text-gray-500">
            Group entries into sessions to track consumption patterns by event or activity.
          </p>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 focus:scale-[1.02]"
            placeholder="Add any notes about this entry..."
          />
        </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed button-bounce transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                  </span>
                ) : 'Add Entry'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 button-bounce transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
            </div>
      </form>
    </div>
  );
}

