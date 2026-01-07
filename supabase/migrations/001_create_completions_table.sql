-- Migration: Create completions table for GitHub-style activity tracking
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. CREATE COMPLETIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  completion_count INTEGER NOT NULL DEFAULT 1,
  daily_goal INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each habit can only have one record per date
  UNIQUE(habit_id, completed_date)
);

-- ============================================
-- 2. CREATE INDEXES FOR QUERY OPTIMIZATION
-- ============================================

-- Index for fetching user's activity by date range
CREATE INDEX IF NOT EXISTS idx_completions_user_date
  ON completions(user_id, completed_date DESC);

-- Index for fetching specific habit's history
CREATE INDEX IF NOT EXISTS idx_completions_habit_date
  ON completions(habit_id, completed_date DESC);

-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own completions
CREATE POLICY "Users can view own completions"
  ON completions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own completions
CREATE POLICY "Users can insert own completions"
  ON completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own completions
CREATE POLICY "Users can update own completions"
  ON completions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own completions
CREATE POLICY "Users can delete own completions"
  ON completions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. ENABLE REALTIME (optional)
-- ============================================

-- Uncomment if you want real-time sync for completions
-- ALTER publication supabase_realtime ADD TABLE completions;

-- ============================================
-- 5. BACKFILL EXISTING HISTORY DATA
-- ============================================

-- This migrates the existing 7-day history arrays from habits table
-- The history array format is [day-6, day-5, day-4, day-3, day-2, day-1, today]
-- We only insert records where the habit was completed (value = 1)

INSERT INTO completions (user_id, habit_id, completed_date, completion_count, daily_goal)
SELECT
  h.user_id,
  h.id as habit_id,
  (CURRENT_DATE - (7 - idx)::int) as completed_date,
  COALESCE(h.daily_goal, 1) as completion_count,  -- Assume full completion for historical data
  COALESCE(h.daily_goal, 1) as daily_goal
FROM habits h
CROSS JOIN generate_series(1, 7) as idx
WHERE h.history IS NOT NULL
  AND array_length(h.history, 1) >= idx
  AND h.history[idx] = 1
ON CONFLICT (habit_id, completed_date) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================

-- Check table was created
-- SELECT * FROM completions LIMIT 10;

-- Count backfilled records
-- SELECT COUNT(*) as total_completions FROM completions;

-- Verify per-user counts
-- SELECT user_id, COUNT(*) as completions FROM completions GROUP BY user_id;
