-- ReliefLink.JA - Row Level Security (RLS) Policies
-- Run these in the Supabase SQL Editor (Dashboard > SQL Editor)

-- ============================================
-- 1. Create the profiles table (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'volunteer' CHECK (role IN ('volunteer', 'admin')),
  parish_hub TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Profiles: users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Profiles: allow insert on signup (new user creates their profile)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ============================================
-- 2. Logistics tables - Only authenticated volunteers
-- ============================================
-- Apply to your logistics/shipments/warehouses tables.
-- Example for a generic logistics_data table:

-- Enable RLS on the table
-- ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users with a profile (volunteers/admins) can SELECT
-- CREATE POLICY "Authenticated volunteers can read logistics"
--   ON public.shipments FOR SELECT
--   USING (
--     auth.role() = 'authenticated'
--     AND EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE profiles.id = auth.uid()
--     )
--   );

-- Policy: Only authenticated users can INSERT/UPDATE/DELETE (restrict as needed)
-- CREATE POLICY "Authenticated volunteers can insert logistics"
--   ON public.shipments FOR INSERT
--   WITH CHECK (
--     auth.role() = 'authenticated'
--     AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid())
--   );


-- ============================================
-- 3. Generic RLS template for logistics data
-- ============================================
-- Replace YOUR_TABLE_NAME with: shipments, warehouses, help_requests, etc.

/*
ALTER TABLE public.YOUR_TABLE_NAME ENABLE ROW LEVEL SECURITY;

-- SELECT: Only authenticated users who have a profile (volunteer/admin)
CREATE POLICY "Authenticated volunteers can read YOUR_TABLE_NAME"
  ON public.YOUR_TABLE_NAME FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid())
  );

-- INSERT: Same rule
CREATE POLICY "Authenticated volunteers can insert YOUR_TABLE_NAME"
  ON public.YOUR_TABLE_NAME FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid())
  );

-- UPDATE: Same rule
CREATE POLICY "Authenticated volunteers can update YOUR_TABLE_NAME"
  ON public.YOUR_TABLE_NAME FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid())
  );

-- DELETE: Optional - restrict to admins only if needed
CREATE POLICY "Authenticated volunteers can delete YOUR_TABLE_NAME"
  ON public.YOUR_TABLE_NAME FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid())
  );
*/


-- ============================================
-- 4. Trigger to auto-create profile on signup (optional)
-- ============================================
-- This ensures every new user gets a profile row. The app also inserts on signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'volunteer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
