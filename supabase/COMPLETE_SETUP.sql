-- ==============================================================================
-- NAATYAVEDAM LIBRARY: COMPLETE CLOUD SETUP & MASTER MIGRATION
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard)
-- Project: https://zmqdcowjmwraevxjafha.supabase.co
-- ==============================================================================

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. PROFILES TABLE & AUTH HELPERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('TEACHER', 'STUDENT')) DEFAULT 'STUDENT',
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REMOVED')) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  removed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Helper security functions
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'TEACHER'
      AND status = 'APPROVED'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'APPROVED'
  );
$$;

-- ==============================================================================
-- 3. PASSWORD RESET REQUESTS & AUDIT LOGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')) DEFAULT 'PENDING',
  reset_code TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON public.password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_status ON public.password_reset_requests(status);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  target_user_id UUID,
  target_username TEXT,
  performed_by UUID REFERENCES public.profiles(id),
  performed_by_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. SONGS TABLE (Shared Kuchipudi Music Repertoire)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'audio/mpeg',
  file_size BIGINT NOT NULL DEFAULT 0,
  duration NUMERIC,
  ragam TEXT,
  talam TEXT,
  composer TEXT,
  category TEXT DEFAULT 'Other',
  notes TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  restored_at TIMESTAMPTZ,
  restored_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_songs_is_deleted ON public.songs(is_deleted);
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON public.songs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_uploaded_by ON public.songs(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_songs_title ON public.songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_category ON public.songs(category);
CREATE INDEX IF NOT EXISTS idx_songs_updated_at ON public.songs(updated_at DESC);

-- ==============================================================================
-- 5. SONG FILES METADATA TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.song_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL DEFAULT 'music-library',
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  duration_seconds NUMERIC,
  md5_hash TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_song_files_song_id ON public.song_files(song_id);
CREATE INDEX IF NOT EXISTS idx_song_files_storage_path ON public.song_files(storage_path);

-- ==============================================================================
-- 6. ACTIVITY LOGS TABLE (Repertoire Audit Trail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  username TEXT,
  action_type TEXT NOT NULL,
  song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  song_title TEXT,
  previous_value TEXT,
  new_value TEXT,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON public.activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON public.activity_logs(timestamp DESC);

-- ==============================================================================
-- 7. USER FAVORITES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_favorite UNIQUE(user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON public.user_favorites(user_id);

-- ==============================================================================
-- 8. PROGRAMS & PROGRAM ITEMS TABLES (Collaborative Dance Performance Programs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programs_is_deleted ON public.programs(is_deleted);
CREATE INDEX IF NOT EXISTS idx_programs_updated_at ON public.programs(updated_at DESC);

CREATE TABLE IF NOT EXISTS public.program_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('library_song', 'program_audio')),
  song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  program_audio_id UUID,
  position INTEGER NOT NULL DEFAULT 0,
  display_title_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_items_program_id ON public.program_items(program_id);
CREATE INDEX IF NOT EXISTS idx_program_items_position ON public.program_items(program_id, position);

-- ==============================================================================
-- 9. SUPABASE STORAGE BUCKETS (Audio Files)
-- ==============================================================================
-- 9.1 music-library bucket for shared classical music
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'music-library',
  'music-library',
  false,
  104857600, -- 100MB per file
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/aac',
    'audio/x-aac',
    'audio/ogg',
    'audio/opus',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4',
    'audio/flac',
    'audio/amr',
    'audio/3gpp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 104857600;

-- 9.2 program-audio bucket for edited rehearsal clips
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'program-audio',
  'program-audio',
  false,
  104857600,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/opus']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 104857600;

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_items ENABLE ROW LEVEL SECURITY;

-- 10.1 Profiles policies
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_self_or_teacher" ON public.profiles;
CREATE POLICY "profiles_update_self_or_teacher" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_teacher())
  WITH CHECK (id = auth.uid() OR public.is_teacher());

-- 10.2 Songs policies (Teachers and approved students have shared library access)
DROP POLICY IF EXISTS "songs_select" ON public.songs;
CREATE POLICY "songs_select" ON public.songs FOR SELECT TO authenticated USING (public.is_approved());

DROP POLICY IF EXISTS "songs_insert" ON public.songs;
CREATE POLICY "songs_insert" ON public.songs FOR INSERT TO authenticated WITH CHECK (public.is_approved());

DROP POLICY IF EXISTS "songs_update" ON public.songs;
CREATE POLICY "songs_update" ON public.songs FOR UPDATE TO authenticated USING (public.is_approved()) WITH CHECK (public.is_approved());

DROP POLICY IF EXISTS "songs_delete" ON public.songs;
CREATE POLICY "songs_delete" ON public.songs FOR DELETE TO authenticated USING (public.is_teacher());

-- 10.3 Song Files policies
DROP POLICY IF EXISTS "song_files_select" ON public.song_files;
CREATE POLICY "song_files_select" ON public.song_files FOR SELECT TO authenticated USING (public.is_approved());

DROP POLICY IF EXISTS "song_files_insert" ON public.song_files;
CREATE POLICY "song_files_insert" ON public.song_files FOR INSERT TO authenticated WITH CHECK (public.is_approved());

DROP POLICY IF EXISTS "song_files_update" ON public.song_files;
CREATE POLICY "song_files_update" ON public.song_files FOR UPDATE TO authenticated USING (public.is_approved()) WITH CHECK (public.is_approved());

DROP POLICY IF EXISTS "song_files_delete" ON public.song_files;
CREATE POLICY "song_files_delete" ON public.song_files FOR DELETE TO authenticated USING (public.is_teacher());

-- 10.4 Activity Logs policies
DROP POLICY IF EXISTS "activity_logs_select" ON public.activity_logs;
CREATE POLICY "activity_logs_select" ON public.activity_logs FOR SELECT TO authenticated USING (public.is_approved());

DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;
CREATE POLICY "activity_logs_insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (public.is_approved());

-- 10.5 Programs policies
DROP POLICY IF EXISTS "programs_select" ON public.programs;
CREATE POLICY "programs_select" ON public.programs FOR SELECT TO authenticated USING (public.is_approved());

DROP POLICY IF EXISTS "programs_insert" ON public.programs;
CREATE POLICY "programs_insert" ON public.programs FOR INSERT TO authenticated WITH CHECK (public.is_approved());

DROP POLICY IF EXISTS "programs_update" ON public.programs;
CREATE POLICY "programs_update" ON public.programs FOR UPDATE TO authenticated USING (public.is_approved()) WITH CHECK (public.is_approved());

DROP POLICY IF EXISTS "programs_delete" ON public.programs;
CREATE POLICY "programs_delete" ON public.programs FOR DELETE TO authenticated USING (public.is_approved());

-- 10.6 Program Items policies
DROP POLICY IF EXISTS "program_items_select" ON public.program_items;
CREATE POLICY "program_items_select" ON public.program_items FOR SELECT TO authenticated USING (public.is_approved());

DROP POLICY IF EXISTS "program_items_insert" ON public.program_items;
CREATE POLICY "program_items_insert" ON public.program_items FOR INSERT TO authenticated WITH CHECK (public.is_approved());

DROP POLICY IF EXISTS "program_items_update" ON public.program_items;
CREATE POLICY "program_items_update" ON public.program_items FOR UPDATE TO authenticated USING (public.is_approved()) WITH CHECK (public.is_approved());

DROP POLICY IF EXISTS "program_items_delete" ON public.program_items;
CREATE POLICY "program_items_delete" ON public.program_items FOR DELETE TO authenticated USING (public.is_approved());

-- 10.7 Storage policies (music-library and program-audio)
DROP POLICY IF EXISTS "music_storage_select" ON storage.objects;
CREATE POLICY "music_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('music-library', 'program-audio') AND public.is_approved());

DROP POLICY IF EXISTS "music_storage_insert" ON storage.objects;
CREATE POLICY "music_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('music-library', 'program-audio') AND public.is_approved());

DROP POLICY IF EXISTS "music_storage_update" ON storage.objects;
CREATE POLICY "music_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('music-library', 'program-audio') AND public.is_approved());

DROP POLICY IF EXISTS "music_storage_delete" ON storage.objects;
CREATE POLICY "music_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('music-library', 'program-audio') AND (public.is_teacher() OR owner = auth.uid()));

-- ==============================================================================
-- 11. SEED DEFAULT DATA: TEACHER (veda), STUDENT (sk), AND AALOKAYE SONG
-- ==============================================================================

-- 11.1 Ensure passwords for veda and sk are set to 'naatyavedam' and status is APPROVED
UPDATE auth.users
SET 
  encrypted_password = crypt('naatyavedam', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email IN ('veda@naatyavedam.com', 'sk@naatyavedam.com');

UPDATE public.profiles
SET status = 'APPROVED'
WHERE username IN ('veda', 'sk');

-- 11.2 Seed Aalokaye Sri Baala Krishnam in public.songs
INSERT INTO public.songs (
  id,
  title,
  original_filename,
  file_type,
  file_size,
  duration,
  ragam,
  talam,
  composer,
  category,
  notes,
  is_favorite,
  is_deleted,
  uploaded_by,
  uploaded_by_name,
  created_at,
  updated_at
) VALUES (
  'a10ca7e0-0000-4000-8000-000000000001',
  'Aalokaye Sri Baala Krishnam',
  'Aalokaye Sri Baala Krishnam.aac',
  'audio/aac',
  5242880, -- 5 MB estimate
  280,
  'Hamsanandi / Traditional',
  'Adi',
  'Narayana Teertha',
  'Tarangam',
  'Master repertoire Kuchipudi Tarangam recording.',
  true,
  false,
  '3061cb61-d858-4748-92ea-ad0ade2e997d',
  'Guru Veda',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  title = 'Aalokaye Sri Baala Krishnam',
  is_deleted = false;

-- 11.3 Seed file record in song_files
INSERT INTO public.song_files (
  song_id,
  bucket_id,
  storage_path,
  file_name,
  mime_type,
  size_bytes,
  uploaded_by,
  created_at,
  updated_at
) VALUES (
  'a10ca7e0-0000-4000-8000-000000000001',
  'music-library',
  'audio/a10ca7e0-0000-4000-8000-000000000001/Aalokaye_Sri_Baala_Krishnam.aac',
  'Aalokaye Sri Baala Krishnam.aac',
  'audio/aac',
  5242880,
  '3061cb61-d858-4748-92ea-ad0ade2e997d',
  now(),
  now()
)
ON CONFLICT (storage_path) DO NOTHING;

-- Grant permissions to public API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
