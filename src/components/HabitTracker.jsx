import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const HABITS_CACHE_KEY = 'habito_habits_cache';

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
  const [cursorBlink, setCursorBlink] = useState(true);
  const [bootSequence, setBootSequence] = useState(true);
  const [bootLine, setBootLine] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const bootMessages = [
    '> Habito v2.5.0 initializing...',
    '> loading neural pathways.......... OK',
    '> scanning habit matrix............ OK', 
    '> streak engine online............. OK',
    '> cloud sync enabled............... OK',
    '> welcome back, operator.',
    ''
  ];

  const icons = ['◎', '▣', '△', '▢', '○', '◇', '▽', '□', '●', '◆'];

  // Check for day change and update habits accordingly
  const checkDayChange = useCallback((habitsData) => {
    const lastVisit = localStorage.getItem('lastVisit');
    const today = new Date().toDateString();
    
    if (lastVisit && lastVisit !== today) {
      localStorage.setItem('lastVisit', today);
      // It's a new day - shift history and reset completedToday
      return habitsData.map(h => ({
        ...h,
        completed_today: false,
        history: [...(h.history || [0,0,0,0,0,0,0]).slice(1), h.completed_today ? 1 : 0],
        streak: h.completed_today ? h.streak : 0 // Reset streak if didn't complete yesterday
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

    // If habits were updated due to day change, sync back to Supabase
    if (JSON.stringify(updatedHabits) !== JSON.stringify(data)) {
      for (const habit of updatedHabits) {
        await supabase
          .from('habits')
          .update({
            completed_today: habit.completed_today,
            history: habit.history,
            streak: habit.streak
          })
          .eq('id', habit.id);
      }
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
        // If we have cached habits, show them and stop loading immediately
        const cached = localStorage.getItem(HABITS_CACHE_KEY);
        if (cached) {
          try {
            setHabits(JSON.parse(cached));
            setLoading(false);
          } catch {}
        }

        // Fetch fresh data in background (with 30s timeout)
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Fetch timeout - check your connection')), 30000)
          );
          const data = await Promise.race([
            fetchHabits(session.user.id),
            timeoutPromise
          ]);
          setHabits(data);
          // Cache the fresh data
          localStorage.setItem(HABITS_CACHE_KEY, JSON.stringify(data));
          setFetchError(null);
        } catch (err) {
          console.error('Error fetching habits:', err);
          // Only show error if we don't have cached data
          if (!cached) {
            setFetchError(err.message || 'Failed to load habits');
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

  // Real-time subscription for live sync across browser instances
  useEffect(() => {
    if (!user) return;

    let channel;

    try {
      channel = supabase
        .channel('habits-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'habits',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setHabits(prev => {
                // Avoid duplicates
                if (prev.some(h => h.id === payload.new.id)) return prev;
                return [...prev, payload.new];
              });
            } else if (payload.eventType === 'UPDATE') {
              setHabits(prev => prev.map(h => h.id === payload.new.id ? payload.new : h));
            } else if (payload.eventType === 'DELETE') {
              setHabits(prev => prev.filter(h => h.id !== payload.old.id));
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('realtime: connected');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('realtime: connection failed (app will still work, refresh to sync)');
          }
        });
    } catch (error) {
      console.warn('realtime: could not connect -', error.message);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }, [user]);

  // Cache habits whenever they change (for faster loads)
  useEffect(() => {
    if (habits.length > 0 && user) {
      localStorage.setItem(HABITS_CACHE_KEY, JSON.stringify(habits));
    }
  }, [habits, user]);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setCursorBlink(prev => !prev);
    }, 530);
    return () => clearInterval(blinkInterval);
  }, []);

  useEffect(() => {
    if (bootSequence && bootLine < bootMessages.length) {
      const timer = setTimeout(() => {
        setBootLine(prev => prev + 1);
      }, bootLine === 0 ? 400 : 300);
      return () => clearTimeout(timer);
    } else if (bootLine >= bootMessages.length) {
      setTimeout(() => setBootSequence(false), 600);
    }
  }, [bootLine, bootSequence]);

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

  const toggleHabit = async (id) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const newCompleted = !habit.completed_today;
    const newStreak = newCompleted ? habit.streak + 1 : Math.max(0, habit.streak - 1);

    // Optimistic update
    setHabits(habits.map(h => 
      h.id === id ? { ...h, completed_today: newCompleted, streak: newStreak } : h
    ));

    setSyncing(true);
    const { error } = await supabase
      .from('habits')
      .update({ completed_today: newCompleted, streak: newStreak })
      .eq('id', id);

    if (error) {
      console.error('Error updating habit:', error);
      // Revert on error
      setHabits(habits);
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
    } else {
      setHabits([...habits, data]);
    }
    
    setNewHabitName('');
    setShowAddModal(false);
    setSyncing(false);
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

  const completedCount = habits.filter(h => h.completed_today).length;
  const completionPercent = habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;

  const generateProgressBar = (percent, width = 20) => {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
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
        justifyContent: 'center'
      }}>
        <div style={{ maxWidth: '600px', width: '100%' }}>
          {bootMessages.slice(0, bootLine).map((msg, i) => (
            <div key={i} style={{
              marginBottom: '8px',
              opacity: i < bootLine - 1 ? 0.6 : 1,
              fontSize: '14px',
              letterSpacing: '0.5px'
            }}>
              {msg}
            </div>
          ))}
          {bootLine < bootMessages.length && (
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
 ██╗  ██╗ █████╗ ██████╗ ██╗████████╗ ██████╗
 ██║  ██║██╔══██╗██╔══██╗██║╚══██╔══╝██╔═══██╗
 ███████║███████║██████╔╝██║   ██║   ██║   ██║
 ██╔══██║██╔══██║██╔══██╗██║   ██║   ██║   ██║
 ██║  ██║██║  ██║██████╔╝██║   ██║   ╚██████╔╝
 ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝    ╚═════╝`}
            </pre>
            <span style={{ color: '#666', fontSize: '12px', marginLeft: '2px' }}>.space</span>
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
              color: '#666',
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
                  color: '#666',
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
                  e.target.style.color = '#666';
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
            Habito v2.5.0 • consistency compounds
          </div>
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      fontFamily: '"IBM Plex Mono", "Fira Code", "SF Mono", monospace',
      color: '#c0c0c0',
      padding: '20px',
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

      <div style={{ maxWidth: '700px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'flex-end', marginBottom: '20px' }}>
            <pre style={{
              color: '#00ff41',
              fontSize: '10px',
              lineHeight: '1.2',
              margin: 0,
              textShadow: '0 0 10px #00ff41'
            }}>
{`
 ██╗  ██╗ █████╗ ██████╗ ██╗████████╗ ██████╗
 ██║  ██║██╔══██╗██╔══██╗██║╚══██╔══╝██╔═══██╗
 ███████║███████║██████╔╝██║   ██║   ██║   ██║
 ██╔══██║██╔══██║██╔══██╗██║   ██║   ██║   ██║
 ██║  ██║██║  ██║██████╔╝██║   ██║   ╚██████╔╝
 ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝    ╚═════╝`}
            </pre>
            <span style={{ color: '#666', fontSize: '12px', marginLeft: '2px' }}>.space</span>
          </div>

          <div style={{ 
            borderTop: '1px solid #333',
            borderBottom: '1px solid #333',
            padding: '12px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px'
          }}>
            <span style={{ color: '#666' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {syncing && (
                <span style={{ color: '#ffaa00', fontSize: '10px' }}>
                  SYNCING...
                </span>
              )}
              <span style={{ color: '#00ff41' }}>
                {cursorBlink ? '●' : '○'} ONLINE
              </span>
              <button
                onClick={() => setShowSettings(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid #333',
                  color: '#666',
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
                  e.target.style.color = '#666';
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
                  color: '#666',
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
                  e.target.style.color = '#666';
                }}
              >
                [LOGOUT]
              </button>
            </div>
          </div>
        </div>

        {/* Stats Panel */}
        <div style={{
          border: '1px solid #333',
          marginBottom: '24px',
          backgroundColor: '#0d0d0d'
        }}>
          <div style={{
            borderBottom: '1px solid #333',
            padding: '8px 12px',
            fontSize: '11px',
            color: '#666',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>┌─ DAILY PROGRESS ─┐</span>
            <span>{completedCount}/{habits.length} COMPLETE</span>
          </div>
          
          <div style={{ padding: '16px 12px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              marginBottom: '12px'
            }}>
              <span style={{ 
                fontSize: '28px', 
                fontWeight: 'bold',
                color: completionPercent === 100 ? '#00ff41' : '#fff',
                textShadow: completionPercent === 100 ? '0 0 15px #00ff41' : 'none',
                minWidth: '70px'
              }}>
                {completionPercent}%
              </span>
              <span style={{ 
                fontFamily: 'monospace',
                fontSize: '14px',
                color: completionPercent === 100 ? '#00ff41' : '#888',
                letterSpacing: '1px'
              }}>
                {generateProgressBar(completionPercent, 24)}
              </span>
            </div>
            
            {completionPercent === 100 && (
              <div style={{
                color: '#00ff41',
                fontSize: '11px',
                animation: 'pulse 2s infinite',
                letterSpacing: '2px'
              }}>
                ★ ALL HABITS COMPLETE ★
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '16px',
          fontSize: '11px'
        }}>
          {['today', 'week', 'stats'].map(view => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
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
              [{view}]
            </button>
          ))}
        </div>

        {/* Habits List */}
        <div style={{
          border: '1px solid #333',
          backgroundColor: '#0d0d0d'
        }}>
          <div style={{
            borderBottom: '1px solid #333',
            padding: '8px 12px',
            fontSize: '11px',
            color: '#666',
            display: 'grid',
            gridTemplateColumns: selectedView === 'week' ? '30px 1fr 140px 60px 30px' : '30px 1fr 80px 60px 30px',
            gap: '8px'
          }}>
            <span></span>
            <span>HABIT</span>
            <span>{selectedView === 'week' ? 'M  T  W  T  F  S  S' : 'STREAK'}</span>
            <span>STATUS</span>
            <span></span>
          </div>

          {loading ? (
            <div style={{ 
              padding: '40px 12px', 
              textAlign: 'center',
              color: '#00ff41',
              fontSize: '12px'
            }}>
              loading habits...
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
          ) : habits.length === 0 ? (
            <div style={{
              padding: '40px 12px',
              textAlign: 'center',
              color: '#444',
              fontSize: '12px'
            }}>
              no habits tracked. add one below.
            </div>
          ) : (
            habits.map((habit, index) => (
              <div
                key={habit.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: selectedView === 'week' ? '30px 1fr 140px 60px 30px' : '30px 1fr 80px 60px 30px',
                  gap: '8px',
                  padding: '12px',
                  borderBottom: index < habits.length - 1 ? '1px solid #222' : 'none',
                  alignItems: 'center',
                  transition: 'background 0.15s',
                  backgroundColor: habit.completed_today ? 'rgba(0,255,65,0.03)' : 'transparent'
                }}
              >
                <span style={{ 
                  fontSize: '16px',
                  color: habit.completed_today ? '#00ff41' : '#444',
                  textShadow: habit.completed_today ? '0 0 8px #00ff41' : 'none'
                }}>
                  {habit.icon}
                </span>
                
                <div>
                  <span style={{ 
                    color: habit.completed_today ? '#00ff41' : '#888',
                    fontSize: '13px'
                  }}>
                    {habit.name}
                  </span>
                </div>

                {selectedView === 'week' ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(habit.history || [0,0,0,0,0,0,0]).map((day, i) => (
                      <span 
                        key={i}
                        style={{
                          color: day ? '#00ff41' : '#333',
                          fontSize: '14px'
                        }}
                      >
                        {day ? '■' : '□'}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ 
                    color: habit.streak > 7 ? '#00ff41' : habit.streak > 3 ? '#ffaa00' : '#666',
                    fontSize: '12px'
                  }}>
                    {habit.streak > 0 ? `${habit.streak}d 🔥` : '---'}
                  </span>
                )}

                <button
                  onClick={() => toggleHabit(habit.id)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${habit.completed_today ? '#00ff41' : '#444'}`,
                    color: habit.completed_today ? '#00ff41' : '#666',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '10px',
                    transition: 'all 0.15s'
                  }}
                >
                  {habit.completed_today ? '[DONE]' : '[    ]'}
                </button>

                <button
                  onClick={() => deleteHabit(habit.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#444',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    padding: '0',
                    opacity: 0.5,
                    transition: 'opacity 0.15s'
                  }}
                  onMouseEnter={e => e.target.style.opacity = 1}
                  onMouseLeave={e => e.target.style.opacity = 0.5}
                  title="Delete habit"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Habit Button */}
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            width: '100%',
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'transparent',
            border: '1px dashed #333',
            color: '#666',
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
            e.target.style.color = '#666';
          }}
        >
          + ADD NEW HABIT
        </button>

        {/* Stats View */}
        {selectedView === 'stats' && (
          <div style={{
            marginTop: '24px',
            border: '1px solid #333',
            backgroundColor: '#0d0d0d'
          }}>
            <div style={{
              borderBottom: '1px solid #333',
              padding: '8px 12px',
              fontSize: '11px',
              color: '#666'
            }}>
              ┌─ ANALYTICS ─┐
            </div>
            <div style={{ padding: '16px 12px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>LONGEST STREAK</div>
                <div style={{ color: '#00ff41', fontSize: '24px' }}>
                  {Math.max(...habits.map(h => h.streak), 0)} days
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>TOTAL HABITS</div>
                <div style={{ color: '#fff', fontSize: '24px' }}>{habits.length}</div>
              </div>
              <div>
                <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>COMPLETION RATE (7D)</div>
                <div style={{ color: '#ffaa00', fontSize: '24px' }}>
                  {habits.length > 0 
                    ? Math.round(habits.reduce((acc, h) => acc + (h.history || []).filter(d => d).length, 0) / (habits.length * 7) * 100)
                    : 0}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Password Reset Modal */}
        {showPasswordReset && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}>
            <div style={{
              backgroundColor: '#0d0d0d',
              border: '1px solid #333',
              padding: '24px',
              width: '90%',
              maxWidth: '400px'
            }}>
              <div style={{ 
                color: '#00ff41', 
                marginBottom: '16px',
                fontSize: '12px',
                letterSpacing: '1px'
              }}>
                &gt; SET NEW PASSWORD{cursorBlink ? '▌' : ' '}
              </div>
              
              <div style={{
                color: '#666',
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
                autoFocus
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
                    color: '#666',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '11px',
                    letterSpacing: '1px'
                  }}
                >
                  [SKIP]
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}>
            <div style={{
              backgroundColor: '#0d0d0d',
              border: '1px solid #333',
              padding: '24px',
              width: '90%',
              maxWidth: '500px'
            }}>
              <div style={{ 
                color: '#00ff41', 
                marginBottom: '20px',
                fontSize: '12px',
                letterSpacing: '1px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>&gt; USER SETTINGS{cursorBlink ? '▌' : ' '}</span>
                <button
                  onClick={() => {
                    setShowSettings(false);
                    setSettingsPassword('');
                    setSettingsNewPassword('');
                    setSettingsMessage('');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '16px',
                    padding: '0 8px'
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#ff4444'}
                  onMouseLeave={(e) => e.target.style.color = '#666'}
                >
                  ×
                </button>
              </div>

              {/* User Info */}
              <div style={{
                border: '1px solid #333',
                padding: '16px',
                marginBottom: '20px',
                backgroundColor: '#0a0a0a'
              }}>
                <div style={{ color: '#666', fontSize: '10px', marginBottom: '8px' }}>EMAIL</div>
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
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}>
            <div style={{
              backgroundColor: '#0d0d0d',
              border: '1px solid #333',
              padding: '24px',
              width: '90%',
              maxWidth: '400px'
            }}>
              <div style={{ 
                color: '#00ff41', 
                marginBottom: '16px',
                fontSize: '12px',
                letterSpacing: '1px'
              }}>
                &gt; NEW HABIT{cursorBlink ? '▌' : ' '}
              </div>
              
              <input
                type="text"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                placeholder="enter habit name..."
                autoFocus
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
                onKeyDown={(e) => e.key === 'Enter' && addHabit()}
              />
              
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
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: 'transparent',
                    border: '1px solid #444',
                    color: '#666',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '11px',
                    letterSpacing: '1px'
                  }}
                >
                  [CANCEL]
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '32px',
          paddingTop: '16px',
          borderTop: '1px solid #222',
          fontSize: '10px',
          color: '#333',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>Habito v2.5.0</span>
          <span>consistency compounds</span>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
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
