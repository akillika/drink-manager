import { AlcoholEntry, Session, DrinkLibraryItem, Goal } from '../types';

/** Realistic sample data for demo mode. Regenerated on every load. */

const DEMO_UID = 'demo-user';

// --- helpers --------------------------------------------------------
function dayOffset(days: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}
let idCounter = 1;
const nextId = () => `demo-${idCounter++}`;

// Sessions (created inline so we can attach entries to them)
const s1: Session = {
  id: 'session-friday',
  userId: DEMO_UID,
  name: 'Friday night, Radio Bar',
  description: 'Drinks with the team after shipping the release.',
  startTime: dayOffset(3, 20, 15),
  endTime: dayOffset(3, 23, 45),
  entryIds: ['e-friday-1', 'e-friday-2', 'e-friday-3', 'e-friday-4'],
  createdAt: dayOffset(3, 20, 10),
};
const s2: Session = {
  id: 'session-dinner',
  userId: DEMO_UID,
  name: 'Dinner at Perch',
  description: 'Anniversary. Split a bottle of pinot.',
  startTime: dayOffset(9, 19, 30),
  endTime: dayOffset(9, 22, 10),
  entryIds: ['e-dinner-1', 'e-dinner-2', 'e-dinner-3'],
  createdAt: dayOffset(9, 19, 20),
};
const s3: Session = {
  id: 'session-sat',
  userId: DEMO_UID,
  name: 'Saturday, home',
  startTime: dayOffset(12, 21, 0),
  endTime: dayOffset(12, 23, 15),
  entryIds: ['e-sat-1', 'e-sat-2'],
  createdAt: dayOffset(12, 21, 0),
};

export const DEMO_SESSIONS: Session[] = [s1, s2, s3];

// --- entries --------------------------------------------------------
export const DEMO_ENTRIES: AlcoholEntry[] = [
  // Today (light day)
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 330, alcoholPercentage: 5,    date: dayOffset(0, 18, 45), notes: 'With dinner' },

  // Yesterday - nothing (deliberate rest day)

  // Wednesday
  { id: nextId(), userId: DEMO_UID, type: 'Whisky',   amount: 30,  alcoholPercentage: 43,   date: dayOffset(2, 22, 15), notes: 'One dram before bed' },

  // Friday night session - 4 entries in one evening
  { id: 'e-friday-1', userId: DEMO_UID, type: 'Beer',     amount: 440, alcoholPercentage: 4.8,  date: dayOffset(3, 20, 20), sessionId: s1.id },
  { id: 'e-friday-2', userId: DEMO_UID, type: 'Cocktail', amount: 150, alcoholPercentage: 15,   date: dayOffset(3, 21, 10), sessionId: s1.id, notes: 'Old Fashioned' },
  { id: 'e-friday-3', userId: DEMO_UID, type: 'Whisky',   amount: 60,  alcoholPercentage: 40,   date: dayOffset(3, 22, 30), sessionId: s1.id },
  { id: 'e-friday-4', userId: DEMO_UID, type: 'Beer',     amount: 440, alcoholPercentage: 4.8,  date: dayOffset(3, 23, 25), sessionId: s1.id, notes: 'One more before leaving' },

  // Sunday
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 650, alcoholPercentage: 5,    date: dayOffset(5, 19, 30), notes: 'Watching the match' },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 330, alcoholPercentage: 5,    date: dayOffset(5, 21, 15) },

  // Monday (light)
  { id: nextId(), userId: DEMO_UID, type: 'Wine',     amount: 150, alcoholPercentage: 12.5, date: dayOffset(6, 20, 30), notes: 'Pinot Noir' },

  // Wednesday
  { id: nextId(), userId: DEMO_UID, type: 'Whisky',   amount: 30,  alcoholPercentage: 43,   date: dayOffset(7, 22, 45) },

  // Anniversary dinner session
  { id: 'e-dinner-1', userId: DEMO_UID, type: 'Cocktail', amount: 130, alcoholPercentage: 18,   date: dayOffset(9, 19, 45), sessionId: s2.id, notes: 'Aperitif' },
  { id: 'e-dinner-2', userId: DEMO_UID, type: 'Wine',     amount: 200, alcoholPercentage: 13,   date: dayOffset(9, 20, 40), sessionId: s2.id, notes: 'Shared bottle of pinot' },
  { id: 'e-dinner-3', userId: DEMO_UID, type: 'Wine',     amount: 200, alcoholPercentage: 13,   date: dayOffset(9, 21, 50), sessionId: s2.id },

  // Friday of previous week
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 650, alcoholPercentage: 5,    date: dayOffset(10, 21, 0) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 440, alcoholPercentage: 4.8,  date: dayOffset(10, 22, 30) },

  // Saturday session
  { id: 'e-sat-1', userId: DEMO_UID, type: 'Rum',      amount: 60,  alcoholPercentage: 40,   date: dayOffset(12, 21, 10), sessionId: s3.id, notes: 'Old Monk' },
  { id: 'e-sat-2', userId: DEMO_UID, type: 'Rum',      amount: 30,  alcoholPercentage: 40,   date: dayOffset(12, 22, 45), sessionId: s3.id },

  // Random spread through the month
  { id: nextId(), userId: DEMO_UID, type: 'Beer',   amount: 440, alcoholPercentage: 5,    date: dayOffset(14, 20, 30) },
  { id: nextId(), userId: DEMO_UID, type: 'Wine',   amount: 150, alcoholPercentage: 12.5, date: dayOffset(15, 20, 0) },
  { id: nextId(), userId: DEMO_UID, type: 'Whisky', amount: 60,  alcoholPercentage: 43,   date: dayOffset(16, 22, 15) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',   amount: 650, alcoholPercentage: 5,    date: dayOffset(17, 21, 30) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',   amount: 330, alcoholPercentage: 4.5,  date: dayOffset(17, 22, 45) },
  { id: nextId(), userId: DEMO_UID, type: 'Cocktail', amount: 180, alcoholPercentage: 14, date: dayOffset(18, 20, 20), notes: 'Negroni' },
  { id: nextId(), userId: DEMO_UID, type: 'Whisky', amount: 30,  alcoholPercentage: 43,   date: dayOffset(19, 22, 45) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',   amount: 440, alcoholPercentage: 5,    date: dayOffset(21, 20, 45) },
  { id: nextId(), userId: DEMO_UID, type: 'Wine',   amount: 150, alcoholPercentage: 13,   date: dayOffset(22, 21, 30) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',   amount: 650, alcoholPercentage: 5,    date: dayOffset(24, 20, 0) },
  { id: nextId(), userId: DEMO_UID, type: 'Rum',    amount: 60,  alcoholPercentage: 40,   date: dayOffset(25, 22, 15) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',   amount: 330, alcoholPercentage: 5,    date: dayOffset(28, 20, 30) },
  { id: nextId(), userId: DEMO_UID, type: 'Whisky', amount: 60,  alcoholPercentage: 40,   date: dayOffset(30, 21, 45) },

  // Older history (spread through 5 previous months) so the 6-month trend has shape
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 650, alcoholPercentage: 5,    date: dayOffset(45, 20, 30) },
  { id: nextId(), userId: DEMO_UID, type: 'Whisky',   amount: 60,  alcoholPercentage: 40,   date: dayOffset(48, 22, 15) },
  { id: nextId(), userId: DEMO_UID, type: 'Wine',     amount: 200, alcoholPercentage: 13,   date: dayOffset(52, 20, 45) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 440, alcoholPercentage: 5,    date: dayOffset(60, 20, 15) },
  { id: nextId(), userId: DEMO_UID, type: 'Cocktail', amount: 150, alcoholPercentage: 15,   date: dayOffset(64, 21, 30) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 650, alcoholPercentage: 5,    date: dayOffset(72, 21, 0) },
  { id: nextId(), userId: DEMO_UID, type: 'Rum',      amount: 60,  alcoholPercentage: 40,   date: dayOffset(78, 22, 30) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 440, alcoholPercentage: 5,    date: dayOffset(85, 20, 0) },
  { id: nextId(), userId: DEMO_UID, type: 'Wine',     amount: 150, alcoholPercentage: 12.5, date: dayOffset(95, 20, 30) },
  { id: nextId(), userId: DEMO_UID, type: 'Whisky',   amount: 30,  alcoholPercentage: 40,   date: dayOffset(102, 22, 45) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 650, alcoholPercentage: 5,    date: dayOffset(112, 20, 15) },
  { id: nextId(), userId: DEMO_UID, type: 'Cocktail', amount: 160, alcoholPercentage: 14,   date: dayOffset(120, 21, 30) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 440, alcoholPercentage: 5,    date: dayOffset(135, 20, 0) },
  { id: nextId(), userId: DEMO_UID, type: 'Wine',     amount: 200, alcoholPercentage: 13,   date: dayOffset(148, 21, 0) },
  { id: nextId(), userId: DEMO_UID, type: 'Whisky',   amount: 60,  alcoholPercentage: 43,   date: dayOffset(155, 22, 30) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 650, alcoholPercentage: 5,    date: dayOffset(165, 20, 15) },
  { id: nextId(), userId: DEMO_UID, type: 'Beer',     amount: 330, alcoholPercentage: 5,    date: dayOffset(170, 20, 30) },
];

// --- goals ----------------------------------------------------------
export const DEMO_GOALS: Goal[] = [
  {
    id: 'goal-weekly',
    userId: DEMO_UID,
    type: 'weekly',
    limit: 10,
    isActive: true,
    createdAt: dayOffset(45, 12),
    updatedAt: dayOffset(6, 9),
  },
  {
    id: 'goal-monthly',
    userId: DEMO_UID,
    type: 'monthly',
    limit: 30,
    isActive: true,
    createdAt: dayOffset(45, 12),
    updatedAt: dayOffset(6, 9),
  },
];

// --- library --------------------------------------------------------
export const DEMO_LIBRARY: DrinkLibraryItem[] = [
  {
    id: 'lib-1', userId: DEMO_UID,
    name: 'Kingfisher Strong', abv: 8, category: 'Beer',
    typicalServingSizeMl: 650, typicalServingSizeOz: 650 / 29.5735,
    notes: 'Standard Indian bottle', timesUsed: 24,
    createdAt: dayOffset(90, 12), lastUsed: dayOffset(2, 20),
  },
  {
    id: 'lib-2', userId: DEMO_UID,
    name: 'Bira White', abv: 4.8, category: 'Beer',
    typicalServingSizeMl: 330, typicalServingSizeOz: 330 / 29.5735,
    timesUsed: 18,
    createdAt: dayOffset(70, 12), lastUsed: dayOffset(0, 18),
  },
  {
    id: 'lib-3', userId: DEMO_UID,
    name: 'Talisker 10', abv: 45.8, category: 'Whisky',
    typicalServingSizeMl: 30, typicalServingSizeOz: 30 / 29.5735,
    notes: 'Peaty, only for special evenings', timesUsed: 6,
    createdAt: dayOffset(60, 12), lastUsed: dayOffset(3, 22),
  },
  {
    id: 'lib-4', userId: DEMO_UID,
    name: 'Old Monk', abv: 42.8, category: 'Rum',
    typicalServingSizeMl: 60, typicalServingSizeOz: 60 / 29.5735,
    notes: 'Straight or with a splash', timesUsed: 12,
    createdAt: dayOffset(80, 12), lastUsed: dayOffset(12, 21),
  },
  {
    id: 'lib-5', userId: DEMO_UID,
    name: 'House Old Fashioned', abv: 34, category: 'Cocktail',
    typicalServingSizeMl: 90, typicalServingSizeOz: 90 / 29.5735,
    notes: 'Two dashes bitters, rock', timesUsed: 8,
    createdAt: dayOffset(40, 12), lastUsed: dayOffset(3, 21),
  },
  {
    id: 'lib-6', userId: DEMO_UID,
    name: 'Pinot Noir (Sula Rasa)', abv: 12.5, category: 'Cocktail',
    typicalServingSizeMl: 150, typicalServingSizeOz: 150 / 29.5735,
    timesUsed: 5,
    createdAt: dayOffset(35, 12), lastUsed: dayOffset(9, 20),
  },
];
