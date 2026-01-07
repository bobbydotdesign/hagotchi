import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Custom hook for recording habit completions to the completions table
 */
export const useCompletions = (userId) => {
  /**
   * Record or update a completion for today
   * Uses upsert to handle both new and existing records
   */
  const recordCompletion = useCallback(async (habitId, completionCount, dailyGoal) => {
    if (!userId || !habitId) {
      return { success: false, error: 'Missing userId or habitId' };
    }

    const today = new Date().toISOString().split('T')[0];

    try {
      if (completionCount === 0) {
        // Delete the record if completions reset to 0
        const { error } = await supabase
          .from('completions')
          .delete()
          .eq('habit_id', habitId)
          .eq('completed_date', today);

        if (error) throw error;
      } else {
        // Upsert the completion record
        const { error } = await supabase
          .from('completions')
          .upsert({
            user_id: userId,
            habit_id: habitId,
            completed_date: today,
            completion_count: completionCount,
            daily_goal: dailyGoal
          }, {
            onConflict: 'habit_id,completed_date'
          });

        if (error) throw error;
      }

      return { success: true };
    } catch (err) {
      console.error('Error recording completion:', err);
      return { success: false, error: err.message };
    }
  }, [userId]);

  /**
   * Get all completions for a specific date
   */
  const getCompletionsForDate = useCallback(async (date) => {
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('completions')
        .select('*')
        .eq('user_id', userId)
        .eq('completed_date', date);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching completions:', err);
      return [];
    }
  }, [userId]);

  /**
   * Batch record completions (useful for day change migrations)
   */
  const batchRecordCompletions = useCallback(async (completions) => {
    if (!userId || !completions.length) {
      return { success: false, error: 'Missing data' };
    }

    try {
      const records = completions.map(c => ({
        user_id: userId,
        habit_id: c.habitId,
        completed_date: c.date,
        completion_count: c.completionCount,
        daily_goal: c.dailyGoal
      }));

      const { error } = await supabase
        .from('completions')
        .upsert(records, {
          onConflict: 'habit_id,completed_date'
        });

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('Error batch recording completions:', err);
      return { success: false, error: err.message };
    }
  }, [userId]);

  return {
    recordCompletion,
    getCompletionsForDate,
    batchRecordCompletions
  };
};

export default useCompletions;
