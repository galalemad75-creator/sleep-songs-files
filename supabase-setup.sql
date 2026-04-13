-- ============================================
-- Sleep Songs - Supabase Database Setup
-- Run this SQL in: Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Chapters table
CREATE TABLE IF NOT EXISTS public.sleep-songs_chapters (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📚',
  songs JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Settings table (ads, contact info, play counts, favorites, etc.)
CREATE TABLE IF NOT EXISTS public.sleep-songs_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security
ALTER TABLE public.sleep-songs_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep-songs_settings ENABLE ROW LEVEL SECURITY;

-- 4. Drop old policies if they exist
DROP POLICY IF EXISTS "r_ch" ON public.sleep-songs_chapters;
DROP POLICY IF EXISTS "w_ch" ON public.sleep-songs_chapters;
DROP POLICY IF EXISTS "r_st" ON public.sleep-songs_settings;
DROP POLICY IF EXISTS "w_st" ON public.sleep-songs_settings;
DROP POLICY IF EXISTS "Allow anon read chapters" ON public.sleep-songs_chapters;
DROP POLICY IF EXISTS "Allow anon read settings" ON public.sleep-songs_settings;
DROP POLICY IF EXISTS "Allow anon write chapters" ON public.sleep-songs_chapters;
DROP POLICY IF EXISTS "Allow anon write settings" ON public.sleep-songs_settings;

-- 5. Create policies (open access for now)
CREATE POLICY "r_ch" ON public.sleep-songs_chapters FOR SELECT USING (true);
CREATE POLICY "w_ch" ON public.sleep-songs_chapters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "r_st" ON public.sleep-songs_settings FOR SELECT USING (true);
CREATE POLICY "w_st" ON public.sleep-songs_settings FOR ALL USING (true) WITH CHECK (true);

-- ✅ Done! Tables are ready.
-- The app will auto-insert default chapters on first load.
