import { useState, useEffect } from 'react';
import { format, getDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlcoholEntry, DailyStats, Goal } from '../types';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import {
  Page, PageHeader, PageBody, Card, StatCard, Ring, Button, Badge,
  Empty, IconArrowRight, IconPlus, IconTarget, IconGlass, cx,
} from '../components/ui';

const STANDARD_DRINK_ALCOHOL_ML = 12.68;
const SERIES = ['#3f7a3f', '#305a9a', '#8e5d17', '#9c2e2e', '#6a3f8c', '#a45078', '#4d4a44'];

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

  const toneOf = (s: 'safe' | 'warn' | 'danger'): 'success' | 'warn' | 'danger' =>
    s === 'danger' ? 'danger' : s === 'warn' ? 'warn' : 'success';

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
        {/* Hero stat row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard
            label="Today"
            value={todayStats ? todayStats.totalMl.toFixed(0) : '0'}
            unit="ml"
            hint={todayStats && todayStats.entries.length > 0
              ? `${todayStats.entries.length} ${todayStats.entries.length === 1 ? 'drink' : 'drinks'} · ${todayStats.totalAlcohol.toFixed(1)} ml pure`
              : 'Nothing logged yet'}
            accent="blue"
          />
          <StatCard
            label="This week"
            value={weeklyConsumption.toFixed(1)}
            unit="std"
            hint={weeklyGoal?.isActive ? `${Math.round((weeklyConsumption / weeklyGoal.limit) * 100)}% of ${weeklyGoal.limit}` : 'No goal set'}
            accent={weeklyStatus === 'danger' ? 'red' : weeklyStatus === 'warn' ? 'amber' : 'green'}
          />
          <StatCard
            label="This month"
            value={monthlyConsumption.toFixed(1)}
            unit="std"
            hint={monthlyGoal?.isActive ? `${Math.round((monthlyConsumption / monthlyGoal.limit) * 100)}% of ${monthlyGoal.limit}` : 'No goal set'}
            accent={monthlyStatus === 'danger' ? 'red' : monthlyStatus === 'warn' ? 'amber' : 'purple'}
          />
          <StatCard
            label="All time"
            value={totalEntries.toString()}
            unit={totalEntries === 1 ? 'entry' : 'entries'}
            hint={allEntries[0] ? `Latest ${format(allEntries[0].date, 'dd MMM HH:mm')}` : 'Not started yet'}
            accent="amber"
          />
        </div>

        {/* Quick log */}
        <Card className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-medium text-ink flex items-center gap-2"><IconGlass /> Quick log</div>
              <div className="text-2xs text-ink3">Pre-fill the form with a common drink</div>
            </div>
            <Link to="/library" className="text-2xs text-ink3 hover:text-ink flex items-center gap-1">Library <IconArrowRight width={10} height={10} /></Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { type: 'Beer', hint: '650 ml · 5%' },
              { type: 'Whisky', hint: '30 ml · 40%' },
              { type: 'Rum', hint: '30 ml · 40%' },
              { type: 'Vodka', hint: '30 ml · 40%' },
              { type: 'Cocktail', hint: '150 ml · 15%' },
              { type: 'Other', hint: '100 ml · 10%' },
            ].map((t) => (
              <Link key={t.type} to={`/add?type=${encodeURIComponent(t.type)}`} className="inline-flex flex-col items-start gap-0.5 h-auto px-3 py-2 rounded-md text-xs font-medium border border-rule bg-paper2 hover:bg-paper3 hover:border-rule2 transition-colors">
                <span className="text-ink">{t.type}</span>
                <span className="text-2xs text-ink3 font-mono tabular">{t.hint}</span>
              </Link>
            ))}
          </div>
        </Card>

        {/* Goal rings */}
        {(weeklyGoal?.isActive || monthlyGoal?.isActive) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {weeklyGoal?.isActive && (
              <GoalRingCard label="Weekly goal" consumption={weeklyConsumption} limit={weeklyGoal.limit} status={weeklyStatus!} toneOf={toneOf} />
            )}
            {monthlyGoal?.isActive && (
              <GoalRingCard label="Monthly goal" consumption={monthlyConsumption} limit={monthlyGoal.limit} status={monthlyStatus!} toneOf={toneOf} />
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

        {/* Trend chart */}
        <Card className="mb-8">
          <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
            <div>
              <div className="text-sm font-medium text-ink">Consumption trend</div>
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
                    <stop offset="0%" stopColor="var(--ink)" stopOpacity={0.16}/>
                    <stop offset="100%" stopColor="var(--ink)" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={50} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--rule-2)', strokeWidth: 1 }} />
                <Area
                  type="monotone" dataKey="drinks" stroke="var(--ink)" strokeWidth={2}
                  fill="url(#trendFill)"
                  dot={{ fill: 'var(--ink)', r: 2.5, stroke: 'var(--paper-2)', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: 'var(--ink)', stroke: 'var(--paper-2)', strokeWidth: 2 }}
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
            <div className="text-sm font-medium text-ink mb-1">By drink type</div>
            <div className="text-2xs text-ink3 mb-4">Total standard drinks per category</div>
            {typeData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={Math.max(140, typeData.length * 32)}>
                  <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={92} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--paper-3)' }} />
                    <Bar dataKey="drinks" radius={[0, 4, 4, 0]}>
                      {typeData.map((_e, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 border-t border-rule pt-3 grid gap-1.5">
                  {typeData.map((t, i) => {
                    const total = typeData.reduce((sum, x) => sum + x.drinks, 0) || 1;
                    return (
                      <div key={t.name} className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-2 text-ink2">
                          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />
                          {t.name}
                        </span>
                        <span className="text-ink font-mono tabular">
                          {t.drinks.toFixed(1)} <span className="text-ink3">· {Math.round((t.drinks / total) * 100)}%</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-sm text-ink3">No data yet.</div>
            )}
          </Card>

          <Card>
            <div className="text-sm font-medium text-ink mb-1">By day of week</div>
            <div className="text-2xs text-ink3 mb-4">Which days lean heaviest</div>
            {dowData.length > 0 ? (
              <div className="grid grid-cols-[1fr_minmax(0,1fr)] gap-4 items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={dowData} cx="50%" cy="50%" innerRadius={44} outerRadius={80} dataKey="drinks" paddingAngle={1.5} strokeWidth={0}>
                      {dowData.map((_e, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid gap-1.5">
                  {[...dowData].sort((a, b) => b.drinks - a.drinks).map((d) => {
                    const total = dowData.reduce((sum, x) => sum + x.drinks, 0) || 1;
                    const colorIdx = dowData.findIndex((x) => x.name === d.name);
                    return (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-2 text-ink2">
                          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: SERIES[colorIdx % SERIES.length] }} />
                          {d.name}
                        </span>
                        <span className="text-ink font-mono tabular">
                          {d.drinks.toFixed(1)} <span className="text-ink3">· {Math.round((d.drinks / total) * 100)}%</span>
                        </span>
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

        {/* This week list */}
        <Card padded={false}>
          <div className="flex items-baseline justify-between p-5 pb-3">
            <div>
              <div className="text-sm font-medium text-ink">Last 7 days</div>
              <div className="text-2xs text-ink3 mt-0.5">Day-by-day rollup</div>
            </div>
            <Link to="/history" className="text-2xs text-ink3 hover:text-ink flex items-center gap-1">Full history <IconArrowRight width={10} height={10} /></Link>
          </div>
          {weekStats.length > 0 ? (
            <div className="divide-y divide-rule border-t border-rule">
              {weekStats.map((stat) => (
                <div key={stat.date} className="flex items-center justify-between px-5 py-3 hover:bg-paper3/40 transition-colors">
                  <div>
                    <div className="text-sm text-ink">{format(new Date(stat.date), 'EEEE, dd MMM')}</div>
                    <div className="text-2xs text-ink3 mt-0.5">{stat.entries.length} {stat.entries.length === 1 ? 'drink' : 'drinks'}</div>
                  </div>
                  <div className="flex gap-6 text-xs font-mono tabular text-ink2">
                    <span>{stat.totalMl.toFixed(0)} ml</span>
                    <span>{stat.totalAlcohol.toFixed(1)} ml pure</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-ink3 border-t border-rule">Nothing this week yet.</div>
          )}
        </Card>
      </PageBody>
    </Page>
  );
}

function GoalRingCard({
  label, consumption, limit, status, toneOf,
}: {
  label: string;
  consumption: number;
  limit: number;
  status: 'safe' | 'warn' | 'danger';
  toneOf: (s: 'safe' | 'warn' | 'danger') => 'success' | 'warn' | 'danger';
}) {
  const tone = toneOf(status);
  const pct = limit > 0 ? Math.round((consumption / limit) * 100) : 0;
  const remaining = Math.max(0, limit - consumption);
  const badge =
    status === 'danger' ? <Badge tone="danger">Over</Badge> :
    status === 'warn' ? <Badge tone="warn">Close</Badge> :
    <Badge tone="success">On track</Badge>;

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xs uppercase tracking-[0.06em] text-ink3 mb-2">{label}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-medium text-ink tabular tracking-[-0.02em]">{consumption.toFixed(1)}</span>
            <span className="text-sm text-ink3 font-mono">/ {limit}</span>
          </div>
          <div className="text-2xs text-ink3 mt-1 tabular">
            {status === 'danger' ? `${(consumption - limit).toFixed(1)} over limit` : `${remaining.toFixed(1)} remaining`}
          </div>
          <div className="mt-3">{badge}</div>
        </div>
        <Ring value={consumption} max={limit || 1} size={96} stroke={7} tone={tone}>
          <div className="text-center">
            <div className="text-lg font-medium text-ink tabular">{pct}<span className="text-xs text-ink3 font-mono">%</span></div>
          </div>
        </Ring>
      </div>
    </Card>
  );
}
