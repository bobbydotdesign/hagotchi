import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  calculateVitalityDecay,
  getVitalityGain,
  checkMilestones,
  getSkinById
} from '../data/hagotchiSkins';

const HAGOTCHI_CACHE_KEY = 'hagotchi_cache_v2';

export const useHagotchi = (userId) => {
  // Load cached spirit immediately for faster perceived load
  const [spirit, setSpirit] = useState(() => {
    try {
      const cached = localStorage.getItem(HAGOTCHI_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Apply vitality decay based on time since last fed
        if (parsed.last_fed_at) {
          parsed.vitality = calculateVitalityDecay(parsed.last_fed_at, parsed.vitality);
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [pendingUnlock, setPendingUnlock] = useState(null);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);
  const isInitialized = useRef(false);

  // Cache spirit data
  useEffect(() => {
    if (spirit) {
      localStorage.setItem(HAGOTCHI_CACHE_KEY, JSON.stringify(spirit));
    }
  }, [spirit]);

  // Clear cache on logout
  useEffect(() => {
    if (!userId) {
      localStorage.removeItem(HAGOTCHI_CACHE_KEY);
      setSpirit(null);
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
        // No spirit exists, create one
        const newSpirit = {
          user_id: userId,
          active_skin_id: 'egbert',
          vitality: 100,
          last_fed_at: new Date().toISOString(),
          unlocked_skin_ids: ['egbert'],
          total_habits_completed: 0,
          current_streak: 0,
          longest_streak: 0
        };

        const { data: createdData, error: createError } = await supabase
          .from('hagotchi_spirit')
          .insert([newSpirit])
          .select()
          .single();

        if (createError) {
          console.error('Error creating spirit:', createError);
        } else {
          setSpirit(createdData);
        }
      } else if (error) {
        console.error('Error fetching spirit:', error);
      } else if (data) {
        // Apply vitality decay
        const currentVitality = calculateVitalityDecay(data.last_fed_at, data.vitality);

        // Migrate old skin IDs to new ones
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

        // Ensure egbert is always unlocked
        if (!migratedUnlocked.includes('egbert')) {
          migratedUnlocked = ['egbert', ...migratedUnlocked];
          needsMigration = true;
        }

        const updatedData = {
          ...data,
          vitality: currentVitality,
          active_skin_id: migratedSkinId,
          unlocked_skin_ids: migratedUnlocked
        };

        setSpirit(updatedData);

        // Persist migration to database
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
      }
    } catch (err) {
      console.error('Error in fetchSpirit:', err);
    } finally {
      setLoading(false);
      isInitialized.current = true;
    }
  }, [userId]);

  // Initialize spirit on mount
  useEffect(() => {
    if (userId && !isInitialized.current) {
      fetchSpirit();
    }
  }, [userId, fetchSpirit]);

  // Feed the spirit (called when a habit is completed)
  const feedSpirit = useCallback(async (streakValue = 0) => {
    if (!spirit || !userId) return;

    const vitalityGain = getVitalityGain();
    const newVitality = Math.min(100, spirit.vitality + vitalityGain);
    const newTotalCompleted = spirit.total_habits_completed + 1;
    const newLongestStreak = Math.max(spirit.longest_streak, streakValue);
    const now = new Date().toISOString();

    // Check for new unlocks
    const newUnlocks = checkMilestones(
      streakValue,
      newLongestStreak,
      newTotalCompleted,
      spirit.unlocked_skin_ids
    );

    const updatedUnlockedSkins = [...spirit.unlocked_skin_ids, ...newUnlocks];

    // Optimistic update
    setSpirit(prev => ({
      ...prev,
      vitality: newVitality,
      last_fed_at: now,
      total_habits_completed: newTotalCompleted,
      current_streak: streakValue,
      longest_streak: newLongestStreak,
      unlocked_skin_ids: updatedUnlockedSkins
    }));

    // Persist to database
    const { error } = await supabase
      .from('hagotchi_spirit')
      .update({
        vitality: newVitality,
        last_fed_at: now,
        total_habits_completed: newTotalCompleted,
        current_streak: streakValue,
        longest_streak: newLongestStreak,
        unlocked_skin_ids: updatedUnlockedSkins
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating spirit:', error);
      // Revert on error
      fetchSpirit();
    }

    // Trigger unlock animation if new skin was unlocked
    if (newUnlocks.length > 0) {
      setPendingUnlock(newUnlocks[0]);
      setShowUnlockAnimation(true);
    }

    return { vitalityGain, newUnlocks };
  }, [spirit, userId, fetchSpirit]);

  // Update current streak (called when habits change)
  const updateStreak = useCallback(async (newStreak) => {
    if (!spirit || !userId) return;

    const newLongestStreak = Math.max(spirit.longest_streak, newStreak);

    // Check for new unlocks based on streak
    const newUnlocks = checkMilestones(
      newStreak,
      newLongestStreak,
      spirit.total_habits_completed,
      spirit.unlocked_skin_ids
    );

    const updatedUnlockedSkins = [...spirit.unlocked_skin_ids, ...newUnlocks];

    // Optimistic update
    setSpirit(prev => ({
      ...prev,
      current_streak: newStreak,
      longest_streak: newLongestStreak,
      unlocked_skin_ids: updatedUnlockedSkins
    }));

    // Persist to database
    const { error } = await supabase
      .from('hagotchi_spirit')
      .update({
        current_streak: newStreak,
        longest_streak: newLongestStreak,
        unlocked_skin_ids: updatedUnlockedSkins
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating streak:', error);
    }

    // Trigger unlock animation if new skin was unlocked
    if (newUnlocks.length > 0) {
      setPendingUnlock(newUnlocks[0]);
      setShowUnlockAnimation(true);
    }
  }, [spirit, userId]);

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
  }, [spirit, userId, fetchSpirit]);

  // Close unlock animation
  const closeUnlockAnimation = useCallback(() => {
    setShowUnlockAnimation(false);
    setPendingUnlock(null);
  }, []);

  // Get current skin data
  const currentSkin = spirit ? getSkinById(spirit.active_skin_id) : null;

  return {
    spirit,
    loading,
    currentSkin,
    feedSpirit,
    updateStreak,
    switchSkin,
    refetchSpirit: fetchSpirit,
    pendingUnlock,
    showUnlockAnimation,
    closeUnlockAnimation
  };
};
