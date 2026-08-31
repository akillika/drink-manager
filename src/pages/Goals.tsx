import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Goal } from '../types';
import { db } from '../config/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, Timestamp, where } from 'firebase/firestore';
import { PageBody, Button, IconTarget, IconGlass, IconChart, cx } from '../components/ui';
import { DEMO_MODE } from '../config/demo';
import { DEMO_GOALS } from '../config/demoData';

export default function Goals() {
  const { user } = useAuth();
  const [weeklyGoal, setWeeklyGoal] = useState<Goal | null>(null);
  const [monthlyGoal, setMonthlyGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeklyLimit, setWeeklyLimit] = useState(10);
  const [monthlyLimit, setMonthlyLimit] = useState(40);
  const [weeklyActive, setWeeklyActive] = useState(false);
  const [monthlyActive, setMonthlyActive] = useState(false);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [savingMonthly, setSavingMonthly] = useState(false);

  useEffect(() => {
    if (user) loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadGoals = async () => {
    if (!user) return;
    if (DEMO_MODE) {
      DEMO_GOALS.forEach((goal) => {
        if (goal.type === 'weekly') { setWeeklyGoal(goal); setWeeklyLimit(goal.limit); setWeeklyActive(goal.isActive); }
        else if (goal.type === 'monthly') { setMonthlyGoal(goal); setMonthlyLimit(goal.limit); setMonthlyActive(goal.isActive); }
      });
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const snapshot = await getDocs(query(collection(db, 'goals'), where('userId', '==', user.uid)));
      snapshot.forEach((d) => {
        const data = d.data();
        const goal: Goal = { id: d.id, ...data, createdAt: data.createdAt.toDate(), updatedAt: data.updatedAt.toDate() } as Goal;
        if (goal.type === 'weekly') { setWeeklyGoal(goal); setWeeklyLimit(goal.limit); setWeeklyActive(goal.isActive); }
        else if (goal.type === 'monthly') { setMonthlyGoal(goal); setMonthlyLimit(goal.limit); setMonthlyActive(goal.isActive); }
      });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const saveGoal = async (type: 'weekly' | 'monthly', limit: number, isActive: boolean) => {
    if (!user) return;
    const setSaving = type === 'weekly' ? setSavingWeekly : setSavingMonthly;
    if (DEMO_MODE) {
      setSaving(true);
      const existing = type === 'weekly' ? weeklyGoal : monthlyGoal;
      const updated: Goal = existing
        ? { ...existing, limit, isActive, updatedAt: new Date() }
        : { id: `demo-${type}`, userId: user.uid, type, limit, isActive, createdAt: new Date(), updatedAt: new Date() };
      if (type === 'weekly') setWeeklyGoal(updated); else setMonthlyGoal(updated);
      setTimeout(() => setSaving(false), 300);
      return;
    }
    try {
      setSaving(true);
      const goalData = { userId: user.uid, type, limit, isActive, updatedAt: Timestamp.fromDate(new Date()) };
      const existing = type === 'weekly' ? weeklyGoal : monthlyGoal;
      if (existing?.id) {
        await updateDoc(doc(db, 'goals', existing.id), { ...goalData, createdAt: Timestamp.fromDate(existing.createdAt) });
        const updated = { ...existing, ...goalData, createdAt: existing.createdAt, updatedAt: new Date() };
        if (type === 'weekly') setWeeklyGoal(updated); else setMonthlyGoal(updated);
      } else {
        const newGoal = await addDoc(collection(db, 'goals'), { ...goalData, createdAt: Timestamp.fromDate(new Date()) });
        const created: Goal = { id: newGoal.id, userId: user.uid, type, limit, isActive, createdAt: new Date(), updatedAt: new Date() };
        if (type === 'weekly') setWeeklyGoal(created); else setMonthlyGoal(created);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Failed to save ${type} goal: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="sticky top-12 md:top-0 z-10 bg-bg/95 md:bg-bg2/85 backdrop-blur border-b border-separator px-4 md:px-8 py-3 md:py-4 rise">
        <div className="text-[10px] md:text-2xs uppercase tracking-[0.08em] font-semibold text-ink3">Limits</div>
        <h1 className="text-lg md:text-2xl font-bold text-ink tracking-[-0.02em]">Goals</h1>
      </div>

      <PageBody className="!px-4 md:!px-8 !py-4 md:!py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-sm text-ink3">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
              <GoalEditor
                title="Weekly limit"
                subtitle="Standard drinks per week"
                color="var(--green)"
                limit={weeklyLimit}
                setLimit={setWeeklyLimit}
                active={weeklyActive}
                setActive={setWeeklyActive}
                onSave={() => saveGoal('weekly', weeklyLimit, weeklyActive)}
                saving={savingWeekly}
                goal={weeklyGoal}
              />
              <GoalEditor
                title="Monthly limit"
                subtitle="Standard drinks per month"
                color="var(--purple)"
                limit={monthlyLimit}
                setLimit={setMonthlyLimit}
                active={monthlyActive}
                setActive={setMonthlyActive}
                onSave={() => saveGoal('monthly', monthlyLimit, monthlyActive)}
                saving={savingMonthly}
                goal={monthlyGoal}
              />
            </div>

            <div className="bg-card rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: 'var(--orange)22', color: 'var(--orange)' }}>
                  <IconChart />
                </span>
                <div>
                  <div className="text-md font-semibold text-ink">How the math works</div>
                  <div className="text-xs text-ink3">One standard drink = 12.68 ml pure alcohol (10 g)</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ExampleCard color="var(--orange)" title="A pint of beer" spec="650 ml · 5%"    drinks="≈ 2.6 std" />
                <ExampleCard color="var(--pink)"   title="A glass of wine" spec="150 ml · 12%" drinks="≈ 1.4 std" />
                <ExampleCard color="var(--brown)"  title="A shot of whisky" spec="30 ml · 40%" drinks="≈ 0.9 std" />
              </div>
            </div>
          </>
        )}
      </PageBody>
    </div>
  );
}

function GoalEditor({
  title, subtitle, color, limit, setLimit, active, setActive, onSave, saving, goal,
}: {
  title: string; subtitle: string; color: string;
  limit: number; setLimit: (n: number) => void;
  active: boolean; setActive: (v: boolean) => void;
  onSave: () => void; saving: boolean; goal: Goal | null;
}) {
  return (
    <div className="rounded-3xl p-6 border border-separator" style={{ background: `linear-gradient(160deg, ${color}18 0%, var(--card) 65%)` }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl" style={{ background: `${color}30`, color }}>
            <IconTarget width={17} height={17} />
          </span>
          <div>
            <div className="text-md font-bold text-ink">{title}</div>
            <div className="text-xs text-ink3">{subtitle}</div>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <div className={cx('relative w-11 h-6 rounded-full transition-colors', active ? 'bg-green' : 'bg-bg4')}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="sr-only"
            />
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow"
              style={{ left: active ? 'calc(100% - 22px)' : '2px' }}
            />
          </div>
        </label>
      </div>

      <div className="mb-5">
        <div className="text-2xs uppercase tracking-[0.08em] font-semibold text-ink3 mb-2">Limit</div>
        <div className="flex items-baseline gap-2">
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(Math.max(0, parseInt(e.target.value) || 0))}
            min={0}
            step={1}
            className="text-5xl font-bold tabular tracking-[-0.03em] bg-transparent outline-none w-24"
            style={{ color }}
          />
          <span className="text-md text-ink3 font-medium">std drinks</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={onSave} disabled={saving} className="!bg-ink !text-bg2 !border-ink hover:brightness-110">
          {saving ? 'Saving…' : goal ? 'Update' : 'Set goal'}
        </Button>
        {goal && (
          <span className="text-xs text-ink3 font-mono tabular">
            Updated {goal.updatedAt.toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

function ExampleCard({ color, title, spec, drinks }: { color: string; title: string; spec: string; drinks: string }) {
  return (
    <div className="bg-card2 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl" style={{ background: `${color}22`, color }}>
          <IconGlass width={13} height={13} />
        </span>
        <div className="text-sm font-semibold text-ink">{title}</div>
      </div>
      <div className="text-xs text-ink2 font-mono tabular">{spec}</div>
      <div className="text-xs font-semibold mt-1 tabular" style={{ color }}>{drinks}</div>
    </div>
  );
}
