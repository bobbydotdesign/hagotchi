import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  getSkinById,
  selectRandomHagotchi,
  selectRandomStarter,
  SKINS
} from '../data/hagotchiSkins';
import {
  getEncouragementMessage,
  getInteractionMessage,
  getTimeOfDayTrigger,
  shouldShowWelcomeBack,
  getCompletionTrigger,
  getHeartTrigger
} from '../data/encouragementMessages';

const HAGOTCHI_CACHE_KEY = 'hagotchi_cache_v3';
const STATS_CACHE_KEY = 'hagotchi_stats_cache_v1';

export const useHagotchi = (userId) => {
  // Load cached spirit immediately for faster perceived load
  const [spirit, setSpirit] = useState(() => {
    try {
      const cached = localStorage.getItem(HAGOTCHI_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch {
      return null;
    }
  });

  const [hagotchiStats, setHagotchiStats] = useState(() => {
    try {
      const cached = localStorage.getItem(STATS_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
      return [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(true);
  const [pendingUnlock, setPendingUnlock] = useState(null);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);
  const [encouragementMessage, setEncouragementMessage] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const isInitialized = useRef(false);
  const encouragementTimeoutRef = useRef(null);

  // Auto-dismiss encouragement messages after 5 seconds
  useEffect(() => {
    if (encouragementMessage) {
      // Clear any existing timeout
      if (encouragementTimeoutRef.current) {
        clearTimeout(encouragementTimeoutRef.current);
      }
      // Set new timeout to auto-dismiss
      encouragementTimeoutRef.current = setTimeout(() => {
        setEncouragementMessage(null);
      }, 5000);
    }

    return () => {
      if (encouragementTimeoutRef.current) {
        clearTimeout(encouragementTimeoutRef.current);
      }
    };
  }, [encouragementMessage]);
  const lastCompletionPercent = useRef(0);

  // Cache spirit data
  useEffect(() => {
    if (spirit) {
      localStorage.setItem(HAGOTCHI_CACHE_KEY, JSON.stringify(spirit));
    }
  }, [spirit]);

  // Cache stats data
  useEffect(() => {
    if (hagotchiStats.length > 0) {
      localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(hagotchiStats));
    }
  }, [hagotchiStats]);

  // Clear cache on logout
  useEffect(() => {
    if (!userId) {
      localStorage.removeItem(HAGOTCHI_CACHE_KEY);
      localStorage.removeItem(STATS_CACHE_KEY);
      setSpirit(null);
      setHagotchiStats([]);
    }
  }, [userId]);

  // Fetch spirit from Supabase
  const fetchSpirit = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('hagotchi_spirit')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // No spirit exists - new user, show onboarding
        setShowOnboarding(true);
        setLoading(false);
        return;
      } else if (error) {
        console.error('Error fetching spirit:', error);
        setLoading(false);
        return;
      }

      if (data) {
        // Migrate old skin IDs to new ones (legacy support)
        const oldToNew = {
          'pixel_spirit': 'egbert',
          'ember_wisp': 'pum',
          'crystal_guardian': 'gose',
          'void_walker': 'dock',
          'neon_phoenix': 'boom',
          'quantum_byte': 'snee',
          'elder_glitch': 'brr',
          'cosmic_sage': 'rad'
        };

        let needsMigration = false;
        let migratedSkinId = data.active_skin_id;
        let migratedUnlocked = [...data.unlocked_skin_ids];

        // Migrate active skin
        if (oldToNew[data.active_skin_id]) {
          migratedSkinId = oldToNew[data.active_skin_id];
          needsMigration = true;
        }

        // Migrate unlocked skins
        migratedUnlocked = migratedUnlocked.map(id => oldToNew[id] || id);
        if (JSON.stringify(migratedUnlocked) !== JSON.stringify(data.unlocked_skin_ids)) {
          needsMigration = true;
        }

        // Ensure at least one skin is unlocked
        if (migratedUnlocked.length === 0) {
          migratedUnlocked = ['egbert'];
          needsMigration = true;
        }

        const updatedData = {
          ...data,
          active_skin_id: migratedSkinId,
          unlocked_skin_ids: migratedUnlocked,
          // Default new fields if null
          hearts_base: data.hearts_base ?? 0,
          coins: data.coins ?? 0,
          onboarding_completed: data.onboarding_completed ?? true,
        };

        setSpirit(updatedData);

        // Check for welcome back message
        if (shouldShowWelcomeBack(data.last_active_at)) {
          const skin = getSkinById(migratedSkinId);
          const message = getEncouragementMessage('welcome_back', skin.personality);
          if (message) {
            setEncouragementMessage(message);
          }
        } else {
          // Show time-of-day greeting
          const skin = getSkinById(migratedSkinId);
          const trigger = getTimeOfDayTrigger();
          const message = getEncouragementMessage(trigger, skin.personality);
          if (message) {
            setEncouragementMessage(message);
          }
        }

        // Update last_active_at
        supabase
          .from('hagotchi_spirit')
          .update({ last_active_at: new Date().toISOString() })
          .eq('user_id', userId)
          .then(() => {});

        // Persist migration if needed
        if (needsMigration) {
          supabase
            .from('hagotchi_spirit')
            .update({
              active_skin_id: migratedSkinId,
              unlocked_skin_ids: migratedUnlocked
            })
            .eq('user_id', userId)
            .then(({ error: updateError }) => {
              if (updateError) console.error('Migration update error:', updateError);
            });
        }

        // Fetch per-Hagotchi stats
        fetchHagotchiStats();
      }
    } catch (err) {
      console.error('Error in fetchSpirit:', err);
    } finally {
      setLoading(false);
      isInitialized.current = true;
    }
  }, [userId]);

  // Fetch per-Hagotchi stats
  const fetchHagotchiStats = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('hagotchi_stats')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching stats:', error);
        return;
      }

      setHagotchiStats(data || []);
    } catch (err) {
      console.error('Error in fetchHagotchiStats:', err);
    }
  }, [userId]);

  // Initialize spirit on mount
  useEffect(() => {
    if (userId && !isInitialized.current) {
      fetchSpirit();
    }
  }, [userId, fetchSpirit]);

  // Create new spirit for onboarding
  const createSpirit = useCallback(async (starterSkinId) => {
    if (!userId) return null;

    const newSpirit = {
      user_id: userId,
      active_skin_id: starterSkinId,
      hearts_base: 0,
      coins: 0,
      unlocked_skin_ids: [starterSkinId],
      total_habits_completed: 0,
      current_streak: 0,
      longest_streak: 0,
      last_active_at: new Date().toISOString(),
      onboarding_completed: false,
    };

    try {
      const { data, error } = await supabase
        .from('hagotchi_spirit')
        .insert([newSpirit])
        .select()
        .single();

      if (error) {
        console.error('Error creating spirit:', error);
        return null;
      }

      // Create initial stats for starter Hagotchi
      await supabase
        .from('hagotchi_stats')
        .insert([{
          user_id: userId,
          skin_id: starterSkinId,
          discovered_at: new Date().toISOString(),
        }]);

      setSpirit(data);
      setShowOnboarding(false);
      return data;
    } catch (err) {
      console.error('Error in createSpirit:', err);
      return null;
    }
  }, [userId]);

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    if (!spirit || !userId) return;

    setSpirit(prev => ({ ...prev, onboarding_completed: true }));

    await supabase
      .from('hagotchi_spirit')
      .update({ onboarding_completed: true })
      .eq('user_id', userId);
  }, [spirit, userId]);

  // Update hearts based on completion percentage
  // This is the main function called when habit completion changes
  const updateHearts = useCallback(async (completionPercent, totalHabits, completedHabits) => {
    if (!spirit || !userId) return { coinsEarned: 0, triggered: null };

    // Calculate today's hearts contribution (0-1 based on completion %)
    const todayHearts = completionPercent / 100;
    const previousTotalHearts = spirit.hearts_base + (lastCompletionPercent.current / 100);
    const newTotalHearts = spirit.hearts_base + todayHearts;

    // Check for coin awards (crossing integer thresholds)
    const previousWholeHearts = Math.floor(previousTotalHearts);
    const newWholeHearts = Math.floor(newTotalHearts);
    const coinsEarned = Math.max(0, newWholeHearts - previousWholeHearts);

    // Check for heart milestone message
    const heartTrigger = getHeartTrigger(newTotalHearts, previousTotalHearts);

    // Check for completion milestone message
    const completionTrigger = getCompletionTrigger(completionPercent, lastCompletionPercent.current);

    // Update last completion percent for next comparison
    lastCompletionPercent.current = completionPercent;

    // Check for unlock (3 hearts)
    let unlockTriggered = false;
    if (newTotalHearts >= 3) {
      unlockTriggered = true;
    }

    // Show encouragement message
    const currentSkin = getSkinById(spirit.active_skin_id);
    let message = null;

    if (completionTrigger) {
      message = getEncouragementMessage(completionTrigger, currentSkin.personality);
    } else if (heartTrigger) {
      message = getEncouragementMessage(heartTrigger, currentSkin.personality);
    }

    if (message) {
      setEncouragementMessage(message);
    }

    // Award coins if earned
    if (coinsEarned > 0) {
      setSpirit(prev => ({
        ...prev,
        coins: (prev.coins || 0) + coinsEarned
      }));

      // Show first coin message if applicable
      if (spirit.coins === 0 && coinsEarned > 0) {
        const coinMessage = getEncouragementMessage('first_coin_earned', currentSkin.personality);
        if (coinMessage) {
          // Queue this after the current message
          setTimeout(() => setEncouragementMessage(coinMessage), 4000);
        }
      }

      // Persist coin update
      await supabase
        .from('hagotchi_spirit')
        .update({ coins: (spirit.coins || 0) + coinsEarned })
        .eq('user_id', userId);
    }

    // Trigger unlock if reached 3 hearts
    if (unlockTriggered) {
      await triggerUnlock();
    }

    return { coinsEarned, triggered: completionTrigger || heartTrigger };
  }, [spirit, userId]);

  // Record habit completion (increments stats)
  const recordHabitCompletion = useCallback(async (streakValue = 0, isFirstEver = false) => {
    if (!spirit || !userId) return;

    const newTotalCompleted = spirit.total_habits_completed + 1;
    const newLongestStreak = Math.max(spirit.longest_streak, streakValue);

    // Optimistic update
    setSpirit(prev => ({
      ...prev,
      total_habits_completed: newTotalCompleted,
      current_streak: streakValue,
      longest_streak: newLongestStreak,
    }));

    // Update per-Hagotchi stats
    await updateActiveHagotchiStats({
      habits_completed: 1,
      streak: streakValue,
    });

    // Persist to database
    await supabase
      .from('hagotchi_spirit')
      .update({
        total_habits_completed: newTotalCompleted,
        current_streak: streakValue,
        longest_streak: newLongestStreak,
      })
      .eq('user_id', userId);

    // Show first habit ever message
    if (isFirstEver) {
      const currentSkin = getSkinById(spirit.active_skin_id);
      const message = getEncouragementMessage('first_habit_ever', currentSkin.personality);
      if (message) {
        setEncouragementMessage(message);
      }
    }

    // Check streak milestones
    const currentSkin = getSkinById(spirit.active_skin_id);
    let streakMessage = null;

    if (streakValue === 3) {
      streakMessage = getEncouragementMessage('streak_3_days', currentSkin.personality);
    } else if (streakValue === 7) {
      streakMessage = getEncouragementMessage('streak_7_days', currentSkin.personality);
    } else if (streakValue === 30) {
      streakMessage = getEncouragementMessage('streak_30_days', currentSkin.personality);
    }

    if (streakMessage && !isFirstEver) {
      // Delay streak message slightly so it doesn't overlap
      setTimeout(() => setEncouragementMessage(streakMessage), 2000);
    }

  }, [spirit, userId]);

  // Trigger blind box unlock
  const triggerUnlock = useCallback(async () => {
    if (!spirit || !userId) return;

    // Select random Hagotchi from locked pool
    const newSkin = selectRandomHagotchi(spirit.unlocked_skin_ids);

    if (!newSkin) {
      // All Hagotchis unlocked!
      const currentSkin = getSkinById(spirit.active_skin_id);
      const message = getEncouragementMessage('all_hagotchis_unlocked', currentSkin.personality);
      if (message) {
        setEncouragementMessage(message);
      }
      return;
    }

    // Set pending unlock for animation
    setPendingUnlock(newSkin.id);
    setShowUnlockAnimation(true);

    // Update spirit: reset hearts, add new skin to unlocked
    const updatedUnlocked = [...spirit.unlocked_skin_ids, newSkin.id];

    setSpirit(prev => ({
      ...prev,
      hearts_base: 0,
      unlocked_skin_ids: updatedUnlocked,
    }));

    // Reset completion percent tracker
    lastCompletionPercent.current = 0;

    // Persist to database
    await supabase
      .from('hagotchi_spirit')
      .update({
        hearts_base: 0,
        unlocked_skin_ids: updatedUnlocked,
      })
      .eq('user_id', userId);

    // Create stats record for new Hagotchi
    await supabase
      .from('hagotchi_stats')
      .insert([{
        user_id: userId,
        skin_id: newSkin.id,
        discovered_at: new Date().toISOString(),
      }]);

    // Refresh stats
    fetchHagotchiStats();

  }, [spirit, userId, fetchHagotchiStats]);

  // Update stats for active Hagotchi
  const updateActiveHagotchiStats = useCallback(async ({ habits_completed = 0, hearts_earned = 0, streak = 0 }) => {
    if (!spirit || !userId) return;

    const skinId = spirit.active_skin_id;

    // Optimistic update in local state
    setHagotchiStats(prev => {
      return prev.map(stat => {
        if (stat.skin_id === skinId) {
          return {
            ...stat,
            habits_completed_while_active: (stat.habits_completed_while_active || 0) + habits_completed,
            hearts_earned_while_active: (stat.hearts_earned_while_active || 0) + hearts_earned,
            longest_streak_while_active: Math.max(stat.longest_streak_while_active || 0, streak),
          };
        }
        return stat;
      });
    });

    // Upsert to database
    const { error } = await supabase
      .from('hagotchi_stats')
      .upsert({
        user_id: userId,
        skin_id: skinId,
        habits_completed_while_active: supabase.rpc ? undefined : habits_completed, // Will use increment
        hearts_earned_while_active: hearts_earned,
        longest_streak_while_active: streak,
      }, {
        onConflict: 'user_id,skin_id',
      });

    if (error) {
      // Fallback: fetch and update manually
      const { data: existing } = await supabase
        .from('hagotchi_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('skin_id', skinId)
        .single();

      if (existing) {
        await supabase
          .from('hagotchi_stats')
          .update({
            habits_completed_while_active: (existing.habits_completed_while_active || 0) + habits_completed,
            hearts_earned_while_active: (existing.hearts_earned_while_active || 0) + hearts_earned,
            longest_streak_while_active: Math.max(existing.longest_streak_while_active || 0, streak),
          })
          .eq('user_id', userId)
          .eq('skin_id', skinId);
      }
    }
  }, [spirit, userId]);

  // Increment days active for current Hagotchi (called on day change)
  const incrementDaysActive = useCallback(async () => {
    if (!spirit || !userId) return;

    const skinId = spirit.active_skin_id;

    setHagotchiStats(prev => {
      return prev.map(stat => {
        if (stat.skin_id === skinId) {
          return {
            ...stat,
            total_days_active: (stat.total_days_active || 0) + 1,
          };
        }
        return stat;
      });
    });

    // Update database
    const { data: existing } = await supabase
      .from('hagotchi_stats')
      .select('total_days_active')
      .eq('user_id', userId)
      .eq('skin_id', skinId)
      .single();

    if (existing) {
      await supabase
        .from('hagotchi_stats')
        .update({
          total_days_active: (existing.total_days_active || 0) + 1,
        })
        .eq('user_id', userId)
        .eq('skin_id', skinId);
    }
  }, [spirit, userId]);

  // Finalize day (add today's hearts to base) - called on day change
  const finalizeDay = useCallback(async (finalCompletionPercent) => {
    if (!spirit || !userId) return;

    const heartsFromToday = finalCompletionPercent / 100;
    const newHeartsBase = Math.min(3, (spirit.hearts_base || 0) + heartsFromToday);

    // If we crossed 3, trigger unlock (shouldn't happen as updateHearts handles it, but just in case)
    if (newHeartsBase >= 3) {
      await triggerUnlock();
      return;
    }

    // Update hearts_base
    setSpirit(prev => ({
      ...prev,
      hearts_base: newHeartsBase,
    }));

    // Reset completion percent tracker for new day
    lastCompletionPercent.current = 0;

    // Persist
    await supabase
      .from('hagotchi_spirit')
      .update({ hearts_base: newHeartsBase })
      .eq('user_id', userId);

    // Increment days active
    await incrementDaysActive();

  }, [spirit, userId, triggerUnlock, incrementDaysActive]);

  // Switch active skin
  const switchSkin = useCallback(async (skinId) => {
    if (!spirit || !userId) return;

    // Can only switch to unlocked skins
    if (!spirit.unlocked_skin_ids.includes(skinId)) {
      console.warn('Attempted to switch to locked skin:', skinId);
      return;
    }

    // Optimistic update
    setSpirit(prev => ({ ...prev, active_skin_id: skinId }));

    // Persist to database
    const { error } = await supabase
      .from('hagotchi_spirit')
      .update({ active_skin_id: skinId })
      .eq('user_id', userId);

    if (error) {
      console.error('Error switching skin:', error);
      // Revert on error
      fetchSpirit();
    }

    // Show greeting from new Hagotchi
    const newSkin = getSkinById(skinId);
    const trigger = getTimeOfDayTrigger();
    const message = getEncouragementMessage(trigger, newSkin.personality);
    if (message) {
      setEncouragementMessage(message);
    }

  }, [spirit, userId, fetchSpirit]);

  // Set custom name for a Hagotchi
  const setCustomName = useCallback(async (skinId, customName) => {
    if (!userId) return;

    setHagotchiStats(prev => {
      return prev.map(stat => {
        if (stat.skin_id === skinId) {
          return { ...stat, custom_name: customName };
        }
        return stat;
      });
    });

    await supabase
      .from('hagotchi_stats')
      .update({ custom_name: customName })
      .eq('user_id', userId)
      .eq('skin_id', skinId);

  }, [userId]);

  // Close unlock animation
  const closeUnlockAnimation = useCallback((setAsActive = false) => {
    if (setAsActive && pendingUnlock) {
      switchSkin(pendingUnlock);
    }

    setShowUnlockAnimation(false);
    setPendingUnlock(null);

    // Show unlock message
    if (spirit) {
      const currentSkin = getSkinById(spirit.active_skin_id);
      const message = getEncouragementMessage('new_hagotchi_unlocked', currentSkin.personality);
      if (message) {
        setEncouragementMessage(message);
      }
    }
  }, [pendingUnlock, switchSkin, spirit]);

  // Clear encouragement message
  const clearEncouragement = useCallback(() => {
    setEncouragementMessage(null);
  }, []);

  // Trigger an on-demand interaction (joke, fact, encouragement)
  const triggerInteraction = useCallback((type) => {
    if (!spirit) return;
    const currentSkin = getSkinById(spirit.active_skin_id);
    const message = getInteractionMessage(type, currentSkin.personality);
    if (message) {
      setEncouragementMessage(message);
    }
  }, [spirit]);

  // Get current skin data
  const currentSkin = spirit ? getSkinById(spirit.active_skin_id) : null;

  // Get stats for a specific Hagotchi
  const getStatsForSkin = useCallback((skinId) => {
    return hagotchiStats.find(s => s.skin_id === skinId) || null;
  }, [hagotchiStats]);

  // Calculate total hearts (base + today's progress)
  // Note: todayCompletion should be passed from HabitTracker
  const getTotalHearts = useCallback((todayCompletionPercent = 0) => {
    if (!spirit) return 0;
    return Math.min(3, (spirit.hearts_base || 0) + (todayCompletionPercent / 100));
  }, [spirit]);

  return {
    spirit,
    loading,
    currentSkin,
    hagotchiStats,

    // Hearts & Coins
    getTotalHearts,
    updateHearts,
    recordHabitCompletion,
    finalizeDay,

    // Skin management
    switchSkin,
    setCustomName,
    getStatsForSkin,

    // Onboarding
    showOnboarding,
    createSpirit,
    completeOnboarding,
    selectRandomStarter,

    // Unlock animation
    pendingUnlock,
    showUnlockAnimation,
    closeUnlockAnimation,

    // Encouragement & Interactions
    encouragementMessage,
    clearEncouragement,
    triggerInteraction,

    // Utilities
    refetchSpirit: fetchSpirit,
  };
};
