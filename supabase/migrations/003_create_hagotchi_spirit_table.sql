-- Migration: Create hagotchi_spirit table for companion system
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. CREATE HAGOTCHI_SPIRIT TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS hagotchi_spirit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Active skin/appearance
  active_skin_id TEXT NOT NULL DEFAULT 'egbert',

  -- Vitality system (0-100)
  vitality INTEGER NOT NULL DEFAULT 100 CHECK (vitality >= 0 AND vitality <= 100),
  last_fed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unlocked skins (array of skin IDs)
  unlocked_skin_ids TEXT[] NOT NULL DEFAULT ARRAY['egbert'],

  -- Statistics for milestone tracking
  total_habits_completed INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. CREATE INDEXES
-- ============================================

-- Index for fetching user's spirit
CREATE INDEX IF NOT EXISTS idx_hagotchi_spirit_user
  ON hagotchi_spirit(user_id);

-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE hagotchi_spirit ENABLE ROW LEVEL SECURITY;

-- Users can only view their own spirit
CREATE POLICY "Users can view own spirit"
  ON hagotchi_spirit FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own spirit
CREATE POLICY "Users can insert own spirit"
  ON hagotchi_spirit FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own spirit
CREATE POLICY "Users can update own spirit"
  ON hagotchi_spirit FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own spirit
CREATE POLICY "Users can delete own spirit"
  ON hagotchi_spirit FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. CREATE TRIGGER FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_hagotchi_spirit_updated_at
    BEFORE UPDATE ON hagotchi_spirit
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. ENABLE REALTIME (optional)
-- ============================================

-- Enable real-time sync for hagotchi_spirit
ALTER publication supabase_realtime ADD TABLE hagotchi_spirit;

-- ============================================
-- 6. INITIALIZE EXISTING USERS
-- ============================================

-- Create a hagotchi_spirit record for all existing users who have habits
-- Calculate their stats from existing data

INSERT INTO hagotchi_spirit (user_id, total_habits_completed, current_streak, longest_streak)
SELECT
  h.user_id,
  COALESCE(SUM(CASE WHEN c.completion_count >= c.daily_goal THEN 1 ELSE 0 END), 0) as total_habits_completed,
  COALESCE(MAX(h.streak), 0) as current_streak,
  COALESCE(MAX(h.streak), 0) as longest_streak
FROM habits h
LEFT JOIN completions c ON c.user_id = h.user_id
WHERE NOT EXISTS (SELECT 1 FROM hagotchi_spirit s WHERE s.user_id = h.user_id)
GROUP BY h.user_id
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================

-- Check table was created
-- SELECT * FROM hagotchi_spirit LIMIT 10;

-- Verify all users with habits have a spirit
-- SELECT u.id, s.id as spirit_id FROM auth.users u
-- LEFT JOIN hagotchi_spirit s ON s.user_id = u.id
-- WHERE EXISTS (SELECT 1 FROM habits h WHERE h.user_id = u.id);
