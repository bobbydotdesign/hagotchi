import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Custom hook for fetching and caching activity data
 * Supports week/month/year/all time periods with stale-while-revalidate
 */
export const useActivityData = (userId, timePeriod) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();

    switch (timePeriod) {
      case 'week':
        startDate.setDate(endDate.getDate() - 6);
        break;
      case 'month':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case 'all':
        startDate.setFullYear(2020); // Far back enough for any user
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  }, [timePeriod]);

  const cacheKey = `${userId}-${timePeriod}-${dateRange.start}`;

  const fetchData = useCallback(async (skipCache = false) => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }

    // Check cache first
    const cached = cacheRef.current.get(cacheKey);
    if (!skipCache && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    // Show cached data immediately (stale-while-revalidate)
    if (cached) {
      setData(cached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Fetch completions in date range
      const { data: completions, error: fetchError } = await supabase
        .from('completions')
        .select('completed_date, completion_count, daily_goal, habit_id')
        .eq('user_id', userId)
        .gte('completed_date', dateRange.start)
        .lte('completed_date', dateRange.end)
        .order('completed_date', { ascending: true });

      if (fetchError) throw fetchError;

      // Aggregate by date - sum completion percentages for all habits
      const byDate = {};
      const habitsByDate = {};

      completions.forEach(row => {
        const date = row.completed_date;
        const pct = Math.min(row.completion_count / row.daily_goal, 1);

        if (!byDate[date]) {
          byDate[date] = 0;
          habitsByDate[date] = 0;
        }
        byDate[date] += pct;
        habitsByDate[date]++;
      });

      // Transform to array format for the grid
      const activityData = {
        byDate,
        habitsByDate,
        raw: completions,
        dateRange
      };

      // Cache the result
      cacheRef.current.set(cacheKey, {
        data: activityData,
        timestamp: Date.now()
      });

      setData(activityData);
      setError(null);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        console.error('Activity fetch error:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, cacheKey, dateRange]);

  // Initial fetch and refetch on period change
  useEffect(() => {
    fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  // Real-time subscription for updates
  useEffect(() => {
    if (!userId) return;

    let channel;
    try {
      channel = supabase
        .channel('completions-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'completions',
          filter: `user_id=eq.${userId}`
        }, () => {
          // Invalidate cache and refetch
          cacheRef.current.delete(cacheKey);
          fetchData(true);
        })
        .subscribe();
    } catch (err) {
      console.warn('Could not set up realtime subscription:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    };
  }, [userId, cacheKey, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(true),
    invalidateCache: () => cacheRef.current.clear()
  };
};

export default useActivityData;
