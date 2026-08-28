import { useState, useEffect } from 'react';
import { format, getDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlcoholEntry, DailyStats, Goal } from '../types';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import {
  Page, PageHeader, PageBody, Card, StatCard, Button, Badge, Empty, Callout,
  IconArrowRight, IconPlus, IconTarget, IconGlass, IconClock, IconChart, IconList, cx,
} from '../components/ui';

const STANDARD_DRINK_ALCOHOL_ML = 12.68;

// Full colored palette for chart series — muted enough to not scream "AI"
// but saturated enough to actually read as different categories.
const SERIES = ['#3f7a3f', '#305a9a', '#8e5d17', '#9c2e2e', '#6a3f8c', '#a45078', '#4d4a44'];

// Per-drink-type accent so the same drink reads the same color everywhere.
const TYPE_COLOR: Record<string, string> = {
  Beer:     '#b47b1e',
  Whisky:   '#8a4a1a',
  Rum:      '#8f5a26',
  Vodka:    '#4a6b8b',
  Wine:     '#8a2f3c',
  Cocktail: '#7a3a92',
  Water:    '#4d8ba0',
  Other:    '#4d4a44',
};
const typeColor = (t: string, fallback: string) => TYPE_COLOR[t] || fallback;

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-paper2 border border-rule2 rounded-md px-2.5 py-2 shadow-popover">
      {label && <div className="text-2xs uppercase tracking-[0.06em] text-ink3 mb-1">{label}</div>}
      <div className="text-xs text-ink font-mono tabular">
        {payload[0].value.toFixed(1)} <span className="text-ink3">std drinks</span>
      </div>
    </div>
  );
}

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
    if (user) { loadStats(); loadGoals(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => { calculateGoalProgress(); /* eslint-disable-line */ }, [allEntries, weeklyGoal, monthlyGoal]);

  const loadStats = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayQuery = query(collection(db, 'entries'), where('userId', '==', user.uid), where('date', '>=', Timestamp.fromDate(today)));
      const todaySnapshot = await getDocs(todayQuery);
      const todayEntries: AlcoholEntry[] = [];
      todaySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        todayEntries.push({ id: docSnap.id, ...data, date: data.date.toDate() } as AlcoholEntry);
      });
      const todayTotal = todayEntries.reduce((sum, e) => sum + e.amount, 0);
      const todayAlcohol = todayEntries.reduce((sum, e) => sum + (e.amount * e.alcoholPercentage / 100), 0);
      setTodayStats({ date: format(today, 'yyyy-MM-dd'), totalMl: todayTotal, totalAlcohol: todayAlcohol, entries: todayEntries });

      const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
      const weekQuery = query(collection(db, 'entries'), where('userId', '==', user.uid), where('date', '>=', Timestamp.fromDate(weekAgo)));
      const weekSnapshot = await getDocs(weekQuery);
      const weekMap = new Map<string, AlcoholEntry[]>();
      weekSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const entry: AlcoholEntry = { id: docSnap.id, ...data, date: data.date.toDate() } as AlcoholEntry;
        const dateKey = format(entry.date, 'yyyy-MM-dd');
        if (!weekMap.has(dateKey)) weekMap.set(dateKey, []);
        weekMap.get(dateKey)!.push(entry);
      });
      const weekStatsArray: DailyStats[] = Array.from(weekMap.entries()).map(([date, entries]) => {
        const totalMl = entries.reduce((sum, e) => sum + e.amount, 0);
        const totalAlcohol = entries.reduce((sum, e) => sum + (e.amount * e.alcoholPercentage / 100), 0);
        return { date, totalMl, totalAlcohol, entries };
      });
      weekStatsArray.sort((a, b) => b.date.localeCompare(a.date));
      setWeekStats(weekStatsArray);

      const allEntriesQuery = query(collection(db, 'entries'), where('userId', '==', user.uid));
      const allSnap = await getDocs(allEntriesQuery);
      const loadedEntries: AlcoholEntry[] = [];
      allSnap.forEach((docSnap) => {
        const data = docSnap.data();
        loadedEntries.push({ id: docSnap.id, ...data, date: data.date.toDate() } as AlcoholEntry);
      });
      loadedEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
      setAllEntries(loadedEntries);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStandardDrinks = (entry: AlcoholEntry): number => (entry.amount * entry.alcoholPercentage / 100) / STANDARD_DRINK_ALCOHOL_ML;

  const loadGoals = async () => {
    if (!user) return;
    try {
      const goalsQuery = query(collection(db, 'goals'), where('userId', '==', user.uid));
      const snapshot = await getDocs(goalsQuery);
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const goal: Goal = { id: docSnapshot.id, ...data, createdAt: data.createdAt.toDate(), updatedAt: data.updatedAt.toDate() } as Goal;
        if (goal.type === 'weekly') setWeeklyGoal(goal);
        else if (goal.type === 'monthly') setMonthlyGoal(goal);
      });
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const calculateGoalProgress = () => {
    if (allEntries.length === 0) { setWeeklyConsumption(0); setMonthlyConsumption(0); return; }
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); weekStart.setHours(0, 0, 0, 0);
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); weekEnd.setHours(23, 59, 59, 999);
    const weeklyEntries = allEntries.filter(e => {
      const d = new Date(e.date); d.setHours(0, 0, 0, 0);
      return d >= weekStart && d <= weekEnd;
    });
    setWeeklyConsumption(weeklyEntries.reduce((sum, e) => sum + calculateStandardDrinks(e), 0));
    const monthStart = startOfMonth(now); monthStart.setHours(0, 0, 0, 0);
    const monthEnd = endOfMonth(now); monthEnd.setHours(23, 59, 59, 999);
    const monthlyEntries = allEntries.filter(e => {
      const d = new Date(e.date); d.setHours(0, 0, 0, 0);
      return d >= monthStart && d <= monthEnd;
    });
    setMonthlyConsumption(monthlyEntries.reduce((sum, e) => sum + calculateStandardDrinks(e), 0));
  };

  const getTrendData = () => {
    if (allEntries.length === 0) return [];
    const now = new Date();
    let startDate: Date; let groupBy: (date: Date) => string;
    if (chartPeriod === 'week') {
      startDate = new Date(now); startDate.setDate(startDate.getDate() - 30);
      groupBy = (d: Date) => format(d, 'dd/MM');
    } else {
      startDate = new Date(now); startDate.setMonth(startDate.getMonth() - 6);
      groupBy = (d: Date) => format(d, 'MMM yyyy');
    }
    const filtered = allEntries.filter(e => new Date(e.date) >= startDate);
    const grouped = new Map<string, number>();
    filtered.forEach(entry => {
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
      const dayOfWeek = getDay(entry.date);
      dayStats.set(dayOfWeek, (dayStats.get(dayOfWeek) || 0) + calculateStandardDrinks(entry));
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

  const getGoalStatus = (consumption: number, limit: number): 'safe' | 'warn' | 'danger' => {
    if (limit === 0) return 'safe';
    const p = (consumption / limit) * 100;
    if (p >= 100) return 'danger';
    if (p >= 80) return 'warn';
    return 'safe';
  };

  if (loading) {
    return (
      <Page>
        <PageHeader eyebrow="Overview" title="Dashboard" />
        <PageBody>
          <div className="flex items-center justify-center py-24 text-sm text-ink3">Loading…</div>
        </PageBody>
      </Page>
    );
  }

  const trend = getTrendData();
  const typeData = getDrinkTypeData();
  const dowData = getDayOfWeekData();
  const totalEntries = allEntries.length;
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  const weeklyStatus = weeklyGoal?.isActive ? getGoalStatus(weeklyConsumption, weeklyGoal.limit) : null;
  const monthlyStatus = monthlyGoal?.isActive ? getGoalStatus(monthlyConsumption, monthlyGoal.limit) : null;
  const heaviestDay = [...dowData].sort((a, b) => b.drinks - a.drinks)[0];
  const topType = typeData[0];

  return (
    <Page>
      <PageHeader
        eyebrow={format(now, 'EEEE, dd MMM')}
        title={greeting}
        actions={
          <Link to="/add">
            <Button variant="primary"><IconPlus /> Log entry</Button>
          </Link>
        }
      />

      <PageBody>
        {/* Hero stat row - colored tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard
            label="Today"
            value={todayStats ? todayStats.totalMl.toFixed(0) : '0'}
            unit="ml"
            hint={todayStats && todayStats.entries.length > 0
              ? `${todayStats.entries.length} ${todayStats.entries.length === 1 ? 'drink' : 'drinks'} · ${todayStats.totalAlcohol.toFixed(1)} ml pure`
              : 'Nothing logged yet'}
            accent="blue"
            icon={<IconGlass width={14} height={14} />}
          />
          <StatCard
            label="This week"
            value={weeklyConsumption.toFixed(1)}
            unit="std"
            hint={weeklyGoal?.isActive ? `${Math.round((weeklyConsumption / weeklyGoal.limit) * 100)}% of ${weeklyGoal.limit}` : 'No goal set'}
            accent={weeklyStatus === 'danger' ? 'red' : weeklyStatus === 'warn' ? 'amber' : 'green'}
            icon={<IconChart width={14} height={14} />}
          />
          <StatCard
            label="This month"
            value={monthlyConsumption.toFixed(1)}
            unit="std"
            hint={monthlyGoal?.isActive ? `${Math.round((monthlyConsumption / monthlyGoal.limit) * 100)}% of ${monthlyGoal.limit}` : 'No goal set'}
            accent={monthlyStatus === 'danger' ? 'red' : monthlyStatus === 'warn' ? 'amber' : 'purple'}
            icon={<IconTarget width={14} height={14} />}
          />
          <StatCard
            label="All time"
            value={totalEntries.toString()}
            unit={totalEntries === 1 ? 'entry' : 'entries'}
            hint={allEntries[0] ? `Latest ${format(allEntries[0].date, 'dd MMM HH:mm')}` : 'Not started yet'}
            accent="amber"
            icon={<IconList width={14} height={14} />}
          />
        </div>

        {/* Quick log */}
        <Card className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-medium text-ink flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#efe7f4] dark:bg-[#251b31] text-[#6a3f8c] dark:text-[#c3a2df]"><IconGlass width={13} height={13} /></span>
                Quick log
              </div>
              <div className="text-2xs text-ink3 mt-0.5">One tap to pre-fill the entry form</div>
            </div>
            <Link to="/library" className="text-xs text-ink3 hover:text-ink flex items-center gap-1">Library <IconArrowRight width={10} height={10} /></Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { type: 'Beer',     hint: '650 ml · 5%' },
              { type: 'Whisky',   hint: '30 ml · 40%' },
              { type: 'Rum',      hint: '30 ml · 40%' },
              { type: 'Vodka',    hint: '30 ml · 40%' },
              { type: 'Cocktail', hint: '150 ml · 15%' },
              { type: 'Other',    hint: '100 ml · 10%' },
            ].map((t) => {
              const c = typeColor(t.type, '#4d4a44');
              return (
                <Link
                  key={t.type}
                  to={`/add?type=${encodeURIComponent(t.type)}`}
                  className="group relative rounded-lg border border-rule bg-paper2 hover:bg-paper3 hover:border-rule2 transition-colors overflow-hidden"
                >
                  <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: c }} />
                  <div className="p-3">
                    <div className="text-sm font-medium text-ink">{t.type}</div>
                    <div className="text-2xs text-ink3 font-mono tabular mt-0.5">{t.hint}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Goals - colored bars, big numbers */}
        {(weeklyGoal?.isActive || monthlyGoal?.isActive) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {weeklyGoal?.isActive && (
              <GoalCard label="Weekly goal" consumption={weeklyConsumption} limit={weeklyGoal.limit} status={weeklyStatus!} type="weekly" />
            )}
            {monthlyGoal?.isActive && (
              <GoalCard label="Monthly goal" consumption={monthlyConsumption} limit={monthlyGoal.limit} status={monthlyStatus!} type="monthly" />
            )}
          </div>
        ) : (
          <div className="mb-8">
            <Empty
              title="Set a soft limit"
              description="Give yourself a weekly or monthly target and the dashboard will show you where you are."
              action={<Link to="/goals"><Button variant="primary"><IconTarget /> Set goals</Button></Link>}
            />
          </div>
        )}

        {/* Trend */}
        <Card className="mb-8">
          <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
            <div>
              <div className="text-sm font-medium text-ink flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#eaf2fb] dark:bg-[#1c2a3e] text-[#1e4785] dark:text-[#a9c4ea]"><IconChart width={13} height={13} /></span>
                Consumption trend
              </div>
              <div className="text-2xs text-ink3 mt-0.5">Standard drinks over time</div>
            </div>
            <div className="inline-flex bg-paper3 rounded-full p-0.5">
              <button
                onClick={() => setChartPeriod('week')}
                className={cx('h-7 px-3 text-xs font-medium rounded-full transition-colors',
                  chartPeriod === 'week' ? 'bg-paper2 text-ink shadow-sm' : 'text-ink3 hover:text-ink')}
              >
                30 days
              </button>
              <button
                onClick={() => setChartPeriod('month')}
                className={cx('h-7 px-3 text-xs font-medium rounded-full transition-colors',
                  chartPeriod === 'month' ? 'bg-paper2 text-ink shadow-sm' : 'text-ink3 hover:text-ink')}
              >
                6 months
              </button>
            </div>
          </div>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: -12, bottom: 24 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#305a9a" stopOpacity={0.28}/>
                    <stop offset="100%" stopColor="#305a9a" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={50} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--rule-2)', strokeWidth: 1 }} />
                <Area
                  type="monotone" dataKey="drinks" stroke="#305a9a" strokeWidth={2.25}
                  fill="url(#trendFill)"
                  dot={{ fill: '#305a9a', r: 2.5, stroke: 'var(--paper-2)', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: '#305a9a', stroke: 'var(--paper-2)', strokeWidth: 2 }}
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-16 text-sm text-ink3">Log a few entries to see a trend.</div>
          )}
        </Card>

        {/* Two-column analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <Card>
            <div className="text-sm font-medium text-ink flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#f5ecdd] dark:bg-[#302512] text-[#764a10] dark:text-[#d8b276]"><IconGlass width={13} height={13} /></span>
              By drink type
            </div>
            <div className="text-2xs text-ink3 mb-4">Total standard drinks per category</div>
            {typeData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={Math.max(140, typeData.length * 34)}>
                  <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={92} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--paper-3)' }} />
                    <Bar dataKey="drinks" radius={[0, 6, 6, 0]}>
                      {typeData.map((e, i) => <Cell key={i} fill={typeColor(e.name, SERIES[i % SERIES.length])} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 border-t border-rule pt-3 grid gap-2">
                  {typeData.map((t, i) => {
                    const total = typeData.reduce((sum, x) => sum + x.drinks, 0) || 1;
                    const pct = (t.drinks / total) * 100;
                    const c = typeColor(t.name, SERIES[i % SERIES.length]);
                    return (
                      <div key={t.name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="inline-flex items-center gap-2 text-ink">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                            <span className="font-medium">{t.name}</span>
                          </span>
                          <span className="text-ink font-mono tabular">
                            {t.drinks.toFixed(1)} <span className="text-ink3">· {Math.round(pct)}%</span>
                          </span>
                        </div>
                        <div className="h-1 bg-paper3 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: c }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {topType && (
                  <div className="mt-4">
                    <Callout tone="amber" title={`${topType.name} is your most-logged drink`}>
                      It makes up {Math.round((topType.drinks / typeData.reduce((s, x) => s + x.drinks, 0)) * 100)}% of your standard drinks all time.
                    </Callout>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-sm text-ink3">No data yet.</div>
            )}
          </Card>

          <Card>
            <div className="text-sm font-medium text-ink flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#efe7f4] dark:bg-[#251b31] text-[#6a3f8c] dark:text-[#c3a2df]"><IconClock width={13} height={13} /></span>
              By day of week
            </div>
            <div className="text-2xs text-ink3 mb-4">Which days lean heaviest</div>
            {dowData.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={dowData} cx="50%" cy="50%" innerRadius={48} outerRadius={82} dataKey="drinks" paddingAngle={2} strokeWidth={0}>
                      {dowData.map((_e, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 border-t border-rule pt-3 grid gap-2">
                  {[...dowData].sort((a, b) => b.drinks - a.drinks).map((d) => {
                    const total = dowData.reduce((sum, x) => sum + x.drinks, 0) || 1;
                    const colorIdx = dowData.findIndex((x) => x.name === d.name);
                    const c = SERIES[colorIdx % SERIES.length];
                    const pct = (d.drinks / total) * 100;
                    return (
                      <div key={d.name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="inline-flex items-center gap-2 text-ink">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                            <span className="font-medium">{d.name}</span>
                          </span>
                          <span className="text-ink font-mono tabular">
                            {d.drinks.toFixed(1)} <span className="text-ink3">· {Math.round(pct)}%</span>
                          </span>
                        </div>
                        <div className="h-1 bg-paper3 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: c }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {heaviestDay && (
                  <div className="mt-4">
                    <Callout tone="purple" title={`${heaviestDay.name} is your heaviest day`}>
                      Track the pattern to notice what's driving it — occasion, routine, or something else.
                    </Callout>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-ink3">No data yet.</div>
            )}
          </Card>
        </div>

        {/* Last 7 days list with per-day mini bars */}
        <Card padded={false}>
          <div className="flex items-baseline justify-between p-5 pb-3">
            <div>
              <div className="text-sm font-medium text-ink flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#e9f2e6] dark:bg-[#1a2b1f] text-[#2a5c2a] dark:text-[#a5cfa8]"><IconList width={13} height={13} /></span>
                Last 7 days
              </div>
              <div className="text-2xs text-ink3 mt-0.5">Day-by-day rollup</div>
            </div>
            <Link to="/history" className="text-xs text-ink3 hover:text-ink flex items-center gap-1">Full history <IconArrowRight width={10} height={10} /></Link>
          </div>
          {weekStats.length > 0 ? (
            <div className="divide-y divide-rule border-t border-rule">
              {(() => {
                const max = Math.max(...weekStats.map(s => s.totalMl), 1);
                return weekStats.map((stat) => {
                  const pct = (stat.totalMl / max) * 100;
                  return (
                    <div key={stat.date} className="px-5 py-3 hover:bg-paper3/40 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-sm text-ink">{format(new Date(stat.date), 'EEEE, dd MMM')}</div>
                        <div className="flex gap-4 text-xs font-mono tabular text-ink2">
                          <span>{stat.totalMl.toFixed(0)} ml</span>
                          <span>{stat.totalAlcohol.toFixed(1)} pure</span>
                          <span>{stat.entries.length} {stat.entries.length === 1 ? 'drink' : 'drinks'}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-paper3 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-500 ease-out"
                          style={{ width: `${pct}%`, background: '#305a9a' }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-ink3 border-t border-rule">Nothing this week yet.</div>
          )}
        </Card>
      </PageBody>
    </Page>
  );
}

const STATUS_COLOR = {
  safe:   { bar: '#3f7a3f', bg: 'bg-[#e9f2e6] dark:bg-[#1a2b1f]', ink: 'text-[#2a5c2a] dark:text-[#a5cfa8]', badge: 'success' as const },
  warn:   { bar: '#8e5d17', bg: 'bg-[#f5ecdd] dark:bg-[#302512]', ink: 'text-[#764a10] dark:text-[#d8b276]', badge: 'warn' as const },
  danger: { bar: '#9c2e2e', bg: 'bg-[#f6e6e3] dark:bg-[#331915]', ink: 'text-[#8a2721] dark:text-[#e5a49c]', badge: 'danger' as const },
};

function GoalCard({
  label, consumption, limit, status, type,
}: {
  label: string;
  consumption: number;
  limit: number;
  status: 'safe' | 'warn' | 'danger';
  type: 'weekly' | 'monthly';
}) {
  const s = STATUS_COLOR[status];
  const pct = limit > 0 ? Math.round((consumption / limit) * 100) : 0;
  const remaining = Math.max(0, limit - consumption);
  const badgeLabel = status === 'danger' ? 'Over limit' : status === 'warn' ? 'Approaching' : 'On track';

  return (
    <div className={cx('relative rounded-xl border border-rule/70 p-5', s.bg)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cx('inline-flex items-center justify-center w-7 h-7 rounded-md text-white', 'shrink-0')} style={{ background: s.bar }}>
            <IconTarget width={13} height={13} />
          </span>
          <div>
            <div className={cx('text-2xs uppercase tracking-[0.08em] font-semibold', s.ink)}>{label}</div>
            <div className="text-2xs text-ink3 font-mono tabular">{type === 'weekly' ? 'This week' : 'This month'}</div>
          </div>
        </div>
        <Badge tone={s.badge}>{badgeLabel}</Badge>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className={cx('text-[32px] leading-none font-semibold tabular tracking-[-0.02em]', s.ink)}>{consumption.toFixed(1)}</span>
        <span className="text-sm text-ink3 font-mono">/ {limit} std</span>
      </div>

      <div className="h-2.5 bg-paper3 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-500 ease-out relative" style={{ width: `${Math.min(100, pct)}%`, background: s.bar }}>
          {consumption > limit && (
            <div className="absolute inset-0 bg-white/30 dark:bg-black/20" />
          )}
        </div>
      </div>

      <div className="flex justify-between text-2xs mt-2 font-mono tabular">
        <span className="text-ink3">{pct}%</span>
        <span className={s.ink}>
          {status === 'danger' ? `+${(consumption - limit).toFixed(1)} over` : `${remaining.toFixed(1)} remaining`}
        </span>
      </div>
    </div>
  );
}
