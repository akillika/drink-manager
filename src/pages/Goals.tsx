import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Goal } from '../types';
import { db } from '../config/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, Timestamp, where } from 'firebase/firestore';
import { Page, PageHeader, PageBody, Section, Card, Button, Field, Input, Badge } from '../components/ui';

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
    try {
      setLoading(true);
      const goalsQuery = query(collection(db, 'goals'), where('userId', '==', user.uid));
      const snapshot = await getDocs(goalsQuery);
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const goal: Goal = {
          id: docSnapshot.id, ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Goal;
        if (goal.type === 'weekly') {
          setWeeklyGoal(goal); setWeeklyLimit(goal.limit); setWeeklyActive(goal.isActive);
        } else if (goal.type === 'monthly') {
          setMonthlyGoal(goal); setMonthlyLimit(goal.limit); setMonthlyActive(goal.isActive);
        }
      });
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveGoal = async (type: 'weekly' | 'monthly', limit: number, isActive: boolean) => {
    if (!user) return alert('You must be signed in to save a goal.');
    const setSaving = type === 'weekly' ? setSavingWeekly : setSavingMonthly;
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
    } catch (error: any) {
      console.error('Error saving goal:', error);
      alert(`Failed to save ${type} goal: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <PageHeader eyebrow="Limits" title="Goals" />
        <PageBody>
          <div className="flex items-center justify-center py-24 text-sm text-ink3">Loading…</div>
        </PageBody>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Limits"
        title="Goals"
        description="Set a soft ceiling for how much you plan to drink each week or month. Purely for your own reference."
      />

      <PageBody>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <GoalEditor
          title="Weekly limit"
          hint="Standard drinks per week"
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
          hint="Standard drinks per month"
          limit={monthlyLimit}
          setLimit={setMonthlyLimit}
          active={monthlyActive}
          setActive={setMonthlyActive}
          onSave={() => saveGoal('monthly', monthlyLimit, monthlyActive)}
          saving={savingMonthly}
          goal={monthlyGoal}
        />
      </div>

      <Section title="About standard drinks">
        <Card>
          <p className="text-sm text-ink2 mb-3">
            One standard drink is <strong className="text-ink">12.68 ml of pure alcohol</strong>, about 10 grams. This makes weekly and monthly totals comparable across beer, wine and spirits.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <ExampleRow amount="650 ml" abv="5% ABV" drinks="≈ 2.6 drinks" label="A pint of beer" />
            <ExampleRow amount="150 ml" abv="12% ABV" drinks="≈ 1.4 drinks" label="A glass of wine" />
            <ExampleRow amount="30 ml" abv="40% ABV" drinks="≈ 0.9 drinks" label="A shot of whisky" />
          </div>
        </Card>
      </Section>
      </PageBody>
    </Page>
  );
}

function GoalEditor({
  title, hint, limit, setLimit, active, setActive, onSave, saving, goal,
}: {
  title: string; hint: string;
  limit: number; setLimit: (n: number) => void;
  active: boolean; setActive: (v: boolean) => void;
  onSave: () => void; saving: boolean; goal: Goal | null;
}) {
  return (
    <Card>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-md font-medium text-ink">{title}</h2>
          <p className="text-xs text-ink3 mt-0.5">{hint}</p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-rule2 text-ink focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-ink2">Active</span>
        </label>
      </div>

      <Field label="Limit (standard drinks)">
        <Input type="number" min={0} step={1} value={limit} onChange={(e) => setLimit(Math.max(0, parseInt(e.target.value) || 0))} />
      </Field>

      <div className="flex items-center gap-3 mt-4">
        <Button variant="primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {goal && (
          <div className="text-xs text-ink3 flex items-center gap-2">
            <Badge tone={goal.isActive ? 'success' : 'neutral'}>{goal.isActive ? 'Active' : 'Paused'}</Badge>
            <span className="font-mono tabular">Updated {goal.updatedAt.toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function ExampleRow({ amount, abv, drinks, label }: { amount: string; abv: string; drinks: string; label: string }) {
  return (
    <div className="border border-rule rounded-md p-3">
      <div className="text-xs text-ink3 mb-1">{label}</div>
      <div className="text-sm font-mono tabular text-ink">{amount} · {abv}</div>
      <div className="text-xs text-ink3 mt-1">{drinks}</div>
    </div>
  );
}
