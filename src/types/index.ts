export interface AlcoholEntry {
  id?: string;
  userId: string; // User who owns this entry
  type: string;
  amount: number; // in milliliters
  alcoholPercentage: number;
  date: Date;
  notes?: string;
  sessionId?: string; // Reference to a session
}

export interface Session {
  id?: string;
  userId: string; // User who owns this session
  name: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  entryIds: string[]; // References to entry IDs
  createdAt: Date;
  notes?: string;
}

export interface DailyStats {
  date: string;
  totalMl: number;
  totalAlcohol: number; // in grams
  entries: AlcoholEntry[];
}

export interface DrinkLibraryItem {
  id?: string;
  userId: string; // User who owns this drink
  name: string;
  abv: number; // Alcohol by Volume percentage
  typicalServingSizeOz?: number; // Typical serving size in ounces
  typicalServingSizeMl?: number; // Typical serving size in milliliters
  category?: string; // e.g., Beer, Whisky, Rum, Vodka, Cocktail, Other
  notes?: string;
  timesUsed?: number; // Track frequency
  createdAt: Date;
  lastUsed?: Date;
}

export interface Goal {
  id?: string;
  userId: string; // User who owns this goal
  type: 'weekly' | 'monthly';
  limit: number; // Maximum standard drinks allowed
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

