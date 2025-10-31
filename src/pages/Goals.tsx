import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Goal } from '../types';
import { db } from '../config/firebase';
import {
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  where,
} from 'firebase/firestore';

export default function Goals() {
  const { user } = useAuth();
  const [weeklyGoal, setWeeklyGoal] = useState<Goal | null>(null);
  const [monthlyGoal, setMonthlyGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeklyLimit, setWeeklyLimit] = useState(10);
  const [monthlyLimit, setMonthlyLimit] = useState(40);
  const [weeklyActive, setWeeklyActive] = useState(false);
  const [monthlyActive, setMonthlyActive] = useState(false);

  useEffect(() => {
    if (user) {
      loadGoals();
    }
  }, [user]);

  const loadGoals = async () => {
    if (!user) return;
    try {
      setLoading(true);
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
          setWeeklyLimit(goal.limit);
          setWeeklyActive(goal.isActive);
        } else if (goal.type === 'monthly') {
          setMonthlyGoal(goal);
          setMonthlyLimit(goal.limit);
          setMonthlyActive(goal.isActive);
        }
      });
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveGoal = async (type: 'weekly' | 'monthly', limit: number, isActive: boolean) => {
    if (!user) {
      alert('You must be signed in to save a goal.');
      return;
    }
    try {
      const goalData = {
        userId: user.uid,
        type,
        limit,
        isActive,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (type === 'weekly') {
        if (weeklyGoal?.id) {
          await updateDoc(doc(db, 'goals', weeklyGoal.id), {
            ...goalData,
            createdAt: Timestamp.fromDate(weeklyGoal.createdAt),
          });
          setWeeklyGoal({ ...weeklyGoal, ...goalData, createdAt: weeklyGoal.createdAt, updatedAt: new Date() });
        } else {
          const newGoal = await addDoc(collection(db, 'goals'), {
            ...goalData,
            createdAt: Timestamp.fromDate(new Date()),
          });
          setWeeklyGoal({
            id: newGoal.id,
            userId: user.uid,
            type: 'weekly',
            limit,
            isActive,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      } else {
        if (monthlyGoal?.id) {
          await updateDoc(doc(db, 'goals', monthlyGoal.id), {
            ...goalData,
            createdAt: Timestamp.fromDate(monthlyGoal.createdAt),
          });
          setMonthlyGoal({ ...monthlyGoal, ...goalData, createdAt: monthlyGoal.createdAt, updatedAt: new Date() });
        } else {
          const newGoal = await addDoc(collection(db, 'goals'), {
            ...goalData,
            createdAt: Timestamp.fromDate(new Date()),
          });
          setMonthlyGoal({
            id: newGoal.id,
            userId: user.uid,
            type: 'monthly',
            limit,
            isActive,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    } catch (error: any) {
      console.error('Error saving goal:', error);
      alert(`Failed to save ${type} goal: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleWeeklySave = () => {
    saveGoal('weekly', weeklyLimit, weeklyActive);
  };

  const handleMonthlySave = () => {
    saveGoal('monthly', monthlyLimit, monthlyActive);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="animate-fade-in-down">
        <h2 className="text-3xl font-bold text-gray-900">🎯 Goals & Limits</h2>
        <p className="text-sm text-gray-500 mt-1">Set weekly or monthly limits to track your consumption</p>
      </div>

      {/* Weekly Goal */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-indigo-100 card-hover animate-fade-in-up">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold text-gray-900">Weekly Goal</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={weeklyActive}
                onChange={(e) => setWeeklyActive(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-600">Active</span>
            </label>
          </div>
          <p className="text-sm text-gray-500">Set a maximum number of standard drinks per week</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Weekly Limit (Standard Drinks)
            </label>
            <input
              type="number"
              value={weeklyLimit}
              onChange={(e) => setWeeklyLimit(Math.max(0, parseInt(e.target.value) || 0))}
              min="0"
              step="1"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg transition-all duration-200 focus:scale-[1.02]"
              placeholder="e.g., 10"
            />
          </div>
          <button
            onClick={handleWeeklySave}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 font-medium shadow-md button-bounce transition-all duration-200 hover:scale-105 active:scale-95"
          >
            Save Weekly Goal
          </button>
        </div>

        {weeklyGoal && (
          <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-sm text-indigo-700">
              ✓ Weekly goal {weeklyGoal.isActive ? 'active' : 'inactive'}: Max {weeklyGoal.limit} standard drinks
              {weeklyGoal.updatedAt && (
                <span className="ml-2 text-indigo-500">
                  (Updated: {weeklyGoal.updatedAt.toLocaleDateString()})
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Monthly Goal */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100 card-hover animate-fade-in-up animate-stagger-2">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold text-gray-900">Monthly Goal</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={monthlyActive}
                onChange={(e) => setMonthlyActive(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-600">Active</span>
            </label>
          </div>
          <p className="text-sm text-gray-500">Set a maximum number of standard drinks per month</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Limit (Standard Drinks)
            </label>
            <input
              type="number"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(Math.max(0, parseInt(e.target.value) || 0))}
              min="0"
              step="1"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg"
              placeholder="e.g., 40"
            />
          </div>
          <button
            onClick={handleMonthlySave}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 font-medium shadow-md"
          >
            Save Monthly Goal
          </button>
        </div>

        {monthlyGoal && (
          <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-700">
              ✓ Monthly goal {monthlyGoal.isActive ? 'active' : 'inactive'}: Max {monthlyGoal.limit} standard drinks
              {monthlyGoal.updatedAt && (
                <span className="ml-2 text-purple-500">
                  (Updated: {monthlyGoal.updatedAt.toLocaleDateString()})
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <h4 className="font-semibold text-gray-900 mb-2">💡 About Standard Drinks</h4>
        <p className="text-sm text-gray-700 mb-3">
          One standard drink equals <strong>12.68ml of pure alcohol</strong> (equivalent to 10g). This helps you track consumption consistently regardless of drink type.
        </p>
        <p className="text-xs text-gray-600">
          Examples: 650ml beer (5% ABV) ≈ 2.6 drinks • 30ml whisky (40% ABV) ≈ 0.9 drinks • 150ml wine (12% ABV) ≈ 1.4 drinks
        </p>
      </div>
    </div>
  );
}

