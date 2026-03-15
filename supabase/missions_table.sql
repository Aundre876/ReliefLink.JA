-- ReliefLink.JA - Missions table for volunteer route tracking
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)

CREATE TABLE IF NOT EXISTS public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  total_distance FLOAT NOT NULL DEFAULT 0,
  avg_speed FLOAT NOT NULL DEFAULT 0,
  path_data JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own missions
CREATE POLICY "Users can insert own missions"
  ON public.missions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Authenticated users can read their own missions
CREATE POLICY "Users can read own missions"
  ON public.missions FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);
