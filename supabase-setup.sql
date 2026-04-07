-- ============================================
-- Sleep Songs - Supabase Database Setup
-- Run this SQL in: Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Chapters table (stores song metadata)
CREATE TABLE IF NOT EXISTS public.chapters (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📚',
  songs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Settings table (ads, contact info, passwords, etc.)
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 4. Allow anonymous read access (for visitors)
CREATE POLICY "Allow anon read chapters" ON public.chapters
  FOR SELECT USING (true);

CREATE POLICY "Allow anon read settings" ON public.settings
  FOR SELECT USING (true);

-- 5. Allow anonymous insert/update (for admin panel)
--    ⚠️ In production, add auth checks!
CREATE POLICY "Allow anon write chapters" ON public.chapters
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon write settings" ON public.settings
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Insert default chapters (30 chapters)
INSERT INTO public.chapters (id, name, icon, songs) VALUES
  (1, 'Chapter 1', '📚', '[]'::jsonb),
  (2, 'Chapter 2', '📚', '[]'::jsonb),
  (3, 'Chapter 3', '📚', '[]'::jsonb),
  (4, 'Chapter 4', '📚', '[]'::jsonb),
  (5, 'Chapter 5', '📚', '[]'::jsonb),
  (6, 'Chapter 6', '📚', '[]'::jsonb),
  (7, 'Chapter 7', '📚', '[]'::jsonb),
  (8, 'Chapter 8', '📚', '[]'::jsonb),
  (9, 'Chapter 9', '📚', '[]'::jsonb),
  (10, 'Chapter 10', '📚', '[]'::jsonb),
  (11, 'Chapter 11', '📚', '[]'::jsonb),
  (12, 'Chapter 12', '📚', '[]'::jsonb),
  (13, 'Chapter 13', '📚', '[]'::jsonb),
  (14, 'Chapter 14', '📚', '[]'::jsonb),
  (15, 'Chapter 15', '📚', '[]'::jsonb),
  (16, 'Chapter 16', '📚', '[]'::jsonb),
  (17, 'Chapter 17', '📚', '[]'::jsonb),
  (18, 'Chapter 18', '📚', '[]'::jsonb),
  (19, 'Chapter 19', '📚', '[]'::jsonb),
  (20, 'Chapter 20', '📚', '[]'::jsonb),
  (21, 'Chapter 21', '📚', '[]'::jsonb),
  (22, 'Chapter 22', '📚', '[]'::jsonb),
  (23, 'Chapter 23', '📚', '[]'::jsonb),
  (24, 'Chapter 24', '📚', '[]'::jsonb),
  (25, 'Chapter 25', '📚', '[]'::jsonb),
  (26, 'Chapter 26', '📚', '[]'::jsonb),
  (27, 'Chapter 27', '📚', '[]'::jsonb),
  (28, 'Chapter 28', '📚', '[]'::jsonb),
  (29, 'Chapter 29', '📚', '[]'::jsonb),
  (30, 'Chapter 30', '📚', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ✅ Done! Tables are ready.
