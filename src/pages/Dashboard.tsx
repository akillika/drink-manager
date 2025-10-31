import { useState, useEffect } from 'react';
import { format, getDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlcoholEntry, DailyStats, Goal } from '../types';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

// Standard drink calculation: 10g of pure alcohol = 1 standard drink
const STANDARD_DRINK_ALCOHOL_GRAMS = 10;

// Modern gradient color palette
const GRADIENT_COLORS = [
  { from: '#667eea', to: '#764ba2' }, // Purple
  { from: '#f093fb', to: '#f5576c' }, // Pink
  { from: '#4facfe', to: '#00f2fe' }, // Blue
  { from: '#43e97b', to: '#38f9d7' }, // Green
  { from: '#fa709a', to: '#fee140' }, // Pink-Yellow
  { from: '#30cfd0', to: '#330867' }, // Cyan-Purple
  { from: '#a8edea', to: '#fed6e3' }, // Mint-Pink
];


// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        <p className="text-sm text-indigo-600">
          <span className="font-medium">{payload[0].value.toFixed(1)}</span> standard drinks
        </p>
      </div>
    );
  }
  return null;
};

// Custom label for pie chart
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null; // Don't show labels for very small segments

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
      fontWeight="600"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [weekStats, setWeekStats] = useState<DailyStats[]>([]);
  const [allEntries, setAllEntries] = useState<AlcoholEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('month');
  const [weeklyGoal, setWeeklyGoal] = useState<Goal | null>(null);
  const [monthlyGoal, setMonthlyGoal] = useState<Goal | null>(null);
  const [weeklyConsumption, setWeeklyConsumption] = useState(0);
  const [monthlyConsumption, setMonthlyConsumption] = useState(0);

  useEffect(() => {
    if (user) {
      loadStats();
      loadGoals();
    }
  }, [user]);

  useEffect(() => {
    // Recalculate whenever entries or goals change
    calculateGoalProgress();
  }, [allEntries, weeklyGoal, monthlyGoal]);

  const loadStats = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get today's entries
      const todayQuery = query(
        collection(db, 'entries'),
        where('userId', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(today))
      );
      const todaySnapshot = await getDocs(todayQuery);
      
      const todayEntries: AlcoholEntry[] = [];
      todaySnapshot.forEach((doc) => {
        const data = doc.data();
        todayEntries.push({
          id: doc.id,
          ...data,
          date: data.date.toDate(),
        } as AlcoholEntry);
      });

      const todayTotal = todayEntries.reduce((sum, entry) => sum + entry.amount, 0);
      const todayAlcohol = todayEntries.reduce(
        (sum, entry) => sum + (entry.amount * entry.alcoholPercentage / 100 * 0.789),
        0
      );

      setTodayStats({
        date: format(today, 'yyyy-MM-dd'),
        totalMl: todayTotal,
        totalAlcohol: todayAlcohol,
        entries: todayEntries,
      });

      // Get week's entries
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const weekQuery = query(
        collection(db, 'entries'),
        where('userId', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(weekAgo))
      );
      const weekSnapshot = await getDocs(weekQuery);
      
      const weekMap = new Map<string, AlcoholEntry[]>();
      weekSnapshot.forEach((doc) => {
        const data = doc.data();
        const entry: AlcoholEntry = {
          id: doc.id,
          ...data,
          date: data.date.toDate(),
        } as AlcoholEntry;
        const dateKey = format(entry.date, 'yyyy-MM-dd');
        if (!weekMap.has(dateKey)) {
          weekMap.set(dateKey, []);
        }
        weekMap.get(dateKey)!.push(entry);
      });

      const weekStatsArray: DailyStats[] = Array.from(weekMap.entries()).map(([date, entries]) => {
        const totalMl = entries.reduce((sum, e) => sum + e.amount, 0);
        const totalAlcohol = entries.reduce(
          (sum, e) => sum + (e.amount * e.alcoholPercentage / 100 * 0.789),
          0
        );
        return { date, totalMl, totalAlcohol, entries };
      });

      setWeekStats(weekStatsArray);

      // Load all entries for goal calculation and chart analysis
      // Query without date filter to get all entries for accurate goal tracking
      const allEntriesQuery = query(
        collection(db, 'entries'),
        where('userId', '==', user.uid)
      );
      const allEntriesSnapshot = await getDocs(allEntriesQuery);
      const loadedEntries: AlcoholEntry[] = [];
      
      allEntriesSnapshot.forEach((doc) => {
        const data = doc.data();
        loadedEntries.push({
          id: doc.id,
          ...data,
          date: data.date.toDate(),
        } as AlcoholEntry);
      });

      // Sort by date descending (most recent first)
      loadedEntries.sort((a, b) => b.date.getTime() - a.date.getTime());

      console.log('Loaded', loadedEntries.length, 'entries for goal calculation');
      setAllEntries(loadedEntries);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate standard drinks: (volume in ml * ABV% / 100 * 0.789) / 10g
  const calculateStandardDrinks = (entry: AlcoholEntry): number => {
    const alcoholGrams = (entry.amount * entry.alcoholPercentage / 100 * 0.789);
    return alcoholGrams / STANDARD_DRINK_ALCOHOL_GRAMS;
  };

  const loadGoals = async () => {
    if (!user) return;
    try {
      const goalsQuery = query(
        collection(db, 'goals'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(goalsQuery);

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const goal: Goal = {
          id: docSnapshot.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Goal;

        if (goal.type === 'weekly') {
          setWeeklyGoal(goal);
        } else if (goal.type === 'monthly') {
          setMonthlyGoal(goal);
        }
      });
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const calculateGoalProgress = () => {
    if (allEntries.length === 0) {
      console.log('No entries available for goal calculation');
      setWeeklyConsumption(0);
      setMonthlyConsumption(0);
      return;
    }

    const now = new Date();
    
    // Calculate weekly consumption (current week)
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
    weekStart.setHours(0, 0, 0, 0); // Start of day
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    weekEnd.setHours(23, 59, 59, 999); // End of day
    
    const weeklyEntries = allEntries.filter(e => {
      const entryDate = new Date(e.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate >= weekStart && entryDate <= weekEnd;
    });
    
    const weeklyTotal = weeklyEntries.reduce((sum, entry) => sum + calculateStandardDrinks(entry), 0);
    console.log('Weekly calculation:', {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      entriesFound: weeklyEntries.length,
      totalDrinks: weeklyTotal.toFixed(2)
    });
    setWeeklyConsumption(weeklyTotal);

    // Calculate monthly consumption (current month)
    const monthStart = startOfMonth(now);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = endOfMonth(now);
    monthEnd.setHours(23, 59, 59, 999);
    
    const monthlyEntries = allEntries.filter(e => {
      const entryDate = new Date(e.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate >= monthStart && entryDate <= monthEnd;
    });
    
    const monthlyTotal = monthlyEntries.reduce((sum, entry) => sum + calculateStandardDrinks(entry), 0);
    console.log('Monthly calculation:', {
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
      entriesFound: monthlyEntries.length,
      totalDrinks: monthlyTotal.toFixed(2)
    });
    setMonthlyConsumption(monthlyTotal);
  };

  // Prepare trend chart data (weekly or monthly)
  const getTrendData = () => {
    if (allEntries.length === 0) return [];

    const now = new Date();
    let startDate: Date;
    let groupBy: (date: Date) => string;

    if (chartPeriod === 'week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      groupBy = (date: Date) => format(date, 'dd/MM');
    } else {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 6); // Last 6 months
      groupBy = (date: Date) => format(date, 'MMM yyyy');
    }

    // Filter entries within the date range for charts (allEntries now contains all entries)
    const filtered = allEntries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate >= startDate;
    });
    const grouped = new Map<string, number>();

    filtered.forEach(entry => {
      const key = groupBy(entry.date);
      const current = grouped.get(key) || 0;
      grouped.set(key, current + calculateStandardDrinks(entry));
    });

    return Array.from(grouped.entries())
      .map(([date, drinks]) => ({ date, drinks: Number(drinks.toFixed(1)) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  // Prepare day of week analysis
  const getDayOfWeekData = () => {
    if (allEntries.length === 0) return [];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayStats = new Map<number, number>();

    allEntries.forEach(entry => {
      const dayOfWeek = getDay(entry.date);
      const current = dayStats.get(dayOfWeek) || 0;
      dayStats.set(dayOfWeek, current + calculateStandardDrinks(entry));
    });

    const result = Array.from(dayStats.entries())
      .map(([day, drinks]) => ({
        name: dayNames[day],
        drinks: Number(drinks.toFixed(1)),
        dayOrder: day, // Sunday = 0, Monday = 1, etc.
      }));
    
    // Sort by day order (Sunday = 0, Monday = 1, etc.)
    return result.sort((a, b) => a.dayOrder - b.dayOrder);
  };

  // Prepare drink type distribution
  const getDrinkTypeData = () => {
    if (allEntries.length === 0) return [];

    const typeStats = new Map<string, number>();

    allEntries.forEach(entry => {
      const current = typeStats.get(entry.type) || 0;
      typeStats.set(entry.type, current + calculateStandardDrinks(entry));
    });

    return Array.from(typeStats.entries())
      .map(([type, drinks]) => ({
        name: type,
        drinks: Number(drinks.toFixed(1)),
      }))
      .sort((a, b) => b.drinks - a.drinks);
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Helper function to get goal alert status
  const getGoalStatus = (consumption: number, limit: number): 'safe' | 'warning' | 'danger' => {
    if (limit === 0) return 'safe';
    const percentage = (consumption / limit) * 100;
    if (percentage >= 100) return 'danger';
    if (percentage >= 80) return 'warning';
    return 'safe';
  };

  // Helper function to get goal alert message
  const getGoalAlertMessage = (consumption: number, limit: number, type: 'weekly' | 'monthly'): string | null => {
    if (limit === 0) return null;
    const percentage = (consumption / limit) * 100;
    if (percentage >= 100) {
      return `⚠️ You've exceeded your ${type} limit by ${(consumption - limit).toFixed(1)} drinks`;
    }
    if (percentage >= 90) {
      return `🚨 You're very close to your ${type} limit (${(limit - consumption).toFixed(1)} drinks remaining)`;
    }
    if (percentage >= 80) {
      return `⚠️ You're approaching your ${type} limit (${(limit - consumption).toFixed(1)} drinks remaining)`;
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-900 animate-fade-in-down">Dashboard</h2>

      {/* Goal Progress Cards */}
      {(weeklyGoal?.isActive || monthlyGoal?.isActive) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Weekly Goal Progress */}
          {weeklyGoal?.isActive && (
            <div className={`rounded-xl shadow-lg p-6 border-2 card-hover animate-fade-in-up ${
              getGoalStatus(weeklyConsumption, weeklyGoal.limit) === 'danger'
                ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-300'
                : getGoalStatus(weeklyConsumption, weeklyGoal.limit) === 'warning'
                ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300'
                : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">📅 Weekly Goal</h3>
                  <p className="text-sm text-gray-600">Limit: {weeklyGoal.limit} standard drinks</p>
                </div>
                <Link
                  to="/goals"
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                >
                  Edit →
                </Link>
              </div>
              <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-2xl font-bold text-gray-900" style={{ animation: 'countUp 0.6s ease-out' }}>
                    {weeklyConsumption.toFixed(1)} / {weeklyGoal.limit}
                  </span>
                  <span className={`text-sm font-semibold ${
                    getGoalStatus(weeklyConsumption, weeklyGoal.limit) === 'danger'
                      ? 'text-red-600'
                      : getGoalStatus(weeklyConsumption, weeklyGoal.limit) === 'warning'
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}>
                    {((weeklyConsumption / weeklyGoal.limit) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      getGoalStatus(weeklyConsumption, weeklyGoal.limit) === 'danger'
                        ? 'bg-gradient-to-r from-red-500 to-red-600'
                        : getGoalStatus(weeklyConsumption, weeklyGoal.limit) === 'warning'
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (weeklyConsumption / weeklyGoal.limit) * 100)}%`,
                      boxShadow: getGoalStatus(weeklyConsumption, weeklyGoal.limit) === 'danger'
                        ? '0 2px 8px rgba(239, 68, 68, 0.4)'
                        : getGoalStatus(weeklyConsumption, weeklyGoal.limit) === 'warning'
                        ? '0 2px 8px rgba(234, 179, 8, 0.4)'
                        : '0 2px 8px rgba(34, 197, 94, 0.4)',
                      animation: 'progressFill 1s ease-out 0.3s forwards'
                    }}
                  />
                  {weeklyConsumption > weeklyGoal.limit && (
                    <div className="absolute top-0 left-0 w-full h-full bg-red-200 opacity-30 rounded-full" />
                  )}
                </div>
              </div>
              {getGoalAlertMessage(weeklyConsumption, weeklyGoal.limit, 'weekly') && (
                <div className={`mt-3 p-3 rounded-lg ${
                  getGoalStatus(weeklyConsumption, weeklyGoal.limit) === 'danger'
                    ? 'bg-red-100 border border-red-300 text-red-800'
                    : 'bg-yellow-100 border border-yellow-300 text-yellow-800'
                }`}>
                  <p className="text-sm font-medium">
                    {getGoalAlertMessage(weeklyConsumption, weeklyGoal.limit, 'weekly')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Monthly Goal Progress */}
          {monthlyGoal?.isActive && (
            <div className={`rounded-xl shadow-lg p-6 border-2 card-hover animate-fade-in-up ${
              getGoalStatus(monthlyConsumption, monthlyGoal.limit) === 'danger'
                ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-300'
                : getGoalStatus(monthlyConsumption, monthlyGoal.limit) === 'warning'
                ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300'
                : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">📆 Monthly Goal</h3>
                  <p className="text-sm text-gray-600">Limit: {monthlyGoal.limit} standard drinks</p>
                </div>
                <Link
                  to="/goals"
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                >
                  Edit →
                </Link>
              </div>
              <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-2xl font-bold text-gray-900" style={{ animation: 'countUp 0.6s ease-out' }}>
                    {monthlyConsumption.toFixed(1)} / {monthlyGoal.limit}
                  </span>
                  <span className={`text-sm font-semibold ${
                    getGoalStatus(monthlyConsumption, monthlyGoal.limit) === 'danger'
                      ? 'text-red-600'
                      : getGoalStatus(monthlyConsumption, monthlyGoal.limit) === 'warning'
                      ? 'text-yellow-600'
                      : 'text-blue-600'
                  }`}>
                    {((monthlyConsumption / monthlyGoal.limit) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      getGoalStatus(monthlyConsumption, monthlyGoal.limit) === 'danger'
                        ? 'bg-gradient-to-r from-red-500 to-red-600'
                        : getGoalStatus(monthlyConsumption, monthlyGoal.limit) === 'warning'
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (monthlyConsumption / monthlyGoal.limit) * 100)}%`,
                      boxShadow: getGoalStatus(monthlyConsumption, monthlyGoal.limit) === 'danger'
                        ? '0 2px 8px rgba(239, 68, 68, 0.4)'
                        : getGoalStatus(monthlyConsumption, monthlyGoal.limit) === 'warning'
                        ? '0 2px 8px rgba(234, 179, 8, 0.4)'
                        : '0 2px 8px rgba(59, 130, 246, 0.4)',
                      animation: 'progressFill 1s ease-out 0.3s forwards'
                    }}
                  />
                  {monthlyConsumption > monthlyGoal.limit && (
                    <div className="absolute top-0 left-0 w-full h-full bg-red-200 opacity-30 rounded-full" />
                  )}
                </div>
              </div>
              {getGoalAlertMessage(monthlyConsumption, monthlyGoal.limit, 'monthly') && (
                <div className={`mt-3 p-3 rounded-lg ${
                  getGoalStatus(monthlyConsumption, monthlyGoal.limit) === 'danger'
                    ? 'bg-red-100 border border-red-300 text-red-800'
                    : 'bg-yellow-100 border border-yellow-300 text-yellow-800'
                }`}>
                  <p className="text-sm font-medium">
                    {getGoalAlertMessage(monthlyConsumption, monthlyGoal.limit, 'monthly')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No Goals Set Message */}
      {!weeklyGoal?.isActive && !monthlyGoal?.isActive && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-lg p-6 border border-indigo-200 animate-fade-in-up card-hover">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">🎯 Set Your Goals</h3>
              <p className="text-sm text-gray-600">
                Track your progress by setting weekly or monthly consumption limits
              </p>
            </div>
            <Link
              to="/goals"
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 font-medium shadow-md"
            >
              Set Goals →
            </Link>
          </div>
        </div>
      )}

      {/* Drink Type Distribution - Modern Style */}
      <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-lg p-6 border border-blue-100 chart-container">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-1">🍺 Drink Type Distribution</h3>
          <p className="text-sm text-gray-500">See which drinks contribute most to your consumption</p>
        </div>
        {getDrinkTypeData().length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="relative">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart 
                  data={getDrinkTypeData()} 
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <defs>
                    {getDrinkTypeData().map((entry, index) => (
                      <linearGradient key={`barGradient-${index}`} id={`barGradient-${index}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={GRADIENT_COLORS[index % GRADIENT_COLORS.length].from} stopOpacity={0.9}/>
                        <stop offset="100%" stopColor={GRADIENT_COLORS[index % GRADIENT_COLORS.length].to} stopOpacity={0.9}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} horizontal={true} vertical={false} />
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 11, fill: '#6b7280' }} 
                    stroke="#9ca3af"
                    label={{ value: 'Standard Drinks', position: 'insideBottom', offset: -5, style: { fill: '#374151' } }} 
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }}
                    stroke="#9ca3af"
                    width={90}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="drinks" 
                    radius={[0, 8, 8, 0]}
                    animationDuration={1000}
                    animationBegin={0}
                  >
                    {getDrinkTypeData().map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#barGradient-${index})`}
                        stroke="#fff"
                        strokeWidth={1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center space-y-4">
              {getDrinkTypeData().map((type, index) => {
                const total = getDrinkTypeData().reduce((sum, t) => sum + t.drinks, 0);
                const percentage = (type.drinks / total * 100).toFixed(1);
                return (
                  <div 
                    key={type.name}
                    className="group bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-blue-200 card-hover animate-stagger-1"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-5 h-5 rounded-md shadow-sm"
                          style={{
                            background: `linear-gradient(135deg, ${GRADIENT_COLORS[index % GRADIENT_COLORS.length].from}, ${GRADIENT_COLORS[index % GRADIENT_COLORS.length].to})`
                          }}
                        />
                        <span className="font-bold text-gray-900 text-lg">{type.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          {type.drinks.toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">drinks</span>
                      </div>
                    </div>
                    <div className="relative w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out relative"
                        style={{
                          width: `${percentage}%`,
                          background: `linear-gradient(90deg, ${GRADIENT_COLORS[index % GRADIENT_COLORS.length].from}, ${GRADIENT_COLORS[index % GRADIENT_COLORS.length].to})`,
                          boxShadow: `0 2px 12px ${GRADIENT_COLORS[index % GRADIENT_COLORS.length].from}50`,
                          animation: 'slideIn 1s ease-out'
                        }}
                      >
                        <div className="absolute inset-0 bg-white opacity-20 rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-medium text-gray-600">{percentage}% of total</span>
                      <span className="text-xs text-gray-400">{((type.drinks / total) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-700">
                  💡 <strong>Tip:</strong> Focus on moderation by being aware of which drink types you consume most frequently.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-lg">No data available for drink type analysis</p>
          </div>
        )}
      </div>

      {/* Today's Summary */}
      <div className="bg-white rounded-lg shadow p-6 animate-fade-in-up card-hover">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Today's Summary</h3>
        {todayStats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 card-hover animate-stagger-1">
              <div className="text-sm text-blue-600 font-medium">Total Volume</div>
              <div className="text-2xl font-bold text-blue-900" style={{ animation: 'countUp 0.8s ease-out' }}>
                {todayStats.totalMl.toFixed(0)} ml
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 card-hover animate-stagger-2">
              <div className="text-sm text-purple-600 font-medium">Total Alcohol</div>
              <div className="text-2xl font-bold text-purple-900" style={{ animation: 'countUp 0.8s ease-out 0.1s forwards', opacity: 0 }}>
                {todayStats.totalAlcohol.toFixed(1)} g
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 card-hover animate-stagger-3">
              <div className="text-sm text-green-600 font-medium">Number of Drinks</div>
              <div className="text-2xl font-bold text-green-900" style={{ animation: 'countUp 0.8s ease-out 0.2s forwards', opacity: 0 }}>
                {todayStats.entries.length}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">No entries for today</div>
        )}
      </div>

      {/* This Week's Overview */}
      <div className="bg-white rounded-lg shadow p-6 animate-fade-in-up card-hover">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">This Week</h3>
        {weekStats.length > 0 ? (
          <div className="space-y-2">
            {weekStats.map((stat) => (
              <div
                key={stat.date}
                className="flex items-center justify-between p-3 bg-gray-50 rounded"
              >
                <span className="text-gray-700 font-medium">
                  {format(new Date(stat.date), 'EEEE, dd MMM')}
                </span>
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-600">
                    {stat.totalMl.toFixed(0)} ml
                  </span>
                  <span className="text-gray-600">
                    {stat.totalAlcohol.toFixed(1)} g alcohol
                  </span>
                  <span className="text-gray-600">
                    {stat.entries.length} {stat.entries.length === 1 ? 'drink' : 'drinks'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500">No entries this week</div>
        )}
      </div>

      {/* Trend Chart - Modern Style */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 border border-gray-100 chart-container animate-fade-in-up card-hover">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">📊 Consumption Trend</h3>
            <p className="text-sm text-gray-500">Track your drinking patterns over time</p>
          </div>
          <div className="flex gap-2 bg-white p-1 rounded-lg shadow-sm">
            <button
              onClick={() => setChartPeriod('week')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                chartPeriod === 'week'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setChartPeriod('month')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                chartPeriod === 'month'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
        {getTrendData().length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={getTrendData()} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
              <defs>
                <linearGradient id="colorDrinks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#667eea" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#764ba2" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: '#6b7280' }}
                angle={-45}
                textAnchor="end"
                height={80}
                stroke="#9ca3af"
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#6b7280' }}
                stroke="#9ca3af"
                label={{ value: 'Standard Drinks', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#374151' } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="drinks" 
                stroke="#667eea" 
                strokeWidth={3}
                fillOpacity={0.8} 
                fill="url(#colorDrinks)"
                animationDuration={1000}
                animationBegin={0}
                dot={{ fill: '#667eea', r: 4 }}
                activeDot={{ r: 6, stroke: '#667eea', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-gray-500 text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-lg">No data available for trend analysis</p>
            <p className="text-sm mt-2">Start logging drinks to see your consumption trends</p>
          </div>
        )}
      </div>

      {/* Day of Week Analysis - Modern Style */}
      <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl shadow-lg p-6 border border-purple-100 chart-container animate-fade-in-up card-hover">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-1">📅 Day of Week Analysis</h3>
          <p className="text-sm text-gray-500">Identify your drinking patterns by day</p>
        </div>
        {getDayOfWeekData().length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="relative">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <defs>
                    {getDayOfWeekData().map((entry, index) => (
                      <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={GRADIENT_COLORS[index % GRADIENT_COLORS.length].from} stopOpacity={1}/>
                        <stop offset="100%" stopColor={GRADIENT_COLORS[index % GRADIENT_COLORS.length].to} stopOpacity={0.8}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={getDayOfWeekData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={120}
                    innerRadius={50}
                    paddingAngle={3}
                    dataKey="drinks"
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {getDayOfWeekData().map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#gradient-${index})`}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={<CustomTooltip />}
                    formatter={(value: number) => `${value.toFixed(1)} standard drinks`} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center space-y-3">
              {getDayOfWeekData()
                .sort((a, b) => b.drinks - a.drinks)
                .map((day, index) => {
                  const total = getDayOfWeekData().reduce((sum, d) => sum + d.drinks, 0);
                  const percentage = (day.drinks / total * 100).toFixed(0);
                  const colorIndex = getDayOfWeekData().findIndex(d => d.name === day.name);
                  return (
                    <div 
                      key={day.name} 
                      className="group relative bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-purple-200 card-hover animate-stagger-1"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full shadow-sm"
                            style={{
                              background: `linear-gradient(135deg, ${GRADIENT_COLORS[colorIndex % GRADIENT_COLORS.length].from}, ${GRADIENT_COLORS[colorIndex % GRADIENT_COLORS.length].to})`
                            }}
                          />
                          <span className="font-semibold text-gray-800">{day.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-gray-900">{day.drinks.toFixed(1)}</span>
                          <span className="text-xs text-gray-500 ml-1">drinks</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${percentage}%`,
                            background: `linear-gradient(90deg, ${GRADIENT_COLORS[colorIndex % GRADIENT_COLORS.length].from}, ${GRADIENT_COLORS[colorIndex % GRADIENT_COLORS.length].to})`,
                            boxShadow: `0 2px 8px ${GRADIENT_COLORS[colorIndex % GRADIENT_COLORS.length].from}40`
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 mt-1 block">{percentage}% of total</span>
                    </div>
                  );
                })}
              <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <p className="text-xs text-purple-700">
                  💡 <strong>Insight:</strong> Identify which days you consume the most to recognize patterns.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-lg">No data available for day analysis</p>
          </div>
        )}
      </div>
    </div>
  );
}

