import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useCompletions } from '../hooks/useCompletions';
import ActivityView from './activity/ActivityView';
import BottomSheet from './BottomSheet';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isNative, hideSplashScreen } from '../lib/capacitor';
import {
  hapticMedium,
  hapticLight,
  hapticSelection,
  hapticError,
  hapticSuccess,
  hapticStreakMilestone
} from '../services/haptics';
import {
  requestNotificationPermission,
  scheduleAllHabitNotifications,
  setupNotificationListeners
} from '../services/notifications';
import { useHagotchi } from '../hooks/useHagotchi';
import {
  HagotchiCompanion,
  SkinCollection,
  UnlockAnimation,
  LoreArchive
} from './hagotchi';

// Design tokens - edit these to change the app's color scheme
const COLORS = {
  // Primary accent
  primary: '#00ff41',
  primaryGlow: 'rgba(0, 255, 65, 0.5)',
  primaryBg: 'rgba(0, 255, 65, 0.03)',
  primaryBgHover: 'rgba(0, 255, 65, 0.15)',

  // Text
  text: '#fff',
  textMuted: '#999',
  textDim: '#666',

  // Backgrounds
  bg: '#0a0a0a',
  bgPanel: '#0d0d0d',
  bgInput: '#0a0a0a',
  bgHover: '#1a1a1a',

  // Borders
  border: '#333',
  borderLight: '#444',
  borderDark: '#222',

  // Status colors
  warning: '#ffaa00',
  error: '#ff4444',
  errorBg: 'rgba(255, 68, 68, 0.1)',

  // Progress indicators
  dotEmpty: '#666',
  dotFilled: '#00ff41',
};

// Sortable wrapper component for habit rows
const SortableItem = ({ id, children, disabled }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto'
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ listeners, isDragging })}
    </div>
  );
};

const HABITS_CACHE_KEY = 'habito_habits_cache_v2'; // v2: invalidate old cache with zeroed streaks

const HabitTracker = () => {
  // Load cached habits immediately for faster perceived load
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState(() => {
    try {
      const cached = localStorage.getItem(HABITS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedView, setSelectedView] = useState('today');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [dateCompletions, setDateCompletions] = useState({});
  const [loadingDate, setLoadingDate] = useState(false);
  const [cursorBlink, setCursorBlink] = useState(true);
  const [bootSequence, setBootSequence] = useState(true);
  const [bootLine, setBootLine] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [newHabitGoal, setNewHabitGoal] = useState(1);
  const [editingHabit, setEditingHabit] = useState(null);
  const [editHabitName, setEditHabitName] = useState('');
  const [editHabitGoal, setEditHabitGoal] = useState(1);
  const [editHabitTime, setEditHabitTime] = useState('');
  const [editHabitDays, setEditHabitDays] = useState([0,1,2,3,4,5,6]);
  const [newHabitTime, setNewHabitTime] = useState('');
  const [newHabitDays, setNewHabitDays] = useState([0,1,2,3,4,5,6]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

  // Swipe gesture state for native mobile feel
  const [swipeState, setSwipeState] = useState({});
  const [activeSwipe, setActiveSwipe] = useState(null);
  const [completedAnimation, setCompletedAnimation] = useState(null);
  const swipeStartRef = useRef({ x: 0, y: 0, time: 0 });
  const [showMobileHint, setShowMobileHint] = useState(() => {
    return !localStorage.getItem('habito_mobile_hint_seen');
  });
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // Hagotchi companion state
  const [showSkinCollection, setShowSkinCollection] = useState(false);
  const [showLoreArchive, setShowLoreArchive] = useState(false);
  const [feedingAnimation, setFeedingAnimation] = useState(false);
  const [lastVitalityGain, setLastVitalityGain] = useState(0);

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-menu]')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const bootMessages = [
    '> HAGOTCHI v2.5.0 initializing...',
    '> mounting habit filesystem..... OK',
    '> loading neural pathways...... OK',
    '> calibrating streak engine.... OK',
    '> scanning habit matrix........ OK',
    '> indexing completion history.. OK',
    '> syncing cloud data........... OK',
    '> loading user preferences..... OK',
    '> all systems operational.',
    '> welcome back, operator.',
    '',
    '> ready_'
  ];
  const [bootFading, setBootFading] = useState(false);

  const icons = ['◎', '▣', '△', '▢', '○', '◇', '▽', '□', '●', '◆'];

  // Check for day change and update habits accordingly
  const checkDayChange = useCallback((habitsData) => {
    const lastVisit = localStorage.getItem('lastVisit');
    const today = new Date().toDateString();

    if (lastVisit && lastVisit !== today) {
      localStorage.setItem('lastVisit', today);
      // It's a new day - shift history and reset completedToday
      // Don't touch streak here - let the streak recalculation effect handle it
      return habitsData.map(h => ({
        ...h,
        completed_today: false,
        completions_today: 0,
        history: [...(h.history || [0,0,0,0,0,0,0]).slice(1), h.completed_today ? 1 : 0]
      }));
    }

    if (!lastVisit) {
      localStorage.setItem('lastVisit', today);
    }

    return habitsData;
  }, []);

  // Fetch habits from Supabase
  const fetchHabits = useCallback(async (userId) => {
    setFetchError(null);
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching habits:', error);
      setFetchError(error.message || 'Failed to load habits');
      return [];
    }

    // Check for day change - but only if we actually have data
    // Never process empty results to avoid syncing empty state back
    if (!data || data.length === 0) {
      return data || [];
    }

    const updatedHabits = checkDayChange(data);

    // If habits were updated due to day change, batch sync to Supabase
    // Note: Don't sync streak here - let the streak recalculation effect handle it
    if (JSON.stringify(updatedHabits) !== JSON.stringify(data)) {
      // Use Promise.all for parallel updates instead of sequential
      await Promise.all(updatedHabits.map(habit =>
        supabase
          .from('habits')
          .update({
            completed_today: habit.completed_today,
            history: habit.history
          })
          .eq('id', habit.id)
      ));
    }

    return updatedHabits;
  }, [checkDayChange]);

  // Auth state listener - uses onAuthStateChange exclusively (recommended by Supabase)
  // This avoids issues where getSession() can hang with corrupted localStorage
  useEffect(() => {
    // Check for password recovery token in URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');

    // Show password reset modal if recovery token in URL
    if (type === 'recovery' && accessToken) {
      setShowPasswordReset(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {

      // Update user state
      setUser(session?.user ?? null);

      // Handle sign out
      if (event === 'SIGNED_OUT') {
        setHabits([]);
        setShowAddModal(false);
        setShowPasswordReset(false);
        setShowSettings(false);
        setLoading(false);
        return;
      }

      // Handle password recovery
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true);
      }

      // Fetch habits if user exists
      if (session?.user) {
        // If we have cached habits, show them immediately
        const cached = localStorage.getItem(HABITS_CACHE_KEY);
        if (cached) {
          try {
            setHabits(JSON.parse(cached));
            setLoading(false);
          } catch {}
        }

        // Fetch fresh data - no timeout if we have cache, 30s timeout if we don't
        const doFetch = async () => {
          try {
            const data = await fetchHabits(session.user.id);
            setHabits(data);
            localStorage.setItem(HABITS_CACHE_KEY, JSON.stringify(data));
            setFetchError(null);
          } catch (err) {
            console.error('Error fetching habits:', err);
            if (!cached) {
              setFetchError('Failed to load habits');
            }
          }
        };

        if (cached) {
          // Have cache - fetch in background without blocking
          doFetch();
        } else {
          // No cache - wait for fetch with timeout
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Fetch timeout')), 30000)
          );
          try {
            await Promise.race([doFetch(), timeoutPromise]);
          } catch (err) {
            console.error('Error fetching habits:', err);
            setFetchError('Connection slow - please refresh');
          }
        }
      } else {
        setHabits([]);
        localStorage.removeItem(HABITS_CACHE_KEY);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchHabits]);

  // Refetch habits when tab becomes visible (keeps data in sync across devices)
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const data = await fetchHabits(user.id);
          setHabits(data);
          localStorage.setItem(HABITS_CACHE_KEY, JSON.stringify(data));
        } catch (err) {
          console.error('Error refreshing habits on visibility change:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, fetchHabits]);

  // Cache habits whenever they change (for faster loads)
  useEffect(() => {
    if (habits.length > 0 && user) {
      localStorage.setItem(HABITS_CACHE_KEY, JSON.stringify(habits));
    }
  }, [habits, user]);

  // Sync today's completions to completions table and recalculate streaks on load
  const [streaksRecalculated, setStreaksRecalculated] = useState(false);
  useEffect(() => {
    if (!user || habits.length === 0 || streaksRecalculated || loading) return;

    const syncAndRecalculateStreaks = async () => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // First, sync today's completions from habits table to completions table
      for (const habit of habits) {
        if (habit.completions_today > 0) {
          await supabase.from('completions').upsert({
            user_id: user.id,
            habit_id: habit.id,
            completed_date: todayStr,
            completion_count: habit.completions_today,
            daily_goal: habit.daily_goal || 1
          }, { onConflict: 'habit_id,completed_date' });
        }
      }

      // Then recalculate all streaks (preserve existing if no completion data)
      const updatedHabits = await Promise.all(
        habits.map(async (habit) => {
          const newStreak = await calculateStreakForHabit(habit.id, habit.daily_goal || 1);

          // If we got a calculated streak, use it
          if (newStreak !== null) {
            return { ...habit, streak: newStreak };
          }

          // If existing streak exists, keep it
          if (habit.streak > 0) {
            return habit;
          }

          // Try to restore from history array (fallback for lost streaks)
          const history = habit.history || [];
          let restoredStreak = 0;
          // Count consecutive 1s from the end of history
          for (let i = history.length - 1; i >= 0; i--) {
            if (history[i] === 1) restoredStreak++;
            else break;
          }
          // Add today if completed
          if (habit.completed_today) restoredStreak++;

          return { ...habit, streak: restoredStreak };
        })
      );

      // Only update if streaks changed
      const streaksChanged = updatedHabits.some((h, i) => h.streak !== habits[i].streak);
      if (streaksChanged) {
        setHabits(updatedHabits);
        // Update database
        for (const habit of updatedHabits) {
          if (habit.streak !== habits.find(h => h.id === habit.id)?.streak) {
            await supabase.from('habits').update({ streak: habit.streak }).eq('id', habit.id);
          }
        }
      }
      setStreaksRecalculated(true);
    };

    syncAndRecalculateStreaks();
  }, [user, habits.length, streaksRecalculated, loading]);

  // Separate function to calculate streak (used by effect above)
  // Returns null if no completion data exists (to preserve existing streak)
  const calculateStreakForHabit = async (habitId, dailyGoal) => {
    if (!user) return null;

    const { data: completions, error } = await supabase
      .from('completions')
      .select('completed_date, completion_count, daily_goal')
      .eq('user_id', user.id)
      .eq('habit_id', habitId)
      .order('completed_date', { ascending: false });

    if (error || !completions || completions.length === 0) return null;

    const completedDates = new Set(
      completions
        .filter(c => c.completion_count >= (c.daily_goal || dailyGoal))
        .map(c => c.completed_date)
    );

    if (completedDates.size === 0) return null;

    const getDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Find the most recent completed date (could be today or in the past)
    const sortedDates = [...completedDates].sort().reverse();
    const mostRecentStr = sortedDates[0];

    // Parse the most recent date and count backwards from there
    const [year, month, day] = mostRecentStr.split('-').map(Number);
    const checkDate = new Date(year, month - 1, day);

    let streak = 0;
    while (true) {
      const dateStr = getDateStr(checkDate);
      if (completedDates.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setCursorBlink(prev => !prev);
    }, 530);
    return () => clearInterval(blinkInterval);
  }, []);

  useEffect(() => {
    if (bootSequence && bootLine < bootMessages.length) {
      // Longer pause on "ready" line
      const isReadyLine = bootMessages[bootLine]?.includes('ready');
      const delay = bootLine === 0 ? 400 : isReadyLine ? 1200 : 250;
      const timer = setTimeout(() => {
        setBootLine(prev => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    } else if (bootLine >= bootMessages.length && !bootFading) {
      // Start fade out
      setBootFading(true);
      setTimeout(() => {
        setBootSequence(false);
        // Hide native splash screen after boot animation
        hideSplashScreen();
      }, 800);
    }
  }, [bootLine, bootSequence, bootFading]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin', 'signup', 'magic'
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsNewPassword, setSettingsNewPassword] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const isUpdatingPassword = useRef(false);

  // Hook for recording completions to activity tracking table
  const { recordCompletion, getCompletionsForDate } = useCompletions(user?.id);

  // Hook for Hagotchi companion system
  const {
    spirit,
    currentSkin,
    feedSpirit,
    updateStreak,
    switchSkin,
    pendingUnlock,
    showUnlockAnimation,
    closeUnlockAnimation
  } = useHagotchi(user?.id);

  // Date navigation helpers - use local date to avoid timezone issues
  const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = getLocalDateString();
  const isToday = selectedDate === today;

  // Auto-expand completed section when viewing past dates, collapse for today
  useEffect(() => {
    setCompletedExpanded(!isToday);
  }, [isToday]);

  const formatDateLabel = (dateStr) => {
    if (dateStr === today) return 'today';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate the earliest date user can navigate to (oldest habit creation)
  const earliestDate = habits.length > 0
    ? getLocalDateString(new Date(Math.min(...habits.map(h => new Date(h.created_at).getTime()))))
    : today;

  const canGoBack = selectedDate > earliestDate;

  const navigateDate = (direction) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const current = new Date(year, month - 1, day);
    current.setDate(current.getDate() + direction);
    const newDate = getLocalDateString(current);
    // Don't allow future dates or before earliest habit
    if (newDate <= today && newDate >= earliestDate) {
      setSelectedDate(newDate);
    }
  };

  // Filter habits to only show ones that existed on the selected date
  const habitsForSelectedDate = habits.filter(h => {
    const habitCreatedDate = getLocalDateString(new Date(h.created_at));
    return habitCreatedDate <= selectedDate;
  });

  // Load completions when viewing a past date
  useEffect(() => {
    // Clear immediately to prevent stale data
    setDateCompletions({});
    setLoadingDate(false);

    if (!user || isToday) {
      return;
    }

    let cancelled = false;
    setLoadingDate(true);

    getCompletionsForDate(selectedDate)
      .then(completions => {
        if (cancelled) return;
        const completionsMap = {};
        (completions || []).forEach(c => {
          completionsMap[c.habit_id] = {
            completion_count: c.completion_count,
            daily_goal: c.daily_goal
          };
        });
        setDateCompletions(completionsMap);
      })
      .catch(err => {
        console.error('Error loading completions:', err);
      })
      .finally(() => {
        setLoadingDate(false);
      });

    return () => { cancelled = true; };
  }, [selectedDate, user, isToday, getCompletionsForDate]);

  // Request notification permission when user authenticates (native only)
  useEffect(() => {
    if (user && isNative) {
      requestNotificationPermission();
    }
  }, [user]);

  // Schedule notifications when habits change (native only)
  useEffect(() => {
    if (user && habits.length > 0 && isNative) {
      scheduleAllHabitNotifications(habits);
    }
  }, [habits, user]);

  // Setup notification tap listener (native only)
  useEffect(() => {
    if (!isNative) return;

    const cleanup = setupNotificationListeners((habitId) => {
      // Scroll to or highlight the tapped habit
      const habitElement = document.querySelector(`[data-habit-id="${habitId}"]`);
      if (habitElement) {
        habitElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    return cleanup;
  }, []);

  // Get completions count for a habit on the selected date
  const getHabitCompletions = (habit) => {
    if (isToday) {
      return habit.completions_today || 0;
    }
    return dateCompletions[habit.id]?.completion_count || 0;
  };

  // Check if habit is completed for the selected date
  const isHabitCompleted = (habit) => {
    return getHabitCompletions(habit) >= (habit.daily_goal || 1);
  };

  // Check if habit is scheduled for the selected/viewed date
  const isHabitScheduledForDate = (habit) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const viewedDay = new Date(year, month - 1, day).getDay(); // 0=Sun, 1=Mon, etc.
    const scheduledDays = habit.scheduled_days || [0,1,2,3,4,5,6];
    // Handle both number and string types from database
    return scheduledDays.some(d => Number(d) === viewedDay);
  };

  // Split habits into incomplete and completed for the accordion UI
  const incompleteHabits = habitsForSelectedDate.filter(h => !isHabitCompleted(h));
  const completedHabits = habitsForSelectedDate.filter(h => isHabitCompleted(h));

  // Format time as compact string (8A, 8:30P)
  const formatScheduledTime = (timeString) => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'P' : 'A';
    const hour12 = hour % 12 || 12;
    if (minutes === '00') {
      return `${hour12}${ampm}`;
    }
    return `${hour12}:${minutes}${ampm}`;
  };

  // dnd-kit sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 }
    })
  );

  // Handle drag end - reorder habits
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      // Haptic feedback for successful reorder
      hapticSelection();

      const oldIndex = habits.findIndex(h => h.id === active.id);
      const newIndex = habits.findIndex(h => h.id === over.id);

      // Optimistic update
      const newHabits = arrayMove(habits, oldIndex, newIndex);
      setHabits(newHabits);

      // Update positions in database
      setSyncing(true);
      for (let i = 0; i < newHabits.length; i++) {
        await supabase
          .from('habits')
          .update({ position: i })
          .eq('id', newHabits[i].id);
      }
      setSyncing(false);
    }
  };

  const signInWithPassword = async () => {
    if (!email.trim() || !password.trim()) return;
    
    setAuthLoading(true);
    setAuthMessage('');
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      });
      
      if (error) {
        console.error('Sign in error:', error);
        setAuthMessage(`Error: ${error.message}`);
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
      setAuthMessage('Connection error. Please check your internet connection and try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const signUpWithPassword = async () => {
    if (!email.trim() || !password.trim()) return;
    if (password.length < 6) {
      setAuthMessage('Error: Password must be at least 6 characters');
      return;
    }
    
    setAuthLoading(true);
    setAuthMessage('');
    
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      
      if (error) {
        console.error('Sign up error:', error);
        setAuthMessage(`Error: ${error.message}`);
      } else {
        setAuthMessage('Check your email to confirm your account!');
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
      setAuthMessage('Connection error. Please check your internet connection and try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const signInWithMagicLink = async () => {
    if (!email.trim()) return;
    
    setAuthLoading(true);
    setAuthMessage('');
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      
      if (error) {
        console.error('Sign in error:', error);
        setAuthMessage(`Error: ${error.message}`);
      } else {
        setAuthMessage('Check your email for the login link!');
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
      setAuthMessage('Connection error. Please check your internet connection and try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthSubmit = () => {
    if (authMode === 'magic') {
      signInWithMagicLink();
    } else if (authMode === 'signup') {
      signUpWithPassword();
    } else {
      signInWithPassword();
    }
  };

  const sendPasswordReset = async () => {
    if (!email.trim()) {
      setAuthMessage('Error: Please enter your email first');
      return;
    }
    
    setAuthLoading(true);
    setAuthMessage('');
    
    try {
      // Use the full URL with protocol for redirect
      const redirectUrl = `${window.location.protocol}//${window.location.host}`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl
      });
      
      if (error) {
        console.error('Password reset error:', error);
        // Provide more helpful error messages
        if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('Network') || error.message.includes('fetch'))) {
          setAuthMessage(`Network error. Check your connection and Supabase redirect URL settings. Add ${redirectUrl} to allowed URLs in Supabase dashboard.`);
        } else {
          setAuthMessage(`Error: ${error.message}`);
        }
      } else {
        setAuthMessage('Check your email for the password reset link!');
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
      const redirectUrl = `${window.location.protocol}//${window.location.host}`;
      if (err.message && err.message.includes('Failed to fetch')) {
        setAuthMessage(`Network error. Check connection and Supabase settings. Add ${redirectUrl} to allowed redirect URLs in Supabase dashboard → Authentication.`);
      } else {
        setAuthMessage(`Error: ${err.message || 'Connection error. Please try again.'}`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const updatePassword = async () => {
    if (!newPassword.trim()) {
      setAuthMessage('Error: Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      setAuthMessage('Error: Password must be at least 6 characters');
      return;
    }
    
    // Prevent multiple simultaneous calls
    if (isUpdatingPassword.current) {
      return;
    }
    
    isUpdatingPassword.current = true;
    setAuthLoading(true);
    setAuthMessage('');
    
    // Set a timeout to prevent infinite hanging
    const timeoutId = setTimeout(() => {
      if (isUpdatingPassword.current) {
        isUpdatingPassword.current = false;
        setAuthLoading(false);
        setAuthMessage('Request timed out. Please check your connection and try again.');
        console.error('Password update timed out');
      }
    }, 10000);
    
    try {
      console.log('Updating password...');
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword.trim()
      });
      
      clearTimeout(timeoutId);
      isUpdatingPassword.current = false;
      
      if (error) {
        console.error('Password update error:', error);
        if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('Network'))) {
          setAuthMessage('Network error. Please check your connection and try again.');
        } else {
          setAuthMessage(`Error: ${error.message}`);
        }
        setAuthLoading(false);
      } else {
        console.log('Password updated successfully');
        setAuthMessage('Password updated successfully!');
        
        // Clear URL hash if present
        if (window.location.hash.includes('type=recovery')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        
        // Don't wait for session refresh - it might hang
        supabase.auth.refreshSession().catch(err => {
          console.warn('Session refresh failed (non-critical):', err);
        });
        
        // Close modal after a brief delay
        setTimeout(() => {
          setShowPasswordReset(false);
          setNewPassword('');
          setAuthMessage('');
          setAuthLoading(false);
        }, 1500);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      isUpdatingPassword.current = false;
      console.error('Failed to update password:', err);
      if (err.message && err.message.includes('Failed to fetch')) {
        setAuthMessage('Network error. Please check your connection and try again.');
      } else {
        setAuthMessage(`Error: ${err.message || 'Connection error. Please try again.'}`);
      }
      setAuthLoading(false);
    }
  };

  const changePassword = async () => {
    if (!user?.email) {
      setSettingsMessage('Error: User email not found');
      return;
    }
    
    if (!settingsPassword.trim() || !settingsNewPassword.trim()) {
      setSettingsMessage('Error: Please enter both current and new password');
      return;
    }
    if (settingsNewPassword.length < 6) {
      setSettingsMessage('Error: New password must be at least 6 characters');
      return;
    }
    
    setSettingsLoading(true);
    setSettingsMessage('');
    
    try {
      // First verify current password by trying to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: settingsPassword.trim()
      });
      
      if (signInError) {
        setSettingsMessage('Error: Current password is incorrect');
        setSettingsLoading(false);
        return;
      }
      
      // If current password is correct, update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: settingsNewPassword.trim()
      });
      
      if (updateError) {
        console.error('Password update error:', updateError);
        setSettingsMessage(`Error: ${updateError.message}`);
      } else {
        setSettingsMessage('Password changed successfully!');
        setSettingsPassword('');
        setSettingsNewPassword('');
        setTimeout(() => {
          setSettingsMessage('');
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to change password:', err);
      setSettingsMessage(`Error: ${err.message || 'Failed to change password. Please try again.'}`);
    } finally {
      setSettingsLoading(false);
    }
  };

  const signOut = async () => {
    console.log('Sign out called');
    
    // Clear modals and state immediately
    setShowAddModal(false);
    setShowPasswordReset(false);
    setShowSettings(false);
    setHabits([]);
    setUser(null);
    
    try {
      // Sign out from Supabase - this will trigger the SIGNED_OUT event
      const { error } = await supabase.auth.signOut();
      
      console.log('Sign out result:', error ? 'error' : 'success', error);
      
      if (error) {
        console.error('Sign out error:', error);
        // State already cleared above, but ensure it stays cleared
        setHabits([]);
        setUser(null);
      }
      // If successful, the auth state change listener will also handle it
      // but we've already cleared state above as a safeguard
      
    } catch (err) {
      console.error('Failed to sign out:', err);
      // Ensure state is cleared even on error
      setHabits([]);
      setUser(null);
    }
  };

  const incrementHabit = async (id) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    // Add haptic feedback
    hapticMedium();

    const dailyGoal = habit.daily_goal || 1;

    // Handle past date completions differently
    if (!isToday) {
      const currentCompletions = dateCompletions[id]?.completion_count || 0;
      const newCompletions = (currentCompletions + 1) % (dailyGoal + 1);

      // Optimistic update for past date
      setDateCompletions(prev => ({
        ...prev,
        [id]: { completion_count: newCompletions, daily_goal: dailyGoal }
      }));

      setSyncing(true);
      await recordCompletion(id, newCompletions, dailyGoal, selectedDate);

      // Recalculate streak based on all completions
      const calculatedStreak = await calculateStreakForHabit(id, dailyGoal);
      const newStreak = calculatedStreak !== null ? calculatedStreak : (habit.streak || 0);

      // Update the habit's streak in state and database
      setHabits(prev => prev.map(h =>
        h.id === id ? { ...h, streak: newStreak } : h
      ));

      await supabase
        .from('habits')
        .update({ streak: newStreak })
        .eq('id', id);

      setSyncing(false);
      return;
    }

    // Today's logic (existing behavior)
    const currentCompletions = habit.completions_today || 0;
    const newCompletions = (currentCompletions + 1) % (dailyGoal + 1);
    const wasCompleted = habit.completed_today;
    const nowCompleted = newCompletions >= dailyGoal;

    // Adjust streak based on completion status change
    let currentStreak = habit.streak || 0;

    // If streak is 0 but history shows yesterday was completed, restore it
    if (currentStreak === 0 && !wasCompleted && nowCompleted) {
      const history = habit.history || [];
      // history[6] is yesterday (most recent in the 7-day array before today)
      if (history.length > 0 && history[history.length - 1] === 1) {
        // Count consecutive days from history
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i] === 1) currentStreak++;
          else break;
        }
      }
    }

    let newStreak = currentStreak;
    if (!wasCompleted && nowCompleted) {
      newStreak = currentStreak + 1;
    } else if (wasCompleted && !nowCompleted) {
      newStreak = Math.max(0, currentStreak - 1);
    }

    // Optimistic update
    setHabits(habits.map(h =>
      h.id === id ? { ...h, completions_today: newCompletions, completed_today: nowCompleted, streak: newStreak } : h
    ));

    setSyncing(true);
    const { error } = await supabase
      .from('habits')
      .update({ completions_today: newCompletions, completed_today: nowCompleted, streak: newStreak })
      .eq('id', id);

    if (error) {
      console.error('Error updating habit:', error);
      // Revert on error
      setHabits(habits);
    } else {
      // Record to completions table for activity tracking
      await recordCompletion(id, newCompletions, dailyGoal);

      // Feed the Hagotchi spirit when completing a habit (not un-completing)
      if (!wasCompleted && nowCompleted) {
        const result = await feedSpirit(newStreak);
        if (result) {
          setLastVitalityGain(result.vitalityGain);
          setFeedingAnimation(true);
          setTimeout(() => setFeedingAnimation(false), 1500);
        }
      }
    }
    setSyncing(false);
  };

  const addHabit = async () => {
    if (!newHabitName.trim() || !user) return;

    const newHabit = {
      user_id: user.id,
      name: newHabitName.toLowerCase(),
      icon: icons[habits.length % icons.length],
      streak: 0,
      completed_today: false,
      completions_today: 0,
      daily_goal: newHabitGoal,
      position: habits.length,
      scheduled_time: newHabitTime || null,
      scheduled_days: newHabitDays,
      history: [0, 0, 0, 0, 0, 0, 0]
    };

    setSyncing(true);
    const { data, error } = await supabase
      .from('habits')
      .insert([newHabit])
      .select()
      .single();

    if (error) {
      console.error('Error adding habit:', error);
      setSyncing(false);
      return;
    }

    // Close modal and reset form FIRST
    setNewHabitName('');
    setNewHabitGoal(1);
    setNewHabitTime('');
    setNewHabitDays([0,1,2,3,4,5,6]);
    setShowAddModal(false);
    setSyncing(false);

    // Wait for modal animation to complete (300ms), then update habits
    // This prevents layout shift on iOS caused by simultaneous modal close + state update
    setTimeout(() => {
      setHabits(prev => [...prev, data]);
    }, 350);
  };

  const deleteHabit = async (id) => {
    setSyncing(true);
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting habit:', error);
    } else {
      setHabits(habits.filter(h => h.id !== id));
    }
    setSyncing(false);
  };

  const startEditHabit = (habit) => {
    setEditingHabit(habit);
    setEditHabitName(habit.name);
    setEditHabitGoal(habit.daily_goal || 1);
    setEditHabitTime(habit.scheduled_time || '');
    setEditHabitDays(habit.scheduled_days || [0,1,2,3,4,5,6]);
    setConfirmingDeleteId(null);
    setOpenMenuId(null);
  };

  const updateHabit = async () => {
    if (!editHabitName.trim() || !editingHabit) return;

    const habitId = editingHabit.id;
    const updates = {
      name: editHabitName.toLowerCase(),
      daily_goal: editHabitGoal,
      scheduled_time: editHabitTime || null,
      scheduled_days: editHabitDays
    };

    setSyncing(true);
    const { error } = await supabase
      .from('habits')
      .update(updates)
      .eq('id', habitId);

    if (error) {
      console.error('Error updating habit:', error);
      setSyncing(false);
      return;
    }

    // Close modal and reset form FIRST
    setEditingHabit(null);
    setEditHabitName('');
    setEditHabitGoal(1);
    setEditHabitTime('');
    setEditHabitDays([0,1,2,3,4,5,6]);
    setSyncing(false);

    // Wait for modal animation to complete (300ms), then update habits
    // This prevents layout shift on iOS caused by simultaneous modal close + state update
    setTimeout(() => {
      setHabits(prev => prev.map(h =>
        h.id === habitId ? { ...h, ...updates } : h
      ));
    }, 350);
  };

  // Swipe gesture handlers for native mobile experience
  const SWIPE_THRESHOLD = 80;
  const SWIPE_VELOCITY_THRESHOLD = 0.3;

  const handleTouchStart = (e, habitId) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    setActiveSwipe(habitId);
    setSwipeState(prev => ({ ...prev, [habitId]: 0 }));
  };

  const handleTouchMove = (e, habitId) => {
    if (!isMobile || activeSwipe !== habitId) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStartRef.current.x;
    const deltaY = touch.clientY - swipeStartRef.current.y;

    // Only track horizontal swipes (ignore vertical scrolling)
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaX) < 10) return;

    // CSS touch-action: pan-y handles preventing horizontal scroll
    // Limit swipe range with resistance at edges
    const maxSwipe = 120;
    const clampedX = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));
    setSwipeState(prev => ({ ...prev, [habitId]: clampedX }));
  };

  const handleTouchEnd = (habitId) => {
    if (!isMobile || activeSwipe !== habitId) return;

    const swipeX = swipeState[habitId] || 0;
    const elapsed = Date.now() - swipeStartRef.current.time;
    const velocity = Math.abs(swipeX) / elapsed;

    // Check if swipe meets threshold (distance or velocity)
    const isValidSwipe = Math.abs(swipeX) > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD;

    if (isValidSwipe) {
      if (swipeX > SWIPE_THRESHOLD || (swipeX > 30 && velocity > SWIPE_VELOCITY_THRESHOLD)) {
        // Swipe right - toggle completion
        hapticMedium();
        setCompletedAnimation(habitId);
        setTimeout(() => setCompletedAnimation(null), 300);
        incrementHabit(habitId);
      } else if (swipeX < -SWIPE_THRESHOLD || (swipeX < -30 && velocity > SWIPE_VELOCITY_THRESHOLD)) {
        // Swipe left - delete (with confirmation)
        hapticError();
        setConfirmingDeleteId(habitId);
      }
    }

    // Reset swipe state with animation
    setSwipeState(prev => ({ ...prev, [habitId]: 0 }));
    setActiveSwipe(null);
  };

  // Tap handler for quick completion toggle
  const handleTap = (habitId) => {
    if (!isMobile) return;
    hapticLight();
    setCompletedAnimation(habitId);
    setTimeout(() => setCompletedAnimation(null), 200);
    incrementHabit(habitId);
  };

  // Dismiss mobile hint
  const dismissMobileHint = () => {
    localStorage.setItem('habito_mobile_hint_seen', 'true');
    setShowMobileHint(false);
  };

  const completedCount = habitsForSelectedDate.filter(h => getHabitCompletions(h) >= (h.daily_goal || 1)).length;
  // Calculate progress including partial completions on multi-goal habits
  const totalProgress = habitsForSelectedDate.reduce((sum, h) => {
    const goal = h.daily_goal || 1;
    const completions = getHabitCompletions(h);
    return sum + Math.min(completions / goal, 1);
  }, 0);
  const completionPercent = habitsForSelectedDate.length > 0 ? Math.round((totalProgress / habitsForSelectedDate.length) * 100) : 0;

  // Track previous completion percent to detect when it reaches 100%
  const prevCompletionPercentRef = useRef(0);
  useEffect(() => {
    if (completionPercent === 100 && prevCompletionPercentRef.current < 100 && habitsForSelectedDate.length > 0 && isToday) {
      hapticSuccess();
    }
    prevCompletionPercentRef.current = completionPercent;
  }, [completionPercent, habitsForSelectedDate.length, isToday]);

  const generateProgressBar = (percent, width = 20) => {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
  };

  if (bootSequence) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        fontFamily: '"IBM Plex Mono", "Fira Code", "SF Mono", monospace',
        color: '#00ff41',
        padding: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: bootFading ? 0 : 1,
        transition: 'opacity 0.6s ease-out',
      }}>
        <div style={{ maxWidth: '600px', width: '100%' }}>
          {bootMessages.slice(0, bootLine).map((msg, i) => {
            const isReady = msg.includes('ready');
            return (
              <div key={i} style={{
                marginBottom: '8px',
                opacity: i < bootLine - 1 ? 0.5 : 1,
                fontSize: '14px',
                letterSpacing: '0.5px',
                textShadow: isReady ? '0 0 10px #00ff41' : 'none',
              }}>
                {isReady ? (
                  <>
                    {'> ready'}
                    <span style={{ opacity: cursorBlink ? 1 : 0 }}>_</span>
                  </>
                ) : msg}
              </div>
            );
          })}
          {bootLine < bootMessages.length && !bootMessages[bootLine - 1]?.includes('ready') && (
            <span style={{ opacity: cursorBlink ? 1 : 0 }}>▌</span>
          )}
        </div>
      </div>
    );
  }

  // Auth screen
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        fontFamily: '"IBM Plex Mono", "Fira Code", "SF Mono", monospace',
        color: '#c0c0c0',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Scanline effect */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
          pointerEvents: 'none',
          zIndex: 1000
        }} />

        {/* CRT vignette */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
          pointerEvents: 'none',
          zIndex: 999
        }} />

        <div style={{ 
          maxWidth: '400px', 
          width: '100%', 
          textAlign: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'flex-end', marginBottom: '30px' }}>
            <pre style={{
              color: '#00ff41',
              fontSize: '8px',
              lineHeight: '1.2',
              margin: 0,
              textShadow: '0 0 10px #00ff41'
            }}>
{`
 ██╗  ██╗ █████╗  ██████╗  ██████╗ ████████╗ ██████╗██╗  ██╗██╗
 ██║  ██║██╔══██╗██╔════╝ ██╔═══██╗╚══██╔══╝██╔════╝██║  ██║██║
 ███████║███████║██║  ███╗██║   ██║   ██║   ██║     ███████║██║
 ██╔══██║██╔══██║██║   ██║██║   ██║   ██║   ██║     ██╔══██║██║
 ██║  ██║██║  ██║╚██████╔╝╚██████╔╝   ██║   ╚██████╗██║  ██║██║
 ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝`}
            </pre>
          </div>

          <div style={{
            border: '1px solid #333',
            backgroundColor: '#0d0d0d',
            padding: '24px'
          }}>
            <div style={{ 
              color: '#00ff41', 
              marginBottom: '20px',
              fontSize: '12px',
              letterSpacing: '1px'
            }}>
              &gt; {authMode === 'signup' ? 'CREATE ACCOUNT' : authMode === 'magic' ? 'MAGIC LINK' : 'SIGN IN'}{cursorBlink ? '▌' : ' '}
            </div>

            {/* Auth mode tabs */}
            <div style={{
              display: 'flex',
              gap: '4px',
              marginBottom: '20px',
              fontSize: '10px'
            }}>
              {[
                { key: 'signin', label: 'PASSWORD' },
                { key: 'signup', label: 'SIGN UP' },
                { key: 'magic', label: 'MAGIC LINK' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setAuthMode(key);
                    setAuthMessage('');
                  }}
                  style={{
                    flex: 1,
                    background: authMode === key ? '#1a1a1a' : 'transparent',
                    border: '1px solid #333',
                    borderBottom: authMode === key ? '1px solid #0d0d0d' : '1px solid #333',
                    color: authMode === key ? '#00ff41' : '#666',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: '0.5px',
                    marginBottom: '-1px'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{
              color: '#fff',
              fontSize: '11px',
              marginBottom: '20px',
              lineHeight: '1.6'
            }}>
              {authMode === 'magic' 
                ? 'enter your email to receive a magic login link'
                : authMode === 'signup'
                ? 'create a new account with email & password'
                : 'sign in with your email & password'}
            </div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '14px',
                marginBottom: '12px',
                outline: 'none'
              }}
              onKeyDown={(e) => e.key === 'Enter' && (authMode === 'magic' ? handleAuthSubmit() : document.getElementById('password-input')?.focus())}
              onFocus={(e) => e.target.style.borderColor = '#00ff41'}
              onBlur={(e) => e.target.style.borderColor = '#333'}
            />

            {authMode !== 'magic' && (
              <input
                id="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  marginBottom: '12px',
                  outline: 'none'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAuthSubmit()}
                onFocus={(e) => e.target.style.borderColor = '#00ff41'}
                onBlur={(e) => e.target.style.borderColor = '#333'}
              />
            )}

            <button
              onClick={handleAuthSubmit}
              disabled={authLoading}
              style={{
                width: '100%',
                padding: '14px 20px',
                backgroundColor: authLoading ? '#1a1a1a' : '#00ff41',
                border: 'none',
                color: authLoading ? '#666' : '#000',
                cursor: authLoading ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                fontSize: '12px',
                fontWeight: 'bold',
                letterSpacing: '1px',
                transition: 'all 0.15s'
              }}
            >
              {authLoading 
                ? '[PROCESSING...]' 
                : authMode === 'magic' 
                ? '[SEND MAGIC LINK]' 
                : authMode === 'signup'
                ? '[CREATE ACCOUNT]'
                : '[SIGN IN]'}
            </button>

            {authMode === 'signin' && (
              <button
                onClick={sendPasswordReset}
                disabled={authLoading}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '10px',
                  backgroundColor: 'transparent',
                  border: '1px solid #333',
                  color: '#fff',
                  cursor: authLoading ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => {
                  e.target.style.borderColor = '#00ff41';
                  e.target.style.color = '#00ff41';
                }}
                onMouseLeave={e => {
                  e.target.style.borderColor = '#333';
                  e.target.style.color = '#888';
                }}
              >
                set/reset password
              </button>
            )}

            {authMessage && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: authMessage.includes('Error') ? 'rgba(255,0,0,0.1)' : 'rgba(0,255,65,0.1)',
                border: `1px solid ${authMessage.includes('Error') ? '#ff4444' : '#00ff41'}`,
                color: authMessage.includes('Error') ? '#ff4444' : '#00ff41',
                fontSize: '11px',
                textAlign: 'center',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {authMessage}
              </div>
            )}
          </div>

          <div style={{
            marginTop: '24px',
            fontSize: '10px',
            color: '#333'
          }}>
            HAGOTCHI v2.5.0 • consistency compounds
          </div>
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        `}</style>
      </div>
    );
  }

  return (
    <div
      className={isMobile ? 'mobile-app-container' : ''}
      style={{
        minHeight: isMobile ? undefined : '100vh',
        height: isMobile ? '100%' : undefined,
        backgroundColor: '#0a0a0a',
        fontFamily: '"IBM Plex Mono", "Fira Code", "SF Mono", monospace',
        color: '#c0c0c0',
        padding: isMobile ? '0' : '32px',
      }}>
      {/* Scanline effect */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
        pointerEvents: 'none',
        zIndex: 1000
      }} />

      {/* CRT vignette */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
        pointerEvents: 'none',
        zIndex: 999
      }} />

      {/* Header Container - flex item at top on mobile */}
      <div
        className={isMobile ? 'mobile-header' : ''}
        style={{
          ...(!isMobile && {
            maxWidth: '700px',
            margin: '0 auto',
            marginBottom: '24px',
          }),
          backgroundColor: '#0a0a0a',
          boxShadow: isMobile ? '0 2px 12px rgba(0,0,0,0.6)' : 'none',
        }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: isMobile ? '8px 20px' : '0' }}>
          {/* Top row: Logo on left, Menu on right */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: isMobile ? '8px' : '12px'
          }}>
            {/* Logo on left */}
            <div style={{ display: 'inline-flex', alignItems: 'flex-end' }}>
              <pre style={{
                color: '#00ff41',
                fontSize: isMobile ? '5px' : '10px',
                lineHeight: '1.2',
                margin: 0,
                textShadow: '0 0 10px #00ff41'
              }}>
{`
 ██╗  ██╗ █████╗  ██████╗  ██████╗ ████████╗ ██████╗██╗  ██╗██╗
 ██║  ██║██╔══██╗██╔════╝ ██╔═══██╗╚══██╔══╝██╔════╝██║  ██║██║
 ███████║███████║██║  ███╗██║   ██║   ██║   ██║     ███████║██║
 ██╔══██║██╔══██║██║   ██║██║   ██║   ██║   ██║     ██╔══██║██║
 ██║  ██║██║  ██║╚██████╔╝╚██████╔╝   ██║   ╚██████╗██║  ██║██║
 ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝`}
              </pre>
            </div>

            {/* Mobile: More menu button in header */}
            {isMobile && (
              <button
                onClick={() => setShowMobileMenu(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid #333',
                  color: '#fff',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  lineHeight: 1,
                }}
              >
                ⋮
              </button>
            )}
          </div>

          {/* Status bar */}
          <div style={{
            borderTop: '1px solid #333',
            borderBottom: '1px solid #333',
            padding: isMobile ? '8px 0' : '10px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: isMobile ? '10px' : '12px'
          }}>
            <span style={{ color: '#fff' }}>
              {new Date().toLocaleDateString('en-US', {
                weekday: isMobile ? 'short' : 'long',
                month: 'short',
                day: 'numeric'
              }).toUpperCase()}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
              {syncing && (
                <span style={{ color: '#ffaa00', fontSize: '10px' }}>
                  SYNCING...
                </span>
              )}
              {!isMobile && (
                <>
                  <button
                    onClick={() => setShowSettings(true)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #333',
                      color: '#fff',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '9px',
                      letterSpacing: '0.5px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = '#00ff41';
                      e.target.style.color = '#00ff41';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = '#333';
                      e.target.style.color = '#888';
                    }}
                  >
                    [SETTINGS]
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      signOut();
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid #333',
                      color: '#fff',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '9px',
                      letterSpacing: '0.5px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = '#ff4444';
                      e.target.style.color = '#ff4444';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = '#333';
                      e.target.style.color = '#888';
                    }}
                  >
                    [LOGOUT]
                  </button>
                </>
              )}
              <span style={{ color: '#00ff41', fontSize: isMobile ? '9px' : '12px' }}>
                {cursorBlink ? '●' : '○'} ONLINE
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '10px',
            padding: isMobile ? '8px 0 4px' : '10px 0 4px',
            fontSize: isMobile ? '11px' : '12px',
          }}>
            {/* Left bracket + percentage */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
            }}>
              <span style={{ color: '#555', fontSize: isMobile ? '10px' : '11px' }}>├</span>
              <span style={{
                color: completionPercent === 100 ? '#00ff41' : '#888',
                fontWeight: 'bold',
                fontSize: isMobile ? '11px' : '13px',
                textShadow: completionPercent === 100 ? '0 0 8px #00ff41' : 'none',
                minWidth: isMobile ? '32px' : '38px',
              }}>
                {completionPercent}%
              </span>
            </div>

            {/* Progress bar - flexes to fill with block pattern */}
            <div style={{
              flex: 1,
              height: isMobile ? '10px' : '12px',
              backgroundColor: '#222',
              borderRadius: '1px',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <div style={{
                width: `${completionPercent}%`,
                height: '100%',
                backgroundColor: completionPercent === 100 ? '#00ff41' : '#555',
                boxShadow: completionPercent === 100 ? '0 0 8px #00ff41' : 'none',
                transition: 'width 0.3s ease',
                // Segmented block pattern
                backgroundImage: `repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 4px,
                  #0a0a0a 4px,
                  #0a0a0a 5px
                )`,
                backgroundSize: '5px 100%',
              }} />
            </div>

            {/* Right: Task count + bracket */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
            }}>
              <span style={{
                color: completionPercent === 100 ? '#00ff41' : '#666',
                fontSize: isMobile ? '10px' : '11px',
                textShadow: completionPercent === 100 ? '0 0 6px #00ff41' : 'none',
              }}>
                {completedCount}/{habitsForSelectedDate.length}
              </span>
              <span style={{
                color: completionPercent === 100 ? '#00ff41' : '#555',
                fontSize: isMobile ? '9px' : '10px',
                letterSpacing: '1px',
                textShadow: completionPercent === 100 ? '0 0 6px #00ff41' : 'none',
              }}>
                {completionPercent === 100 ? '✓' : 'TODO'}
              </span>
              <span style={{ color: '#555', fontSize: isMobile ? '10px' : '11px' }}>┤</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content area for mobile */}
      <div className={isMobile ? 'mobile-content' : ''} style={isMobile ? { paddingLeft: '20px', paddingRight: '20px' } : undefined}>

      <div style={{ maxWidth: '700px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Navigation - Desktop only (mobile uses floating island) */}
        {!isMobile && (
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '16px',
          fontSize: '11px',
          alignItems: 'center'
        }}>
          {['today', 'activity'].map(view => (
            <button
              key={view}
              onClick={() => {
                setSelectedView(view);
                if (view === 'today') setSelectedDate(today);
              }}
              style={{
                background: selectedView === view ? '#1a1a1a' : 'transparent',
                border: '1px solid #333',
                borderBottom: selectedView === view ? '1px solid #0d0d0d' : '1px solid #333',
                color: selectedView === view ? '#00ff41' : '#666',
                padding: '8px 16px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '-1px'
              }}
            >
              [{view === 'today' ? formatDateLabel(selectedDate) : view}]
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
            <button
              onClick={() => navigateDate(-1)}
              disabled={!canGoBack}
              style={{
                background: 'transparent',
                border: '1px solid #333',
                color: canGoBack ? '#666' : '#333',
                padding: '8px 12px',
                cursor: canGoBack ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit'
              }}
              title="Previous day"
            >
              ←
            </button>
            <button
              onClick={() => navigateDate(1)}
              disabled={isToday}
              style={{
                background: 'transparent',
                border: '1px solid #333',
                color: isToday ? '#333' : '#666',
                padding: '8px 12px',
                cursor: isToday ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit'
              }}
              title="Next day"
            >
              →
            </button>
          </div>
        </div>
        )}

        {/* Hagotchi Companion - Only show on Today view */}
        {selectedView === 'today' && spirit && currentSkin && (
          <div style={{ marginBottom: '16px' }}>
            <HagotchiCompanion
              skin={currentSkin}
              vitality={spirit.vitality}
              isMobile={isMobile}
              onTap={() => setShowSkinCollection(true)}
              feeding={feedingAnimation}
              vitalityGain={lastVitalityGain}
            />
            {/* Quick action buttons */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '8px',
            }}>
              <button
                onClick={() => setShowSkinCollection(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid #333',
                  color: '#666',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '9px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#00ff41';
                  e.target.style.color = '#00ff41';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#333';
                  e.target.style.color = '#666';
                }}
              >
                [skins {spirit.unlocked_skin_ids.length}/8]
              </button>
              <button
                onClick={() => setShowLoreArchive(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid #333',
                  color: '#666',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '9px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#00ff41';
                  e.target.style.color = '#00ff41';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#333';
                  e.target.style.color = '#666';
                }}
              >
                [lore]
              </button>
            </div>
          </div>
        )}

        {/* Habits List - Only show on Today view */}
        {selectedView === 'today' && (
        <div style={{
          border: '1px solid #333',
          backgroundColor: '#0d0d0d'
        }}>
          <div style={{
            borderBottom: '1px solid #333',
            padding: '8px 12px',
            fontSize: '11px',
            color: '#fff',
            display: 'grid',
            gridTemplateColumns: isMobile
              ? '24px 1fr 32px 50px'
              : '30px 1fr 50px 60px 28px',
            gap: isMobile ? '6px' : '8px'
          }}>
            <span></span>
            <span>HABIT</span>
            <span style={{ textAlign: 'center' }}>{isMobile ? '' : 'STATUS'}</span>
            <span style={{ textAlign: 'right' }}>{isMobile ? '' : 'STREAK'}</span>
            {!isMobile && <span></span>}
          </div>

          {loading || loadingDate ? (
            <div style={{
              padding: '40px 12px',
              textAlign: 'center',
              color: '#00ff41',
              fontSize: '12px'
            }}>
              {loadingDate ? `loading ${formatDateLabel(selectedDate)}...` : 'loading habits...'}
            </div>
          ) : fetchError ? (
            <div style={{
              padding: '40px 12px',
              textAlign: 'center',
              color: '#ff4141',
              fontSize: '12px'
            }}>
              error: {fetchError}
              <br />
              <button
                onClick={() => user && fetchHabits(user.id).then(setHabits)}
                style={{
                  marginTop: '12px',
                  background: 'transparent',
                  border: '1px solid #ff4141',
                  color: '#ff4141',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                retry
              </button>
            </div>
          ) : habitsForSelectedDate.length === 0 ? (
            <div style={{
              padding: '40px 12px',
              textAlign: 'center',
              color: '#fff',
              fontSize: '12px'
            }}>
              {habits.length === 0 ? 'no habits tracked. add one below.' : 'no habits existed on this date.'}
            </div>
          ) : (
            <>
              {/* Mobile swipe hint */}
              {isMobile && showMobileHint && habitsForSelectedDate.length > 0 && (
                <div
                  onClick={dismissMobileHint}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(0,255,65,0.05)',
                    borderBottom: '1px solid #222',
                    fontSize: '12px',
                    color: '#fff',
                    cursor: 'pointer',
                    animation: 'fadeIn 0.3s ease-out'
                  }}
                >
                  <span><span style={{ color: '#00ff41' }}>→</span> complete</span>
                  <span style={{ color: '#fff', fontSize: '10px' }}>[dismiss]</span>
                  <span>options <span style={{ color: '#ff4444' }}>←</span></span>
                </div>
              )}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={incompleteHabits.map(h => h.id)}
                  strategy={verticalListSortingStrategy}
                >
              {incompleteHabits.map((habit, index) => (
              <SortableItem key={habit.id} id={habit.id} disabled={isMobile}>
                {({ listeners, isDragging }) => (
              <div
                data-habit-id={habit.id}
                style={{
                  position: 'relative',
                  overflow: isMobile ? 'hidden' : 'visible',
                  borderBottom: index < incompleteHabits.length - 1 || completedHabits.length > 0 ? '1px solid #222' : 'none'
                }}
              >
                {isMobile ? (
                  /* Mobile: Native single-row swipeable layout */
                  <>
                    {/* Swipe action backgrounds */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      pointerEvents: 'none'
                    }}>
                      {/* Complete action (green, left side - revealed on swipe right) */}
                      <div style={{
                        flex: 1,
                        background: `linear-gradient(90deg, rgba(0,255,65,${Math.min(0.3, Math.abs((swipeState[habit.id] || 0) / 200))}) 0%, transparent 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: '16px',
                        color: '#00ff41',
                        fontSize: '18px',
                        opacity: (swipeState[habit.id] || 0) > 20 ? 1 : 0,
                        transition: 'opacity 0.1s'
                      }}>
                        ✓
                      </div>
                      {/* Delete action (red, right side - revealed on swipe left) */}
                      <div style={{
                        flex: 1,
                        background: `linear-gradient(270deg, rgba(255,68,68,${Math.min(0.3, Math.abs((swipeState[habit.id] || 0) / 200))}) 0%, transparent 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: '16px',
                        color: '#ff4444',
                        fontSize: '18px',
                        opacity: (swipeState[habit.id] || 0) < -20 ? 1 : 0,
                        transition: 'opacity 0.1s'
                      }}>
                        ✕
                      </div>
                    </div>

                    {/* Swipeable habit row */}
                    <div
                      onTouchStart={(e) => handleTouchStart(e, habit.id)}
                      onTouchMove={(e) => handleTouchMove(e, habit.id)}
                      onTouchEnd={() => handleTouchEnd(habit.id)}
                      onClick={() => !activeSwipe && handleTap(habit.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '14px 12px',
                        gap: '8px',
                        transform: `translateX(${swipeState[habit.id] || 0}px)`,
                        transition: activeSwipe === habit.id ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                        backgroundColor: completedAnimation === habit.id
                          ? 'rgba(0,255,65,0.15)'
                          : isHabitCompleted(habit)
                            ? 'rgba(0,255,65,0.03)'
                            : '#0a0a0a',
                        cursor: 'pointer',
                        userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'pan-y',
                        position: 'relative',
                        zIndex: 1
                      }}
                    >
                      {/* Icon (matching desktop style) */}
                      <span style={{
                        fontSize: '18px',
                        color: isHabitCompleted(habit) ? '#00ff41' : '#666',
                        textShadow: isHabitCompleted(habit) ? '0 0 8px #00ff41' : 'none',
                        width: '28px',
                        textAlign: 'center',
                        flexShrink: 0,
                        opacity: !isHabitScheduledForDate(habit) && !isHabitCompleted(habit) ? 0.5 : 1
                      }}>
                        {habit.icon}
                      </span>

                      {/* Habit name + time */}
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        overflow: 'hidden'
                      }}>
                        <span style={{
                          color: isHabitCompleted(habit) ? '#00ff41' : '#fff',
                          fontSize: '15px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textDecoration: !isHabitScheduledForDate(habit) && !isHabitCompleted(habit) ? 'line-through' : 'none',
                          opacity: !isHabitScheduledForDate(habit) && !isHabitCompleted(habit) ? 0.5 : 1
                        }}>
                          {habit.name}
                        </span>
                        {formatScheduledTime(habit.scheduled_time) && (
                          <span style={{
                            fontSize: '10px',
                            color: '#fff',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '2px 5px',
                            borderRadius: '3px',
                            flexShrink: 0,
                            opacity: !isHabitScheduledForDate(habit) && !isHabitCompleted(habit) ? 0.5 : 1
                          }}>
                            {formatScheduledTime(habit.scheduled_time)}
                          </span>
                        )}
                      </div>

                      {/* Progress dots (matching desktop style) */}
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        flexShrink: 0,
                        opacity: !isHabitScheduledForDate(habit) && !isHabitCompleted(habit) ? 0.5 : 1
                      }}>
                        {Array.from({ length: habit.daily_goal || 1 }).map((_, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: '12px',
                              color: i < getHabitCompletions(habit) ? '#00ff41' : '#666',
                              textShadow: i < getHabitCompletions(habit) ? '0 0 4px #00ff41' : 'none'
                            }}
                          >
                            {i < getHabitCompletions(habit) ? '●' : '○'}
                          </span>
                        ))}
                      </div>

                      {/* Streak */}
                      <span style={{
                        color: habit.streak > 7 ? '#00ff41' : habit.streak > 3 ? '#ffaa00' : '#888',
                        fontSize: '14px',
                        minWidth: '50px',
                        textAlign: 'right',
                        flexShrink: 0,
                        opacity: !isHabitScheduledForDate(habit) && !isHabitCompleted(habit) ? 0.5 : 1
                      }}>
                        {habit.streak > 0 ? `${habit.streak}d 🔥` : ''}
                      </span>
                    </div>

                    {/* Action overlay (Edit/Delete) */}
                    {confirmingDeleteId === habit.id && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(10,10,10,0.95)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        zIndex: 10,
                        animation: 'fadeIn 0.15s ease-out'
                      }}>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #444',
                            color: '#fff',
                            padding: '10px 16px',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '12px',
                            borderRadius: '4px'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => startEditHabit(habit)}
                          style={{
                            background: 'rgba(0,255,65,0.1)',
                            border: '1px solid #00ff41',
                            color: '#00ff41',
                            padding: '10px 16px',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '12px',
                            borderRadius: '4px'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            deleteHabit(habit.id);
                            setConfirmingDeleteId(null);
                          }}
                          style={{
                            background: 'rgba(255,68,68,0.1)',
                            border: '1px solid #ff4444',
                            color: '#ff4444',
                            padding: '10px 16px',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '12px',
                            borderRadius: '4px'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  /* Desktop: Single-row grid layout - clickable to toggle */
                  <>
                    <div
                      onClick={(e) => {
                        // Don't toggle if clicking on menu button or menu
                        if (e.target.closest('[data-menu]')) return;
                        incrementHabit(habit.id);
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '30px 1fr 50px 60px 28px',
                        gap: '8px',
                        alignItems: 'center',
                        padding: '12px',
                        backgroundColor: isHabitCompleted(habit) ? 'rgba(0,255,65,0.03)' : 'transparent',
                        transition: 'background 0.15s',
                        cursor: 'pointer'
                      }}
                    >
                      {/* Icon */}
                      <span style={{
                        fontSize: '16px',
                        color: isHabitCompleted(habit) ? '#00ff41' : '#666',
                        textShadow: isHabitCompleted(habit) ? '0 0 8px #00ff41' : 'none',
                        opacity: !isHabitScheduledForDate(habit) && !isHabitCompleted(habit) ? 0.35 : 1
                      }}>
                        {habit.icon}
                      </span>

                      {/* Name + Time badge */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: !isHabitScheduledForDate(habit) && !isHabitCompleted(habit) ? 0.35 : 1
                      }}>
                        <span style={{
                          color: isHabitCompleted(habit) ? '#00ff41' : '#fff',
                          fontSize: '13px'
                        }}>
                          {habit.name}
                        </span>
                        {formatScheduledTime(habit.scheduled_time) && (
                          <span style={{
                            fontSize: '10px',
                            color: '#fff',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            padding: '2px 5px',
                            borderRadius: '3px'
                          }}>
                            {formatScheduledTime(habit.scheduled_time)}
                          </span>
                        )}
                      </div>

                      {/* Progress dots */}
                      <div style={{
                        display: 'flex',
                        gap: '3px',
                        justifyContent: 'center',
                        opacity: !isHabitScheduledForDate(habit) && !isHabitCompleted(habit) ? 0.35 : 1
                      }}>
                        {Array.from({ length: habit.daily_goal || 1 }).map((_, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: '10px',
                              color: i < getHabitCompletions(habit) ? '#00ff41' : '#666',
                              textShadow: i < getHabitCompletions(habit) ? '0 0 4px #00ff41' : 'none'
                            }}
                          >
                            {i < getHabitCompletions(habit) ? '●' : '○'}
                          </span>
                        ))}
                      </div>

                      {/* Streak */}
                      <span style={{
                        color: habit.streak > 7 ? '#00ff41' : habit.streak > 3 ? '#ffaa00' : '#888',
                        fontSize: '12px',
                        textAlign: 'right',
                        opacity: !isHabitScheduledForDate(habit) && !isHabitCompleted(habit) ? 0.35 : 1
                      }}>
                        {habit.streak > 0 ? `${habit.streak}d 🔥` : ''}
                      </span>

                      {/* 3-dot menu button - far right, always visible */}
                      <div data-menu style={{ position: 'relative', justifySelf: 'end' }}>
                        <button
                          {...listeners}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === habit.id ? null : habit.id);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: openMenuId === habit.id ? '#00ff41' : isDragging ? '#00ff41' : '#666',
                            cursor: isDragging ? 'grabbing' : 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '16px',
                            padding: '4px 8px',
                            lineHeight: 1,
                            transition: 'all 0.15s',
                            touchAction: 'none'
                          }}
                          onMouseEnter={e => e.target.style.color = '#00ff41'}
                          onMouseLeave={e => { if (openMenuId !== habit.id && !isDragging) e.target.style.color = '#888'; }}
                          title="Menu"
                        >
                          ⋮
                        </button>

                        {/* Dropdown menu */}
                        {openMenuId === habit.id && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              backgroundColor: '#111',
                              border: '1px solid #333',
                              borderRadius: '4px',
                              zIndex: 1000,
                              minWidth: '100px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.7)',
                              overflow: 'hidden'
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                startEditHabit(habit);
                                setOpenMenuId(null);
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px 14px',
                                background: 'transparent',
                                border: 'none',
                                color: '#aaa',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                fontSize: '12px',
                                textAlign: 'left',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => {
                                e.target.style.backgroundColor = 'rgba(0,255,65,0.15)';
                                e.target.style.color = '#00ff41';
                              }}
                              onMouseLeave={e => {
                                e.target.style.backgroundColor = 'transparent';
                                e.target.style.color = '#aaa';
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setConfirmingDeleteId(habit.id);
                                setOpenMenuId(null);
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px 14px',
                                background: 'transparent',
                                border: 'none',
                                color: '#aaa',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                fontSize: '12px',
                                textAlign: 'left',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => {
                                e.target.style.backgroundColor = 'rgba(255,68,68,0.15)';
                                e.target.style.color = '#ff4444';
                              }}
                              onMouseLeave={e => {
                                e.target.style.backgroundColor = 'transparent';
                                e.target.style.color = '#aaa';
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Desktop delete confirmation overlay */}
                    {confirmingDeleteId === habit.id && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(10,10,10,0.95)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        zIndex: 50
                      }}
                      onClick={e => e.stopPropagation()}
                      >
                        <span style={{ color: '#fff', fontSize: '12px', marginRight: '8px' }}>
                          Delete "{habit.name}"?
                        </span>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #444',
                            color: '#fff',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '11px',
                            borderRadius: '3px'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            deleteHabit(habit.id);
                            setConfirmingDeleteId(null);
                          }}
                          style={{
                            background: 'rgba(255,68,68,0.1)',
                            border: '1px solid #ff4444',
                            color: '#ff4444',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '11px',
                            borderRadius: '3px'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
                )}
              </SortableItem>
            ))}
                </SortableContext>
              </DndContext>

              {/* Completed Habits Accordion */}
              {completedHabits.length > 0 && (
                <>
                  {/* Accordion Header */}
                  <div
                    onClick={() => {
                      hapticLight();
                      setCompletedExpanded(!completedExpanded);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: isMobile ? '12px 12px' : '10px 12px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isMobile) e.currentTarget.style.backgroundColor = 'rgba(0,255,65,0.03)'; }}
                    onMouseLeave={(e) => { if (!isMobile) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {/* Chevron */}
                    <span style={{
                      color: completedExpanded ? '#00ff41' : '#666',
                      fontSize: isMobile ? '10px' : '9px',
                      transition: 'transform 0.2s ease, color 0.2s ease',
                      transform: completedExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      display: 'inline-block',
                    }}>
                      ▼
                    </span>

                    {/* Label */}
                    <span style={{
                      color: completedExpanded ? '#00ff41' : '#888',
                      fontSize: isMobile ? '12px' : '11px',
                      letterSpacing: '0.5px',
                      transition: 'color 0.2s ease',
                    }}>
                      {completedHabits.length} Complete
                    </span>
                  </div>

                  {/* Collapsible Content */}
                  <div style={{
                    overflow: 'hidden',
                    maxHeight: completedExpanded ? `${completedHabits.length * 60}px` : '0',
                    transition: 'max-height 0.3s ease-out, opacity 0.2s ease',
                    opacity: completedExpanded ? 1 : 0,
                  }}>
                    {completedHabits.map((habit, index) => (
                      <div
                        key={habit.id}
                        data-habit-id={habit.id}
                        style={{
                          position: 'relative',
                          overflow: isMobile ? 'hidden' : 'visible',
                          borderBottom: index < completedHabits.length - 1 ? '1px solid #222' : 'none'
                        }}
                      >
                        {isMobile ? (
                          /* Mobile: Completed habit row - no swipe actions */
                          <div
                            onClick={() => completedExpanded && handleTap(habit.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '14px 12px',
                              gap: '8px',
                              backgroundColor: 'rgba(0,255,65,0.03)',
                              cursor: completedExpanded ? 'pointer' : 'default',
                              userSelect: 'none',
                              WebkitTapHighlightColor: 'transparent',
                            }}
                          >
                            {/* Icon */}
                            <span style={{
                              fontSize: '18px',
                              width: '24px',
                              textAlign: 'center',
                              color: '#00ff41',
                              textShadow: '0 0 8px #00ff41',
                            }}>
                              {habit.icon}
                            </span>

                            {/* Name + Time badge */}
                            <div style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              minWidth: 0,
                            }}>
                              <span style={{
                                color: '#00ff41',
                                fontSize: '14px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {habit.name}
                              </span>
                              {formatScheduledTime(habit.scheduled_time) && (
                                <span style={{
                                  fontSize: '10px',
                                  color: '#fff',
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  padding: '2px 5px',
                                  borderRadius: '3px',
                                  flexShrink: 0,
                                }}>
                                  {formatScheduledTime(habit.scheduled_time)}
                                </span>
                              )}
                            </div>

                            {/* Progress dots */}
                            <div style={{
                              display: 'flex',
                              gap: '3px',
                              width: '32px',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              {Array.from({ length: habit.daily_goal || 1 }).map((_, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: '10px',
                                    color: '#00ff41',
                                    textShadow: '0 0 4px #00ff41'
                                  }}
                                >
                                  ●
                                </span>
                              ))}
                            </div>

                            {/* Streak */}
                            <span style={{
                              width: '50px',
                              textAlign: 'right',
                              color: habit.streak > 7 ? '#00ff41' : habit.streak > 3 ? '#ffaa00' : '#888',
                              fontSize: '12px',
                              flexShrink: 0,
                            }}>
                              {habit.streak > 0 ? `${habit.streak}d 🔥` : ''}
                            </span>
                          </div>
                        ) : (
                          /* Desktop: Completed habit row */
                          <div
                            onClick={() => completedExpanded && incrementHabit(habit.id)}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '30px 1fr 50px 60px 28px',
                              gap: '8px',
                              alignItems: 'center',
                              padding: '12px',
                              backgroundColor: 'rgba(0,255,65,0.03)',
                              transition: 'background 0.15s',
                              cursor: completedExpanded ? 'pointer' : 'default'
                            }}
                          >
                            {/* Icon */}
                            <span style={{
                              fontSize: '16px',
                              color: '#00ff41',
                              textShadow: '0 0 8px #00ff41',
                            }}>
                              {habit.icon}
                            </span>

                            {/* Name + Time badge */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}>
                              <span style={{
                                color: '#00ff41',
                                fontSize: '13px'
                              }}>
                                {habit.name}
                              </span>
                              {formatScheduledTime(habit.scheduled_time) && (
                                <span style={{
                                  fontSize: '10px',
                                  color: '#fff',
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  padding: '2px 5px',
                                  borderRadius: '3px'
                                }}>
                                  {formatScheduledTime(habit.scheduled_time)}
                                </span>
                              )}
                            </div>

                            {/* Progress dots */}
                            <div style={{
                              display: 'flex',
                              gap: '3px',
                              justifyContent: 'center',
                            }}>
                              {Array.from({ length: habit.daily_goal || 1 }).map((_, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: '10px',
                                    color: '#00ff41',
                                    textShadow: '0 0 4px #00ff41'
                                  }}
                                >
                                  ●
                                </span>
                              ))}
                            </div>

                            {/* Streak */}
                            <span style={{
                              color: habit.streak > 7 ? '#00ff41' : habit.streak > 3 ? '#ffaa00' : '#888',
                              fontSize: '12px',
                              textAlign: 'right',
                            }}>
                              {habit.streak > 0 ? `${habit.streak}d 🔥` : ''}
                            </span>

                            {/* Empty space for menu column alignment */}
                            <span></span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        )}

        {/* Add Habit Button - Desktop only, Today view only */}
        {selectedView === 'today' && !isMobile && (
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            width: '100%',
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'transparent',
            border: '1px dashed #333',
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '12px',
            letterSpacing: '1px',
            transition: 'all 0.15s'
          }}
          onMouseEnter={e => {
            e.target.style.borderColor = '#00ff41';
            e.target.style.color = '#00ff41';
          }}
          onMouseLeave={e => {
            e.target.style.borderColor = '#333';
            e.target.style.color = '#888';
          }}
        >
          + ADD NEW HABIT
        </button>
        )}

        {/* Activity View */}
        {selectedView === 'activity' && (
          <ActivityView
            userId={user?.id}
            habits={habits}
            isMobile={isMobile}
          />
        )}

      </div>
      </div>

      {/* Floating Island - Mobile only */}
        {isMobile && (
          <div className="floating-island">
            {/* Navigation Arrows - Far Left */}
            <div style={{ display: 'flex', gap: '2px' }}>
              <button
                onClick={() => navigateDate(-1)}
                disabled={!canGoBack}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: canGoBack ? '#888' : '#333',
                  fontSize: '16px',
                  padding: '4px 10px',
                  cursor: canGoBack ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
                title="Previous day"
              >
                ←
              </button>
              <button
                onClick={() => navigateDate(1)}
                disabled={isToday}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isToday ? '#333' : '#888',
                  fontSize: '16px',
                  padding: '4px 10px',
                  cursor: isToday ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
                title="Next day"
              >
                →
              </button>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '20px', backgroundColor: '#333' }} />

            {/* Today/Activity Tabs - Center */}
            <div style={{ display: 'flex', gap: '4px', flex: 1, justifyContent: 'center' }}>
              {['today', 'activity'].map(view => (
                <button
                  key={view}
                  onClick={() => {
                    setSelectedView(view);
                    if (view === 'today') setSelectedDate(today);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: selectedView === view ? '#00ff41' : '#666',
                    fontSize: '10px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    textShadow: selectedView === view ? '0 0 8px #00ff41' : 'none',
                  }}
                >
                  {view === 'today' ? formatDateLabel(selectedDate) : view}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '20px', backgroundColor: '#333' }} />

            {/* Add Button - Right */}
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#00ff41',
                fontSize: '20px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                lineHeight: 1,
              }}
              title="Add new habit"
            >
              +
            </button>
          </div>
        )}

        {/* Password Reset Modal */}
        <BottomSheet
          isOpen={showPasswordReset}
          onClose={() => {
            setShowPasswordReset(false);
            setNewPassword('');
            setAuthMessage('');
          }}
          title="SET NEW PASSWORD"
          isMobile={isMobile}
        >
          <div style={{
            color: '#fff',
            fontSize: '11px',
            marginBottom: '20px',
            lineHeight: '1.6'
          }}>
            enter your new password (min 6 characters)
          </div>

          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="new password"
            autoFocus={!isMobile}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#0a0a0a',
              border: '1px solid #333',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: '14px',
              marginBottom: '16px',
              outline: 'none'
            }}
            onKeyDown={(e) => e.key === 'Enter' && updatePassword()}
            onFocus={(e) => e.target.style.borderColor = '#00ff41'}
            onBlur={(e) => e.target.style.borderColor = '#333'}
          />

          {authMessage && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: authMessage.includes('Error') ? 'rgba(255,0,0,0.1)' : 'rgba(0,255,65,0.1)',
              border: `1px solid ${authMessage.includes('Error') ? '#ff4444' : '#00ff41'}`,
              color: authMessage.includes('Error') ? '#ff4444' : '#00ff41',
              fontSize: '11px',
              textAlign: 'center'
            }}>
              {authMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={updatePassword}
              disabled={authLoading}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#00ff41',
                border: 'none',
                color: '#000',
                cursor: authLoading ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                fontSize: '11px',
                fontWeight: 'bold',
                letterSpacing: '1px',
                opacity: authLoading ? 0.7 : 1
              }}
            >
              {authLoading ? '[SAVING...]' : '[SET PASSWORD]'}
            </button>
            <button
              onClick={() => {
                setShowPasswordReset(false);
                setNewPassword('');
                setAuthMessage('');
              }}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: 'transparent',
                border: '1px solid #444',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '11px',
                letterSpacing: '1px'
              }}
            >
              [SKIP]
            </button>
          </div>
        </BottomSheet>

        {/* Settings Modal */}
        <BottomSheet
          isOpen={showSettings}
          onClose={() => {
            setShowSettings(false);
            setSettingsPassword('');
            setSettingsNewPassword('');
            setSettingsMessage('');
          }}
          title="USER SETTINGS"
          isMobile={isMobile}
        >
          {/* User Info */}
          <div style={{
            border: '1px solid #333',
            padding: '16px',
            marginBottom: '20px',
            backgroundColor: '#0a0a0a'
          }}>
            <div style={{ color: '#fff', fontSize: '10px', marginBottom: '8px' }}>EMAIL</div>
            <div style={{ color: '#fff', fontSize: '13px' }}>{user?.email || 'N/A'}</div>
          </div>

          {/* Change Password Section */}
          <div style={{
            border: '1px solid #333',
            padding: '16px',
            marginBottom: '16px',
            backgroundColor: '#0a0a0a'
          }}>
            <div style={{
              color: '#00ff41',
              marginBottom: '16px',
              fontSize: '11px',
              letterSpacing: '1px'
            }}>
              CHANGE PASSWORD
            </div>

            <input
              type="password"
              value={settingsPassword}
              onChange={(e) => setSettingsPassword(e.target.value)}
              placeholder="current password"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#0d0d0d',
                border: '1px solid #333',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '14px',
                marginBottom: '12px',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#00ff41'}
              onBlur={(e) => e.target.style.borderColor = '#333'}
            />

            <input
              type="password"
              value={settingsNewPassword}
              onChange={(e) => setSettingsNewPassword(e.target.value)}
              placeholder="new password (min 6 characters)"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#0d0d0d',
                border: '1px solid #333',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '14px',
                marginBottom: '12px',
                outline: 'none'
              }}
              onKeyDown={(e) => e.key === 'Enter' && changePassword()}
              onFocus={(e) => e.target.style.borderColor = '#00ff41'}
              onBlur={(e) => e.target.style.borderColor = '#333'}
            />

            {settingsMessage && (
              <div style={{
                marginBottom: '12px',
                padding: '12px',
                backgroundColor: settingsMessage.includes('Error') ? 'rgba(255,0,0,0.1)' : 'rgba(0,255,65,0.1)',
                border: `1px solid ${settingsMessage.includes('Error') ? '#ff4444' : '#00ff41'}`,
                color: settingsMessage.includes('Error') ? '#ff4444' : '#00ff41',
                fontSize: '11px',
                textAlign: 'center'
              }}>
                {settingsMessage}
              </div>
            )}

            <button
              onClick={changePassword}
              disabled={settingsLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: settingsLoading ? '#1a1a1a' : '#00ff41',
                border: 'none',
                color: settingsLoading ? '#666' : '#000',
                cursor: settingsLoading ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                fontSize: '11px',
                fontWeight: 'bold',
                letterSpacing: '1px',
                opacity: settingsLoading ? 0.7 : 1
              }}
            >
              {settingsLoading ? '[UPDATING...]' : '[CHANGE PASSWORD]'}
            </button>
          </div>

          {/* Logout Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowSettings(false);
              signOut();
            }}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'transparent',
              border: '1px solid #ff4444',
              color: '#ff4444',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '11px',
              letterSpacing: '1px',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(255,68,68,0.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
          >
            [LOGOUT]
          </button>
        </BottomSheet>

        {/* Add Modal */}
        <BottomSheet
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setNewHabitName('');
            setNewHabitGoal(1);
            setNewHabitTime('');
            setNewHabitDays([0,1,2,3,4,5,6]);
          }}
          title="NEW HABIT"
          isMobile={isMobile}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              placeholder="enter habit name..."
              autoFocus={!isMobile}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '14px',
                outline: 'none'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (isMobile) {
                    e.target.blur(); // Close keyboard on mobile
                  } else {
                    addHabit();
                  }
                }
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#fff', fontSize: '11px' }}>×</span>
              <input
                type="number"
                min="1"
                max="10"
                value={newHabitGoal}
                onChange={(e) => setNewHabitGoal(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                style={{
                  width: '40px',
                  padding: '12px 8px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Time field with toggle */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#fff', fontSize: '10px', marginBottom: '6px', letterSpacing: '1px' }}>
              TIME
            </div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
              <input
                type="time"
                value={newHabitTime}
                onChange={(e) => setNewHabitTime(e.target.value)}
                disabled={!newHabitTime}
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  color: newHabitTime ? '#fff' : '#444',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  outline: 'none',
                  colorScheme: 'dark',
                  opacity: newHabitTime ? 1 : 0.5
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <button
                  onClick={() => setNewHabitTime(newHabitTime || '09:00')}
                  style={{
                    background: newHabitTime ? 'rgba(0,255,65,0.2)' : 'transparent',
                    border: `1px solid ${newHabitTime ? '#00ff41' : '#444'}`,
                    color: newHabitTime ? '#00ff41' : '#666',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '9px',
                    borderRadius: '2px',
                    transition: 'all 0.15s'
                  }}
                >
                  ON
                </button>
                <button
                  onClick={() => setNewHabitTime('')}
                  style={{
                    background: !newHabitTime ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: `1px solid ${!newHabitTime ? '#666' : '#444'}`,
                    color: !newHabitTime ? '#888' : '#666',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '9px',
                    borderRadius: '2px',
                    transition: 'all 0.15s'
                  }}
                >
                  OFF
                </button>
              </div>
            </div>
          </div>

          {/* Days selector */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#fff', fontSize: '10px', marginBottom: '6px', letterSpacing: '1px' }}>
              DAYS
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const newDays = newHabitDays.includes(i)
                      ? newHabitDays.filter(d => d !== i)
                      : [...newHabitDays, i].sort();
                    // Don't allow empty selection
                    if (newDays.length > 0) setNewHabitDays(newDays);
                  }}
                  style={{
                    flex: 1,
                    height: '36px',
                    backgroundColor: newHabitDays.includes(i) ? 'rgba(0,255,65,0.15)' : 'transparent',
                    border: `1px solid ${newHabitDays.includes(i) ? '#00ff41' : '#333'}`,
                    color: newHabitDays.includes(i) ? '#00ff41' : '#666',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '11px',
                    transition: 'all 0.15s'
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={addHabit}
              disabled={syncing}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#00ff41',
                border: 'none',
                color: '#000',
                cursor: syncing ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                fontSize: '11px',
                fontWeight: 'bold',
                letterSpacing: '1px',
                opacity: syncing ? 0.7 : 1
              }}
            >
              {syncing ? '[SAVING...]' : '[CONFIRM]'}
            </button>
            <button
              onClick={() => {
                setShowAddModal(false);
                setNewHabitName('');
                setNewHabitGoal(1);
                setNewHabitTime('');
                setNewHabitDays([0,1,2,3,4,5,6]);
              }}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: 'transparent',
                border: '1px solid #444',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '11px',
                letterSpacing: '1px'
              }}
            >
              [CANCEL]
            </button>
          </div>
        </BottomSheet>

        {/* Edit Modal */}
        <BottomSheet
          isOpen={!!editingHabit}
          onClose={() => {
            setEditingHabit(null);
            setEditHabitName('');
            setEditHabitGoal(1);
            setEditHabitTime('');
            setEditHabitDays([0,1,2,3,4,5,6]);
          }}
          title="EDIT HABIT"
          isMobile={isMobile}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              value={editHabitName}
              onChange={(e) => setEditHabitName(e.target.value)}
              placeholder="enter habit name..."
              autoFocus={!isMobile}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '14px',
                outline: 'none'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (isMobile) {
                    e.target.blur(); // Close keyboard on mobile
                  } else {
                    updateHabit();
                  }
                }
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#fff', fontSize: '11px' }}>×</span>
              <input
                type="number"
                min="1"
                max="10"
                value={editHabitGoal}
                onChange={(e) => setEditHabitGoal(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                style={{
                  width: '40px',
                  padding: '12px 8px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Time field with toggle */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#fff', fontSize: '10px', marginBottom: '6px', letterSpacing: '1px' }}>
              TIME
            </div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
              <input
                type="time"
                value={editHabitTime}
                onChange={(e) => setEditHabitTime(e.target.value)}
                disabled={!editHabitTime}
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  color: editHabitTime ? '#fff' : '#444',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  outline: 'none',
                  colorScheme: 'dark',
                  opacity: editHabitTime ? 1 : 0.5
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <button
                  onClick={() => setEditHabitTime(editHabitTime || '09:00')}
                  style={{
                    background: editHabitTime ? 'rgba(0,255,65,0.2)' : 'transparent',
                    border: `1px solid ${editHabitTime ? '#00ff41' : '#444'}`,
                    color: editHabitTime ? '#00ff41' : '#666',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '9px',
                    borderRadius: '2px',
                    transition: 'all 0.15s'
                  }}
                >
                  ON
                </button>
                <button
                  onClick={() => setEditHabitTime('')}
                  style={{
                    background: !editHabitTime ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: `1px solid ${!editHabitTime ? '#666' : '#444'}`,
                    color: !editHabitTime ? '#888' : '#666',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '9px',
                    borderRadius: '2px',
                    transition: 'all 0.15s'
                  }}
                >
                  OFF
                </button>
              </div>
            </div>
          </div>

          {/* Days selector */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#fff', fontSize: '10px', marginBottom: '6px', letterSpacing: '1px' }}>
              DAYS
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const newDays = editHabitDays.includes(i)
                      ? editHabitDays.filter(d => d !== i)
                      : [...editHabitDays, i].sort();
                    // Don't allow empty selection
                    if (newDays.length > 0) setEditHabitDays(newDays);
                  }}
                  style={{
                    flex: 1,
                    height: '36px',
                    backgroundColor: editHabitDays.includes(i) ? 'rgba(0,255,65,0.15)' : 'transparent',
                    border: `1px solid ${editHabitDays.includes(i) ? '#00ff41' : '#333'}`,
                    color: editHabitDays.includes(i) ? '#00ff41' : '#666',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '11px',
                    transition: 'all 0.15s'
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={updateHabit}
              disabled={syncing}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#00ff41',
                border: 'none',
                color: '#000',
                cursor: syncing ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                fontSize: '11px',
                fontWeight: 'bold',
                letterSpacing: '1px',
                opacity: syncing ? 0.7 : 1
              }}
            >
              {syncing ? '[SAVING...]' : '[SAVE]'}
            </button>
            <button
              onClick={() => {
                setEditingHabit(null);
                setEditHabitName('');
                setEditHabitGoal(1);
                setEditHabitTime('');
                setEditHabitDays([0,1,2,3,4,5,6]);
              }}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: 'transparent',
                border: '1px solid #444',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '11px',
                letterSpacing: '1px'
              }}
            >
              [CANCEL]
            </button>
          </div>
        </BottomSheet>

        {/* Mobile Menu BottomSheet */}
        <BottomSheet
          isOpen={showMobileMenu}
          onClose={() => setShowMobileMenu(false)}
          title="MENU"
          isMobile={isMobile}
          showCursor={false}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => {
                setShowMobileMenu(false);
                setShowSettings(true);
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid #333',
                color: '#fff',
                padding: '16px 20px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '13px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = '#00ff41';
                e.target.style.color = '#00ff41';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = '#333';
                e.target.style.color = '#888';
              }}
            >
              <span style={{ opacity: 0.6 }}>⚙</span> Settings
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowMobileMenu(false);
                signOut();
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid #ff4444',
                color: '#ff4444',
                padding: '16px 20px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '13px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255,68,68,0.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              <span>⏻</span> Logout
            </button>
          </div>
        </BottomSheet>

        {/* Hagotchi Skin Collection Modal */}
        <SkinCollection
          isOpen={showSkinCollection}
          onClose={() => setShowSkinCollection(false)}
          unlockedSkinIds={spirit?.unlocked_skin_ids || ['pixel_spirit']}
          activeSkinId={spirit?.active_skin_id || 'pixel_spirit'}
          onSelectSkin={switchSkin}
          isMobile={isMobile}
        />

        {/* Hagotchi Lore Archive Modal */}
        <LoreArchive
          isOpen={showLoreArchive}
          onClose={() => setShowLoreArchive(false)}
          unlockedSkinIds={spirit?.unlocked_skin_ids || ['pixel_spirit']}
          isMobile={isMobile}
        />

        {/* Hagotchi Unlock Animation */}
        <UnlockAnimation
          skinId={pendingUnlock}
          isOpen={showUnlockAnimation}
          onClose={closeUnlockAnimation}
          isMobile={isMobile}
        />

        {/* Footer - Desktop only (mobile has floating island) */}
        {!isMobile && (
        <div style={{
          marginTop: '32px',
          paddingTop: '16px',
          borderTop: '1px solid #222',
          fontSize: '10px',
          color: '#333',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>HAGOTCHI v2.5.0</span>
          <span>consistency compounds</span>
        </div>
        )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        * {
          box-sizing: border-box;
        }
        
        ::selection {
          background: #00ff41;
          color: #000;
        }
        
        input::placeholder {
          color: #444;
        }
        
        input:focus {
          border-color: #00ff41 !important;
        }
        
        button:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
};

export default HabitTracker;

