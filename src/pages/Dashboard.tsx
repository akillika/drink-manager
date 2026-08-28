import { useState, useEffect } from 'react';
import { format, getDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlcoholEntry, DailyStats, Goal } from '../types';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Page, PageHeader, Section, Card, Stat, Progress, Empty, Button, Badge, IconArrowRight, IconPlus, IconTarget, cx } from '../components/ui';

// Standard drink = 12.68 ml pure alcohol (10 g / 0.789 g/ml).
const STANDARD_DRINK_ALCOHOL_ML = 12.68;

// Restrained series palette used across all charts. Muted hues, not candy.
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
    if (user) {
      loadStats();
      loadGoals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    calculateGoalProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEntries, weeklyGoal, monthlyGoal]);

  const loadStats = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayQuery = query(
        collection(db, 'entries'),
        where('userId', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(today))
      );
      const todaySnapshot = await getDocs(todayQuery);
      const todayEntries: AlcoholEntry[] = [];
      todaySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        todayEntries.push({ id: docSnap.id, ...data, date: data.date.toDate() } as AlcoholEntry);
      });

      const todayTotal = todayEntries.reduce((sum, e) => sum + e.amount, 0);
      const todayAlcohol = todayEntries.reduce((sum, e) => sum + (e.amount * e.alcoholPercentage / 100), 0);
      setTodayStats({ date: format(today, 'yyyy-MM-dd'), totalMl: todayTotal, totalAlcohol: todayAlcohol, entries: todayEntries });

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekQuery = query(
        collection(db, 'entries'),
        where('userId', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(weekAgo))
      );
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

  const calculateStandardDrinks = (entry: AlcoholEntry): number => {
    const alcoholMl = (entry.amount * entry.alcoholPercentage / 100);
    return alcoholMl / STANDARD_DRINK_ALCOHOL_ML;
  };

  const loadGoals = async () => {
    if (!user) return;
    try {
      const goalsQuery = query(collection(db, 'goals'), where('userId', '==', user.uid));
      const snapshot = await getDocs(goalsQuery);
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const goal: Goal = {
          id: docSnapshot.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Goal;
        if (goal.type === 'weekly') setWeeklyGoal(goal);
        else if (goal.type === 'monthly') setMonthlyGoal(goal);
      });
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const calculateGoalProgress = () => {
    if (allEntries.length === 0) {
      setWeeklyConsumption(0);
      setMonthlyConsumption(0);
      return;
    }
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    weekEnd.setHours(23, 59, 59, 999);
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
    let startDate: Date;
    let groupBy: (date: Date) => string;
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
        <div className="flex items-center justify-center py-24 text-sm text-ink3">Loading…</div>
      </Page>
    );
  }

  const trend = getTrendData();
  const typeData = getDrinkTypeData();
  const dowData = getDayOfWeekData();
  const totalEntries = allEntries.length;

  return (
    <Page>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="A quiet look at what you've been drinking. Numbers, patterns, and the limits you set for yourself."
        actions={
          <Link to="/add">
            <Button variant="primary"><IconPlus /> Log entry</Button>
          </Link>
        }
      />

      {/* Top summary */}
      <Section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule rounded-lg overflow-hidden">
          <div className="bg-paper2 p-5">
            <Stat
              label="Today"
              value={todayStats ? todayStats.totalMl.toFixed(0) : '0'}
              unit="ml"
              hint={todayStats ? `${todayStats.entries.length} ${todayStats.entries.length === 1 ? 'drink' : 'drinks'} · ${todayStats.totalAlcohol.toFixed(1)} ml pure` : 'No entries yet'}
            />
          </div>
          <div className="bg-paper2 p-5">
            <Stat
              label="This week"
              value={weeklyConsumption.toFixed(1)}
              unit="std drinks"
              hint={weeklyGoal?.isActive ? `Limit ${weeklyGoal.limit}` : 'No goal set'}
            />
          </div>
          <div className="bg-paper2 p-5">
            <Stat
              label="This month"
              value={monthlyConsumption.toFixed(1)}
              unit="std drinks"
              hint={monthlyGoal?.isActive ? `Limit ${monthlyGoal.limit}` : 'No goal set'}
            />
          </div>
          <div className="bg-paper2 p-5">
            <Stat
              label="Logged all time"
              value={totalEntries.toString()}
              unit={totalEntries === 1 ? 'entry' : 'entries'}
            />
          </div>
        </div>
      </Section>

      {/* Goals */}
      {(weeklyGoal?.isActive || monthlyGoal?.isActive) ? (
        <Section
          title="Goals"
          actions={<Link to="/goals" className="text-xs text-ink3 hover:text-ink flex items-center gap-1">Edit <IconArrowRight width={12} height={12} /></Link>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {weeklyGoal?.isActive && (
              <GoalCard
                label="Weekly"
                consumption={weeklyConsumption}
                limit={weeklyGoal.limit}
                status={getGoalStatus(weeklyConsumption, weeklyGoal.limit)}
              />
            )}
            {monthlyGoal?.isActive && (
              <GoalCard
                label="Monthly"
                consumption={monthlyConsumption}
                limit={monthlyGoal.limit}
                status={getGoalStatus(monthlyConsumption, monthlyGoal.limit)}
              />
            )}
          </div>
        </Section>
      ) : (
        <Section>
          <Empty
            title="No goals set"
            description="Set a weekly or monthly limit to track progress and get a heads-up when you're approaching it."
            action={<Link to="/goals"><Button variant="primary"><IconTarget /> Set goals</Button></Link>}
          />
        </Section>
      )}

      {/* Trend */}
      <Section
        title="Consumption trend"
        description="Standard drinks over time"
        actions={
          <div className="inline-flex border border-rule rounded-md overflow-hidden">
            <button
              onClick={() => setChartPeriod('week')}
              className={cx(
                'h-8 px-3 text-xs font-medium transition-colors',
                chartPeriod === 'week' ? 'bg-paper3 text-ink' : 'text-ink3 hover:text-ink hover:bg-paper3',
              )}
            >
              Last 30 days
            </button>
            <button
              onClick={() => setChartPeriod('month')}
              className={cx(
                'h-8 px-3 text-xs font-medium transition-colors border-l border-rule',
                chartPeriod === 'month' ? 'bg-paper3 text-ink' : 'text-ink3 hover:text-ink hover:bg-paper3',
              )}
            >
              Last 6 months
            </button>
          </div>
        }
      >
        <Card padded={false} className="p-5">
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: -12, bottom: 24 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--ink)" stopOpacity={0.14}/>
                    <stop offset="100%" stopColor="var(--ink)" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={50} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--rule-2)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="drinks"
                  stroke="var(--ink)"
                  strokeWidth={1.5}
                  fill="url(#trendFill)"
                  dot={{ fill: 'var(--ink)', r: 2, stroke: 'var(--paper-2)', strokeWidth: 1.5 }}
                  activeDot={{ r: 4, fill: 'var(--ink)', stroke: 'var(--paper-2)', strokeWidth: 2 }}
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-16 text-sm text-ink3">Log a few entries to see a trend.</div>
          )}
        </Card>
      </Section>

      {/* Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
        <Section title="By drink type" description="Where your standard drinks come from" className="mb-0">
          <Card>
            {typeData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={Math.max(140, typeData.length * 34)}>
                  <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={92} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--paper-3)' }} />
                    <Bar dataKey="drinks" radius={[0, 3, 3, 0]}>
                      {typeData.map((_e, i) => (
                        <Cell key={i} fill={SERIES[i % SERIES.length]} />
                      ))}
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
        </Section>

        <Section title="By day of week" description="Which days lean heaviest" className="mb-0">
          <Card>
            {dowData.length > 0 ? (
              <div className="grid grid-cols-[1fr_minmax(0,1fr)] gap-4 items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={dowData}
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={80}
                      dataKey="drinks"
                      paddingAngle={1.5}
                      strokeWidth={0}
                    >
                      {dowData.map((_e, i) => (
                        <Cell key={i} fill={SERIES[i % SERIES.length]} />
                      ))}
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
        </Section>
      </div>

      {/* This week list */}
      <Section title="This week" description="Day-by-day rollup">
        <Card padded={false}>
          {weekStats.length > 0 ? (
            <div className="divide-y divide-rule">
              {weekStats.map((stat) => (
                <div key={stat.date} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-ink">{format(new Date(stat.date), 'EEEE, dd MMM')}</span>
                  <div className="flex gap-6 text-xs font-mono tabular text-ink2">
                    <span>{stat.totalMl.toFixed(0)} ml</span>
                    <span>{stat.totalAlcohol.toFixed(1)} ml pure</span>
                    <span>{stat.entries.length} {stat.entries.length === 1 ? 'drink' : 'drinks'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-ink3">No entries this week.</div>
          )}
        </Card>
      </Section>
    </Page>
  );
}

function GoalCard({
  label,
  consumption,
  limit,
  status,
}: {
  label: string;
  consumption: number;
  limit: number;
  status: 'safe' | 'warn' | 'danger';
}) {
  const pct = limit > 0 ? (consumption / limit) * 100 : 0;
  const remaining = Math.max(0, limit - consumption);
  const tone = status === 'danger' ? 'danger' : status === 'warn' ? 'warn' : 'success';
  const badge =
    status === 'danger' ? <Badge tone="danger">Over limit</Badge> :
    status === 'warn' ? <Badge tone="warn">Approaching</Badge> :
    <Badge tone="success">On track</Badge>;
  return (
    <Card>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-xs text-ink3 uppercase tracking-[0.06em] mb-1">{label}</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl text-ink font-medium tabular">{consumption.toFixed(1)}</span>
            <span className="text-ink3 text-sm font-mono">/ {limit} std drinks</span>
          </div>
        </div>
        {badge}
      </div>
      <Progress value={consumption} max={limit || 1} tone={tone} />
      <div className="mt-2 flex justify-between text-xs text-ink3 font-mono tabular">
        <span>{Math.round(pct)}%</span>
        <span>{status === 'danger' ? `+${(consumption - limit).toFixed(1)} over` : `${remaining.toFixed(1)} remaining`}</span>
      </div>
    </Card>
  );
}
