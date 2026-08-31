import { useState, useEffect } from 'react';
import { format, getDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlcoholEntry, DailyStats, Goal } from '../types';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { DEMO_MODE } from '../config/demo';
import { DEMO_ENTRIES, DEMO_GOALS } from '../config/demoData';
import {
  PageBody, Card, Button, IconArrowRight, IconPlus, IconTarget, IconChart,
  IconClock, IconGlass, IconList, cx,
} from '../components/ui';

const STANDARD_DRINK_ALCOHOL_ML = 12.68;

// Apple Fitness ring metaphor:
// Move  → Standard drinks vs weekly goal   (PINK)
// Exercise → Volume vs typical week        (GREEN)
// Stand → Today's drinks logged            (CYAN)
const RING = {
  move:     { color: '#FF375F', bg: 'rgba(255, 55, 95, 0.14)',  label: 'Standard drinks',    unit: 'std' },
  exercise: { color: '#30D158', bg: 'rgba(48, 209, 88, 0.14)',   label: 'Weekly volume',      unit: 'ml' },
  stand:    { color: '#64D2FF', bg: 'rgba(100, 210, 255, 0.14)', label: 'Today',              unit: 'drinks' },
};

// Per-drink-type color assignments so a drink reads the same everywhere.
const TYPE_COLOR: Record<string, string> = {
  Beer:     '#FF9F0A',
  Whisky:   '#AC8E68',
  Rum:      '#BF5AF2',
  Vodka:    '#64D2FF',
  Wine:     '#FF375F',
  Cocktail: '#5E5CE6',
  Water:    '#40C8E0',
  Other:    '#8e8e93',
};
const typeColor = (t: string, fallback = '#8e8e93') => TYPE_COLOR[t] || fallback;

const SERIES = ['#FF9F0A', '#AC8E68', '#BF5AF2', '#64D2FF', '#FF375F', '#5E5CE6', '#40C8E0'];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card2 border border-separator2 rounded-xl px-3 py-2 shadow-popover">
      {label && <div className="text-2xs text-ink3 mb-0.5">{label}</div>}
      <div className="text-sm text-ink font-semibold tabular">
        {payload[0].value.toFixed(1)} <span className="text-ink3 font-normal">std drinks</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [, setWeekStats] = useState<DailyStats[]>([]);
  const [allEntries, setAllEntries] = useState<AlcoholEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('month');
  const [weeklyGoal, setWeeklyGoal] = useState<Goal | null>(null);
  const [monthlyGoal, setMonthlyGoal] = useState<Goal | null>(null);
  const [weeklyConsumption, setWeeklyConsumption] = useState(0);
  const [monthlyConsumption, setMonthlyConsumption] = useState(0);
  const [weeklyVolume, setWeeklyVolume] = useState(0);

  useEffect(() => { if (user) { loadStats(); loadGoals(); } /* eslint-disable-line */ }, [user]);
  useEffect(() => { calculateGoalProgress(); /* eslint-disable-line */ }, [allEntries, weeklyGoal, monthlyGoal]);

  const loadStats = async () => {
    if (!user) return;
    if (DEMO_MODE) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayEntries = DEMO_ENTRIES.filter(e => e.date >= today);
      const todayTotal = todayEntries.reduce((sum, e) => sum + e.amount, 0);
      const todayAlcohol = todayEntries.reduce((sum, e) => sum + (e.amount * e.alcoholPercentage / 100), 0);
      setTodayStats({ date: format(today, 'yyyy-MM-dd'), totalMl: todayTotal, totalAlcohol: todayAlcohol, entries: todayEntries });
      const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
      const weekMap = new Map<string, AlcoholEntry[]>();
      DEMO_ENTRIES.filter(e => e.date >= weekAgo).forEach(e => {
        const key = format(e.date, 'yyyy-MM-dd');
        if (!weekMap.has(key)) weekMap.set(key, []);
        weekMap.get(key)!.push(e);
      });
      const weekArray: DailyStats[] = Array.from(weekMap.entries()).map(([date, entries]) => ({
        date,
        totalMl: entries.reduce((s, e) => s + e.amount, 0),
        totalAlcohol: entries.reduce((s, e) => s + (e.amount * e.alcoholPercentage / 100), 0),
        entries,
      }));
      weekArray.sort((a, b) => b.date.localeCompare(a.date));
      setWeekStats(weekArray);
      setAllEntries([...DEMO_ENTRIES].sort((a, b) => b.date.getTime() - a.date.getTime()));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayQuery = query(collection(db, 'entries'), where('userId', '==', user.uid), where('date', '>=', Timestamp.fromDate(today)));
      const todaySnap = await getDocs(todayQuery);
      const todayEntries: AlcoholEntry[] = [];
      todaySnap.forEach(d => todayEntries.push({ id: d.id, ...d.data(), date: d.data().date.toDate() } as AlcoholEntry));
      const todayTotal = todayEntries.reduce((s, e) => s + e.amount, 0);
      const todayAlcohol = todayEntries.reduce((s, e) => s + (e.amount * e.alcoholPercentage / 100), 0);
      setTodayStats({ date: format(today, 'yyyy-MM-dd'), totalMl: todayTotal, totalAlcohol: todayAlcohol, entries: todayEntries });

      const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
      const weekQuery = query(collection(db, 'entries'), where('userId', '==', user.uid), where('date', '>=', Timestamp.fromDate(weekAgo)));
      const weekSnap = await getDocs(weekQuery);
      const weekMap = new Map<string, AlcoholEntry[]>();
      weekSnap.forEach(d => {
        const entry: AlcoholEntry = { id: d.id, ...d.data(), date: d.data().date.toDate() } as AlcoholEntry;
        const key = format(entry.date, 'yyyy-MM-dd');
        if (!weekMap.has(key)) weekMap.set(key, []);
        weekMap.get(key)!.push(entry);
      });
      const weekArray: DailyStats[] = Array.from(weekMap.entries()).map(([date, entries]) => ({
        date,
        totalMl: entries.reduce((s, e) => s + e.amount, 0),
        totalAlcohol: entries.reduce((s, e) => s + (e.amount * e.alcoholPercentage / 100), 0),
        entries,
      }));
      weekArray.sort((a, b) => b.date.localeCompare(a.date));
      setWeekStats(weekArray);

      const allSnap = await getDocs(query(collection(db, 'entries'), where('userId', '==', user.uid)));
      const loaded: AlcoholEntry[] = [];
      allSnap.forEach(d => loaded.push({ id: d.id, ...d.data(), date: d.data().date.toDate() } as AlcoholEntry));
      loaded.sort((a, b) => b.date.getTime() - a.date.getTime());
      setAllEntries(loaded);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const calculateStandardDrinks = (entry: AlcoholEntry) => (entry.amount * entry.alcoholPercentage / 100) / STANDARD_DRINK_ALCOHOL_ML;

  const loadGoals = async () => {
    if (!user) return;
    if (DEMO_MODE) {
      DEMO_GOALS.forEach(g => { if (g.type === 'weekly') setWeeklyGoal(g); else setMonthlyGoal(g); });
      return;
    }
    try {
      const snap = await getDocs(query(collection(db, 'goals'), where('userId', '==', user.uid)));
      snap.forEach(d => {
        const data = d.data();
        const g: Goal = { id: d.id, ...data, createdAt: data.createdAt.toDate(), updatedAt: data.updatedAt.toDate() } as Goal;
        if (g.type === 'weekly') setWeeklyGoal(g);
        else if (g.type === 'monthly') setMonthlyGoal(g);
      });
    } catch (e) { console.error(e); }
  };

  const calculateGoalProgress = () => {
    if (allEntries.length === 0) { setWeeklyConsumption(0); setMonthlyConsumption(0); setWeeklyVolume(0); return; }
    const now = new Date();
    const wStart = startOfWeek(now, { weekStartsOn: 1 }); wStart.setHours(0, 0, 0, 0);
    const wEnd = endOfWeek(now, { weekStartsOn: 1 }); wEnd.setHours(23, 59, 59, 999);
    const weekEntries = allEntries.filter(e => e.date >= wStart && e.date <= wEnd);
    setWeeklyConsumption(weekEntries.reduce((s, e) => s + calculateStandardDrinks(e), 0));
    setWeeklyVolume(weekEntries.reduce((s, e) => s + e.amount, 0));

    const mStart = startOfMonth(now); mStart.setHours(0, 0, 0, 0);
    const mEnd = endOfMonth(now); mEnd.setHours(23, 59, 59, 999);
    const monthEntries = allEntries.filter(e => e.date >= mStart && e.date <= mEnd);
    setMonthlyConsumption(monthEntries.reduce((s, e) => s + calculateStandardDrinks(e), 0));
  };

  const getTrendData = () => {
    if (allEntries.length === 0) return [];
    const now = new Date();
    const startDate = new Date(now);
    const groupBy: (d: Date) => string = chartPeriod === 'week'
      ? (d) => format(d, 'dd/MM')
      : (d) => format(d, 'MMM yyyy');
    if (chartPeriod === 'week') startDate.setDate(startDate.getDate() - 30);
    else startDate.setMonth(startDate.getMonth() - 6);
    const grouped = new Map<string, number>();
    allEntries.filter(e => e.date >= startDate).forEach(entry => {
      const key = groupBy(entry.date);
      grouped.set(key, (grouped.get(key) || 0) + calculateStandardDrinks(entry));
    });
    return Array.from(grouped.entries())
      .map(([date, drinks]) => ({ date, drinks: Number(drinks.toFixed(1)) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const getDayOfWeekData = () => {
    if (allEntries.length === 0) return [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayStats = new Map<number, number>();
    allEntries.forEach(entry => {
      const d = getDay(entry.date);
      dayStats.set(d, (dayStats.get(d) || 0) + calculateStandardDrinks(entry));
    });
    return Array.from(dayStats.entries())
      .map(([day, drinks]) => ({ name: dayNames[day], drinks: Number(drinks.toFixed(1)), dayOrder: day }))
      .sort((a, b) => a.dayOrder - b.dayOrder);
  };

  const getDrinkTypeData = () => {
    if (allEntries.length === 0) return [];
    const typeStats = new Map<string, number>();
    allEntries.forEach(entry => {
      typeStats.set(entry.type, (typeStats.get(entry.type) || 0) + calculateStandardDrinks(entry));
    });
    return Array.from(typeStats.entries())
      .map(([type, drinks]) => ({ name: type, drinks: Number(drinks.toFixed(1)) }))
      .sort((a, b) => b.drinks - a.drinks);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-24 text-sm text-ink3">Loading…</div>
      </div>
    );
  }

  const trend = getTrendData();
  const typeData = getDrinkTypeData();
  const dowData = getDayOfWeekData();
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const topType = typeData[0];
  const recentEntries = allEntries.slice(0, 5);

  const wGoal = weeklyGoal?.isActive ? weeklyGoal.limit : 10; // used as denominator if goal unset
  const mGoal = monthlyGoal?.isActive ? monthlyGoal.limit : 30;

  // Rings: 3 stacked stat rings like Activity
  const rings = [
    { color: RING.move.color, value: weeklyConsumption, target: wGoal, label: RING.move.label, unit: RING.move.unit, current: weeklyConsumption.toFixed(1), max: wGoal.toString() },
    { color: RING.exercise.color, value: weeklyVolume, target: 3000, label: RING.exercise.label, unit: RING.exercise.unit, current: weeklyVolume.toFixed(0), max: '3000' },
    { color: RING.stand.color, value: todayStats?.entries.length || 0, target: 3, label: RING.stand.label, unit: RING.stand.unit, current: (todayStats?.entries.length || 0).toString(), max: '3' },
  ];

  return (
    <div>
      {/* Header - tighter on mobile */}
      <div className="sticky top-12 md:top-0 z-10 bg-bg/95 md:bg-bg2/85 backdrop-blur border-b border-separator px-4 md:px-8 py-3 md:py-4 flex items-center justify-between rise">
        <div>
          <div className="text-[10px] md:text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">{format(now, 'EEE, dd MMM')}</div>
          <h1 className="text-lg md:text-2xl font-bold text-ink tracking-[-0.02em]">{greeting}<span className="hidden md:inline">, {user?.displayName?.split(' ')[0] || 'friend'}</span></h1>
        </div>
        <Link to="/add" className="hidden md:block">
          <Button variant="primary">
            <IconPlus /> Add drink
          </Button>
        </Link>
      </div>

      <PageBody className="!px-4 md:!px-8 !py-4 md:!py-6">
        {/* Activity rings + summary */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 md:gap-5 mb-4 md:mb-6">
          <Card className="!bg-card !rounded-3xl !p-4 md:!p-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div>
                <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">Weekly activity</div>
                <div className="text-md md:text-lg font-bold text-ink mt-0.5 tabular">{format(startOfWeek(now, { weekStartsOn: 1 }), 'dd MMM')} — {format(endOfWeek(now, { weekStartsOn: 1 }), 'dd MMM')}</div>
              </div>
              <Link to="/goals" className="text-xs md:text-sm text-blue hover:brightness-110">Edit</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] md:grid-cols-[260px_1fr] gap-6 md:gap-8 items-center">
              <div className="justify-self-center relative">
                <div className="md:hidden">
                  <ActivityRings rings={rings} size={200} />
                </div>
                <div className="hidden md:block">
                  <ActivityRings rings={rings} size={260} />
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink3 mb-1">This week</div>
                  <div className="text-3xl md:text-[40px] leading-none font-bold text-ink tabular tracking-[-0.03em]">{weeklyConsumption.toFixed(1)}</div>
                  <div className="text-2xs text-ink3 mt-1.5 font-mono tabular">of {wGoal} std</div>
                </div>
              </div>
              <div className="grid gap-3">
                {rings.map((r, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full"
                      style={{ background: `${r.color}22`, color: r.color }}
                    >
                      {i === 0 ? <IconTarget /> : i === 1 ? <IconGlass /> : <IconClock />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs uppercase tracking-[0.06em] font-semibold" style={{ color: r.color }}>{r.label}</span>
                        <span className="text-sm font-bold text-ink tabular">
                          {r.current}
                          <span className="text-ink3 text-xs font-normal font-mono">/{r.max} {r.unit}</span>
                        </span>
                      </div>
                      <div className="h-1.5 mt-1.5 rounded-full bg-bg3 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-700 ease-out"
                          style={{ width: `${Math.min(100, (r.value / r.target) * 100)}%`, background: r.color }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Today card */}
          <Card className="!bg-card !rounded-3xl !p-6 flex flex-col">
            <div className="flex items-baseline justify-between mb-4">
              <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">Today</div>
              <div className="text-xs text-ink3 font-mono tabular">{format(now, 'dd MMM')}</div>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-5xl font-bold tabular tracking-[-0.03em]" style={{ color: RING.stand.color }}>
                {todayStats ? todayStats.totalMl.toFixed(0) : '0'}
              </div>
              <div className="text-md text-ink3 font-medium">ml</div>
            </div>
            <div className="text-sm text-ink2 mt-1">
              {todayStats && todayStats.entries.length > 0
                ? `${todayStats.entries.length} ${todayStats.entries.length === 1 ? 'drink' : 'drinks'} · ${todayStats.totalAlcohol.toFixed(1)} ml pure alcohol`
                : 'Nothing logged yet'}
            </div>

            {todayStats && todayStats.entries.length > 0 ? (
              <div className="mt-5 pt-4 border-t border-separator flex-1 grid gap-2">
                {todayStats.entries.slice(0, 3).map(e => {
                  const c = typeColor(e.type);
                  return (
                    <div key={e.id} className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: `${c}22`, color: c }}>
                        <IconGlass width={13} height={13} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ink font-medium leading-tight">{e.type}</div>
                        <div className="text-2xs text-ink3 font-mono tabular">{e.amount} ml · {e.alcoholPercentage}% · {format(e.date, 'HH:mm')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-auto pt-4">
                <Link to="/add">
                  <Button variant="primary" className="w-full !justify-center bg-pink text-white border-pink hover:brightness-110">
                    <IconPlus /> Log your first drink
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* Monthly progress + Top type row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <GoalCard label="Monthly" limit={mGoal} value={monthlyConsumption} color="var(--purple)" icon={<IconTarget />} />
          <TopTypeCard type={topType} total={typeData.reduce((s, x) => s + x.drinks, 0)} />
        </div>

        {/* Trend chart */}
        <Card className="!bg-card !rounded-3xl !p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: '#0A84FF22', color: '#0A84FF' }}>
                <IconChart />
              </span>
              <div>
                <div className="text-md font-semibold text-ink">Trend</div>
                <div className="text-xs text-ink3">Standard drinks over time</div>
              </div>
            </div>
            <div className="inline-flex bg-bg3 rounded-full p-1">
              {(['week', 'month'] as const).map(k => (
                <button key={k} onClick={() => setChartPeriod(k)}
                  className={cx('h-8 px-4 text-xs font-semibold rounded-full transition-colors',
                    chartPeriod === k ? 'bg-card text-ink shadow-sm' : 'text-ink3 hover:text-ink')}>
                  {k === 'week' ? '30 days' : '6 months'}
                </button>
              ))}
            </div>
          </div>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 24 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0A84FF" stopOpacity={0.35}/>
                    <stop offset="100%" stopColor="#0A84FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={50} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--separator-2)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="drinks" stroke="#0A84FF" strokeWidth={2.5} fill="url(#trendFill)"
                  dot={{ fill: '#0A84FF', r: 3, stroke: 'var(--card)', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: '#0A84FF', stroke: 'var(--card)', strokeWidth: 2 }}
                  animationDuration={700} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-16 text-sm text-ink3">Log a few drinks to see a trend.</div>
          )}
        </Card>

        {/* Two-column distributions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <Card className="!bg-card !rounded-3xl !p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--orange)22', color: 'var(--orange)' }}>
                <IconGlass />
              </span>
              <div>
                <div className="text-md font-semibold text-ink">By drink type</div>
                <div className="text-xs text-ink3">All-time distribution</div>
              </div>
            </div>
            {typeData.length > 0 ? (
              <div className="grid gap-3">
                {typeData.map(t => {
                  const total = typeData.reduce((s, x) => s + x.drinks, 0) || 1;
                  const pct = (t.drinks / total) * 100;
                  const c = typeColor(t.name);
                  return (
                    <div key={t.name}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="inline-flex items-center gap-2.5 text-ink">
                          <span className="inline-block w-3 h-3 rounded-full" style={{ background: c }} />
                          <span className="font-semibold">{t.name}</span>
                        </span>
                        <span className="text-ink font-bold tabular">
                          {t.drinks.toFixed(1)} <span className="text-ink3 text-xs font-normal">· {Math.round(pct)}%</span>
                        </span>
                      </div>
                      <div className="h-2 bg-bg3 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-[width] duration-700 ease-out"
                          style={{ width: `${pct}%`, background: c }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-ink3">No data yet.</div>
            )}
          </Card>

          <Card className="!bg-card !rounded-3xl !p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--purple)22', color: 'var(--purple)' }}>
                <IconClock />
              </span>
              <div>
                <div className="text-md font-semibold text-ink">By day of week</div>
                <div className="text-xs text-ink3">Where the week is heaviest</div>
              </div>
            </div>
            {dowData.length > 0 ? (
              <div className="grid grid-cols-[minmax(0,180px)_1fr] items-center gap-6">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={dowData} cx="50%" cy="50%" innerRadius={44} outerRadius={80} dataKey="drinks" paddingAngle={2} strokeWidth={0}>
                      {dowData.map((_e, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid gap-2">
                  {[...dowData].sort((a, b) => b.drinks - a.drinks).map(d => {
                    const total = dowData.reduce((s, x) => s + x.drinks, 0) || 1;
                    const pct = (d.drinks / total) * 100;
                    const colorIdx = dowData.findIndex(x => x.name === d.name);
                    const c = SERIES[colorIdx % SERIES.length];
                    return (
                      <div key={d.name} className="flex items-center gap-3 text-sm">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                        <span className="text-ink font-medium flex-1">{d.name}</span>
                        <span className="text-ink font-semibold tabular">{d.drinks.toFixed(1)}</span>
                        <span className="text-ink3 text-xs tabular w-8 text-right">{Math.round(pct)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-ink3">No data yet.</div>
            )}
          </Card>
        </div>

        {/* Recent activity */}
        <Card className="!bg-card !rounded-3xl !p-0 mb-4">
          <div className="flex items-center justify-between px-6 py-5 border-b border-separator">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--blue)22] text-blue">
                <IconList />
              </span>
              <div>
                <div className="text-md font-semibold text-ink">Recent activity</div>
                <div className="text-xs text-ink3">Your latest {recentEntries.length} entries</div>
              </div>
            </div>
            <Link to="/history" className="text-sm text-blue hover:brightness-110 inline-flex items-center gap-1">
              See all <IconArrowRight width={11} height={11} />
            </Link>
          </div>
          {recentEntries.length > 0 ? (
            <div className="divide-y divide-separator">
              {recentEntries.map(e => {
                const c = typeColor(e.type);
                const std = calculateStandardDrinks(e);
                return (
                  <div key={e.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-bg3/50 transition-colors">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: `${c}22`, color: c }}>
                      <IconGlass width={16} height={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink font-semibold">{e.type}</div>
                      <div className="text-2xs text-ink3 font-mono tabular">
                        {e.amount} ml · {e.alcoholPercentage}% · {std.toFixed(2)} std
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm text-ink font-medium tabular">{format(e.date, 'HH:mm')}</div>
                      <div className="text-2xs text-ink3 tabular">{format(e.date, 'dd MMM')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-ink3">No entries yet.</div>
          )}
        </Card>
      </PageBody>
    </div>
  );
}

// ---- Activity rings ------------------------------------------------
function ActivityRings({ rings, size }: { rings: { color: string; value: number; target: number }[]; size: number }) {
  const center = size / 2;
  const strokes = [18, 18, 18];
  const gaps = [6, 6];
  let radius = center - strokes[0] / 2 - 2;
  return (
    <svg width={size} height={size} className="-rotate-90">
      {rings.map((r, i) => {
        if (i > 0) radius -= (strokes[i - 1] / 2 + gaps[i - 1] + strokes[i] / 2);
        const c = 2 * Math.PI * radius;
        const pct = Math.min(1.5, r.target > 0 ? r.value / r.target : 0);
        return (
          <g key={i}>
            <circle cx={center} cy={center} r={radius} fill="none"
              stroke={r.color} strokeOpacity={0.18} strokeWidth={strokes[i]} />
            <circle cx={center} cy={center} r={radius} fill="none"
              stroke={r.color} strokeWidth={strokes[i]}
              strokeLinecap="round"
              strokeDasharray={`${c * Math.min(1, pct)} ${c}`}
              style={{ transition: 'stroke-dasharray 800ms cubic-bezier(0.2, 0.7, 0.3, 1)' }} />
          </g>
        );
      })}
    </svg>
  );
}

// ---- Reusable inline cards -----------------------------------------
function GoalCard({ label, limit, value, color, icon }: {
  label: string; limit: number; value: number; color: string; icon: React.ReactNode;
}) {
  const pct = limit > 0 ? Math.round((value / limit) * 100) : 0;
  const over = value > limit;
  const remaining = Math.max(0, limit - value);
  const effectiveColor = over ? '#FF453A' : color;
  return (
    <div className="rounded-3xl p-6 border border-separator" style={{ background: `linear-gradient(160deg, ${effectiveColor}18 0%, var(--card) 65%)` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: `${effectiveColor}30`, color: effectiveColor }}>
            {icon}
          </span>
          <div>
            <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">{label}</div>
            <div className="text-md font-semibold text-ink">Goal</div>
          </div>
        </div>
        <div className="text-2xs uppercase tracking-[0.08em] font-bold px-2.5 py-1 rounded-full" style={{ background: `${effectiveColor}22`, color: effectiveColor }}>
          {over ? 'Over' : `${pct}%`}
        </div>
      </div>
      <div className="flex items-baseline gap-2 mt-4">
        <span className="text-5xl font-bold tabular tracking-[-0.03em]" style={{ color: effectiveColor }}>{value.toFixed(1)}</span>
        <span className="text-md text-ink3 font-medium">/ {limit} std</span>
      </div>
      <div className="text-sm text-ink3 mt-1">
        {over ? `${(value - limit).toFixed(1)} over your limit` : `${remaining.toFixed(1)} remaining this month`}
      </div>
      <div className="h-2.5 mt-5 rounded-full bg-bg3 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${Math.min(100, pct)}%`, background: effectiveColor }} />
      </div>
    </div>
  );
}

function TopTypeCard({ type, total }: { type?: { name: string; drinks: number }; total: number }) {
  if (!type) {
    return (
      <div className="rounded-3xl p-6 border border-separator bg-card flex flex-col justify-center items-center">
        <div className="text-sm text-ink3">Log a few drinks to see your top type.</div>
      </div>
    );
  }
  const c = typeColor(type.name);
  const pct = total > 0 ? Math.round((type.drinks / total) * 100) : 0;
  return (
    <div className="rounded-3xl p-6 border border-separator" style={{ background: `linear-gradient(160deg, ${c}18 0%, var(--card) 65%)` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: `${c}30`, color: c }}>
            <IconGlass />
          </span>
          <div>
            <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">Most logged</div>
            <div className="text-md font-semibold text-ink">Drink type</div>
          </div>
        </div>
        <div className="text-2xs uppercase tracking-[0.08em] font-bold px-2.5 py-1 rounded-full" style={{ background: `${c}22`, color: c }}>
          {pct}%
        </div>
      </div>
      <div className="mt-4">
        <div className="text-4xl font-bold tabular tracking-[-0.02em]" style={{ color: c }}>{type.name}</div>
        <div className="text-sm text-ink3 mt-1 tabular">
          {type.drinks.toFixed(1)} standard drinks all time
        </div>
      </div>
      <div className="h-2.5 mt-5 rounded-full bg-bg3 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: c }} />
      </div>
    </div>
  );
}
