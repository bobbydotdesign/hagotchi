import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  initNetworkListener,
  getNetworkStatus,
  saveHabitsLocally,
  loadHabitsLocally,
  queueForSync,
  getPendingSync,
  clearPendingSync,
  updateLastSync
} from '../services/offlineStorage';

export const useOfflineSync = (userId) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Sync pending actions to Supabase
  const syncPendingActions = useCallback(async () => {
    if (!userId || isSyncing) return;

    const pending = await getPendingSync();
    if (pending.length === 0) return;

    setIsSyncing(true);

    try {
      for (const action of pending) {
        switch (action.type) {
          case 'UPDATE_HABIT':
            await supabase
              .from('habits')
              .update(action.data.updates)
              .eq('id', action.data.habitId)
              .eq('user_id', userId);
            break;

          case 'CREATE_HABIT':
            await supabase
              .from('habits')
              .insert({ ...action.data, user_id: userId });
            break;

          case 'DELETE_HABIT':
            await supabase
              .from('habits')
              .delete()
              .eq('id', action.data.habitId)
              .eq('user_id', userId);
            break;

          case 'RECORD_COMPLETION':
            await supabase
              .from('completions')
              .upsert({
                user_id: userId,
                habit_id: action.data.habitId,
                completed_date: action.data.date,
                completion_count: action.data.completionCount,
                daily_goal: action.data.dailyGoal
              }, { onConflict: 'habit_id,completed_date' });
            break;
        }
      }

      await clearPendingSync();
      await updateLastSync();
      setPendingCount(0);

    } catch (error) {
      console.error('Error syncing pending actions:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [userId, isSyncing]);

  // Initialize network listener
  useEffect(() => {
    initNetworkListener((online) => {
      setIsOnline(online);
      if (online) {
        // Trigger sync when coming back online
        syncPendingActions();
      }
    });
    setIsOnline(getNetworkStatus());
  }, [syncPendingActions]);

  // Update pending count
  useEffect(() => {
    const updateCount = async () => {
      const pending = await getPendingSync();
      setPendingCount(pending.length);
    };
    updateCount();
  }, []);

  // Queue a habit action for offline sync
  const queueAction = useCallback(async (actionType, data) => {
    await queueForSync({
      type: actionType,
      data,
      userId
    });
    setPendingCount(prev => prev + 1);
  }, [userId]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    queueAction,
    syncPendingActions,
    saveHabitsLocally,
    loadHabitsLocally
  };
};
