-- ==============================================================================
-- NAATYAVEDAM LIBRARY: COMPLETE PHASE 5 SETUP (SHARED LIBRARY & PROGRAMS)
-- Run this in your Supabase SQL Editor
-- ==============================================================================

-- ==============================================================================
-- NAATYAVEDAM LIBRARY: PHASE 5 — SHARED MUSIC LIBRARY & SUPABASE STORAGE
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. PROFILES TABLE (If not already created in Phase 4)
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
-- 3. REGISTRATION REQUESTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  full_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
  notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reg_requests_user ON public.registration_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_reg_requests_status ON public.registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_reg_requests_username ON public.registration_requests(username);

-- ==============================================================================
-- 4. PASSWORD RESET REQUESTS TABLE
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

-- ==============================================================================
-- 5. DEVICE RECORDS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.device_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  user_agent TEXT,
  ip_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_device UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_device_records_user ON public.device_records(user_id);
CREATE INDEX IF NOT EXISTS idx_device_records_device ON public.device_records(device_id);
CREATE INDEX IF NOT EXISTS idx_device_records_last_active ON public.device_records(last_active_at DESC);

-- ==============================================================================
-- 6. SONGS TABLE (Shared Kuchipudi Music Repertoire)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  duration NUMERIC,
  ragam TEXT,
  talam TEXT,
  composer TEXT,
  category TEXT,
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
-- 7. SONG FILE METADATA TABLE (Separate from general Song metadata)
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
CREATE INDEX IF NOT EXISTS idx_song_files_uploaded_by ON public.song_files(uploaded_by);

-- ==============================================================================
-- 8. ACTIVITY LOGS TABLE (Comprehensive Audit Trail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  username TEXT,
  action_type TEXT NOT NULL CHECK (
    action_type IN (
      'UPLOAD',
      'RENAME',
      'DELETE',
      'RESTORE',
      'FAVORITE',
      'UNFAVORITE',
      'DOWNLOAD',
      'LOGIN',
      'LOGOUT',
      'ACCOUNT_APPROVED',
      'ACCOUNT_REJECTED'
    )
  ),
  song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  song_title TEXT,
  previous_value TEXT,
  new_value TEXT,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON public.activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_account_id ON public.activity_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_song_id ON public.activity_logs(song_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON public.activity_logs(timestamp DESC);

-- ==============================================================================
-- 9. USER FAVORITES TABLE (Personal Favorites per Member)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_favorite UNIQUE(user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_song ON public.user_favorites(song_id);

-- ==============================================================================
-- 10. SUPABASE STORAGE BUCKET CONFIGURATION
-- ==============================================================================
-- Configure the private 'music-library' bucket with 100MB file limit
-- Note: public = false ensures files cannot be read without authentication
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'music-library',
  'music-library',
  false,
  104857600, -- 100MB max per classical recording
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/aac',
    'audio/ogg',
    'audio/opus',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4',
    'audio/flac'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/aac',
    'audio/ogg',
    'audio/opus',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4',
    'audio/flac'
  ];

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- SONGS Policies
-- Rule: Every approved user (Teacher Mam Veda and all approved students) has
-- identical permissions to read, upload, rename, soft delete, restore, and favorite songs.
-- Only permanent hard-deletion is restricted to Teacher.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "songs_select_policy" ON public.songs;
DROP POLICY IF EXISTS "songs_insert_policy" ON public.songs;
DROP POLICY IF EXISTS "songs_update_policy" ON public.songs;
DROP POLICY IF EXISTS "songs_delete_policy" ON public.songs;

CREATE POLICY "songs_select_policy" ON public.songs
  FOR SELECT TO authenticated
  USING (public.is_approved());

CREATE POLICY "songs_insert_policy" ON public.songs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved());

CREATE POLICY "songs_update_policy" ON public.songs
  FOR UPDATE TO authenticated
  USING (public.is_approved())
  WITH CHECK (public.is_approved());

CREATE POLICY "songs_delete_policy" ON public.songs
  FOR DELETE TO authenticated
  USING (public.is_teacher());

-- ------------------------------------------------------------------------------
-- SONG FILES Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "song_files_select_policy" ON public.song_files;
DROP POLICY IF EXISTS "song_files_insert_policy" ON public.song_files;
DROP POLICY IF EXISTS "song_files_update_policy" ON public.song_files;
DROP POLICY IF EXISTS "song_files_delete_policy" ON public.song_files;

CREATE POLICY "song_files_select_policy" ON public.song_files
  FOR SELECT TO authenticated
  USING (public.is_approved());

CREATE POLICY "song_files_insert_policy" ON public.song_files
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved());

CREATE POLICY "song_files_update_policy" ON public.song_files
  FOR UPDATE TO authenticated
  USING (public.is_approved())
  WITH CHECK (public.is_approved());

CREATE POLICY "song_files_delete_policy" ON public.song_files
  FOR DELETE TO authenticated
  USING (public.is_teacher());

-- ------------------------------------------------------------------------------
-- ACTIVITY LOGS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "activity_logs_select_policy" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_policy" ON public.activity_logs;

CREATE POLICY "activity_logs_select_policy" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.is_approved());

CREATE POLICY "activity_logs_insert_policy" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved());

-- ------------------------------------------------------------------------------
-- DEVICE RECORDS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "device_records_select_policy" ON public.device_records;
DROP POLICY IF EXISTS "device_records_insert_policy" ON public.device_records;
DROP POLICY IF EXISTS "device_records_update_policy" ON public.device_records;
DROP POLICY IF EXISTS "device_records_delete_policy" ON public.device_records;

CREATE POLICY "device_records_select_policy" ON public.device_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_teacher());

CREATE POLICY "device_records_insert_policy" ON public.device_records
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "device_records_update_policy" ON public.device_records
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "device_records_delete_policy" ON public.device_records
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_teacher());

-- ------------------------------------------------------------------------------
-- USER FAVORITES Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_favorites_select_policy" ON public.user_favorites;
DROP POLICY IF EXISTS "user_favorites_insert_policy" ON public.user_favorites;
DROP POLICY IF EXISTS "user_favorites_delete_policy" ON public.user_favorites;

CREATE POLICY "user_favorites_select_policy" ON public.user_favorites
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_favorites_insert_policy" ON public.user_favorites
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_favorites_delete_policy" ON public.user_favorites
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- REGISTRATION REQUESTS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "reg_requests_select_policy" ON public.registration_requests;
DROP POLICY IF EXISTS "reg_requests_insert_policy" ON public.registration_requests;
DROP POLICY IF EXISTS "reg_requests_update_policy" ON public.registration_requests;

CREATE POLICY "reg_requests_select_policy" ON public.registration_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_teacher());

CREATE POLICY "reg_requests_insert_policy" ON public.registration_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reg_requests_update_policy" ON public.registration_requests
  FOR UPDATE TO authenticated
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

-- ------------------------------------------------------------------------------
-- STORAGE OBJECTS (Supabase Storage Bucket: music-library)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "music_storage_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "music_storage_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "music_storage_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "music_storage_delete_policy" ON storage.objects;

CREATE POLICY "music_storage_select_policy" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'music-library'
    AND public.is_approved()
  );

CREATE POLICY "music_storage_insert_policy" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'music-library'
    AND public.is_approved()
  );

CREATE POLICY "music_storage_update_policy" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'music-library'
    AND public.is_approved()
  );

CREATE POLICY "music_storage_delete_policy" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'music-library'
    AND (public.is_teacher() OR owner = auth.uid())
  );

-- ==============================================================================
-- 12. STORED FUNCTIONS & RPCs
-- ==============================================================================

-- Atomic Soft Delete Song with Activity Log
CREATE OR REPLACE FUNCTION public.soft_delete_song(p_song_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song RECORD;
  v_caller RECORD;
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Access denied: caller is not an approved member';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO v_song FROM public.songs WHERE id = p_song_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Song not found';
  END IF;

  UPDATE public.songs
  SET is_deleted = true,
      deleted_at = now(),
      deleted_by = auth.uid(),
      updated_at = now()
  WHERE id = p_song_id;

  INSERT INTO public.activity_logs (
    account_id,
    username,
    action_type,
    song_id,
    song_title,
    previous_value,
    new_value,
    details,
    timestamp
  ) VALUES (
    v_caller.id,
    v_caller.username,
    'DELETE',
    v_song.id,
    v_song.title,
    'active',
    'deleted',
    jsonb_build_object('performed_by_name', v_caller.full_name),
    now()
  );

  RETURN jsonb_build_object('success', true, 'song_id', p_song_id);
END;
$$;

-- Atomic Restore Song with Activity Log
CREATE OR REPLACE FUNCTION public.restore_song(p_song_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song RECORD;
  v_caller RECORD;
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Access denied: caller is not an approved member';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO v_song FROM public.songs WHERE id = p_song_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Song not found';
  END IF;

  UPDATE public.songs
  SET is_deleted = false,
      deleted_at = NULL,
      deleted_by = NULL,
      restored_at = now(),
      restored_by = auth.uid(),
      updated_at = now()
  WHERE id = p_song_id;

  INSERT INTO public.activity_logs (
    account_id,
    username,
    action_type,
    song_id,
    song_title,
    previous_value,
    new_value,
    details,
    timestamp
  ) VALUES (
    v_caller.id,
    v_caller.username,
    'RESTORE',
    v_song.id,
    v_song.title,
    'deleted',
    'active',
    jsonb_build_object('performed_by_name', v_caller.full_name),
    now()
  );

  RETURN jsonb_build_object('success', true, 'song_id', p_song_id);
END;
$$;

-- Atomic Rename Song with Activity Log
CREATE OR REPLACE FUNCTION public.rename_song(p_song_id UUID, p_new_title TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_title TEXT;
  v_caller RECORD;
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Access denied: caller is not an approved member';
  END IF;

  IF trim(p_new_title) = '' THEN
    RAISE EXCEPTION 'Song title cannot be empty';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid();
  SELECT title INTO v_old_title FROM public.songs WHERE id = p_song_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Song not found';
  END IF;

  UPDATE public.songs
  SET title = trim(p_new_title),
      updated_at = now()
  WHERE id = p_song_id;

  INSERT INTO public.activity_logs (
    account_id,
    username,
    action_type,
    song_id,
    song_title,
    previous_value,
    new_value,
    details,
    timestamp
  ) VALUES (
    v_caller.id,
    v_caller.username,
    'RENAME',
    p_song_id,
    trim(p_new_title),
    v_old_title,
    trim(p_new_title),
    jsonb_build_object('performed_by_name', v_caller.full_name),
    now()
  );

  RETURN jsonb_build_object('success', true, 'song_id', p_song_id, 'new_title', trim(p_new_title));
END;
$$;

-- Record or Update Device
CREATE OR REPLACE FUNCTION public.record_device(
  p_device_id TEXT,
  p_device_name TEXT,
  p_user_agent TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Caller must be authenticated';
  END IF;

  INSERT INTO public.device_records (
    user_id,
    device_id,
    device_name,
    user_agent,
    is_active,
    last_active_at,
    created_at
  ) VALUES (
    auth.uid(),
    p_device_id,
    p_device_name,
    p_user_agent,
    true,
    now(),
    now()
  )
  ON CONFLICT (user_id, device_id)
  DO UPDATE SET
    device_name = COALESCE(EXCLUDED.device_name, public.device_records.device_name),
    user_agent = COALESCE(EXCLUDED.user_agent, public.device_records.user_agent),
    is_active = true,
    last_active_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant permissions to roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;



-- ==============================================================================
-- COLLABORATIVE PROGRAMS
-- ==============================================================================

-- ==============================================================================
-- NAATYAVEDAM LIBRARY: PHASE 5 — COLLABORATIVE PROGRAM MANAGEMENT
-- ==============================================================================

-- 1. Create PROGRAMS Table
CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_programs_created_by ON public.programs(created_by);
CREATE INDEX IF NOT EXISTS idx_programs_is_deleted ON public.programs(is_deleted);
CREATE INDEX IF NOT EXISTS idx_programs_event_date ON public.programs(event_date);
CREATE INDEX IF NOT EXISTS idx_programs_created_at ON public.programs(created_at DESC);

-- 2. Create PROGRAM AUDIO Table (Edited cuts/mixes specific to a program)
CREATE TABLE IF NOT EXISTS public.program_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  display_title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_format TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  duration NUMERIC,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_program_audio_program ON public.program_audio(program_id);
CREATE INDEX IF NOT EXISTS idx_program_audio_uploaded_by ON public.program_audio(uploaded_by);

-- 3. Create PROGRAM ITEMS Table (Ordered playlist sequence)
CREATE TABLE IF NOT EXISTS public.program_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('library_song', 'program_audio')),
  song_id TEXT, -- references existing Music Library song ID (reusable across multiple programs)
  program_audio_id UUID REFERENCES public.program_audio(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  display_title_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_program_item_source CHECK (
    (source_type = 'library_song' AND song_id IS NOT NULL AND program_audio_id IS NULL) OR
    (source_type = 'program_audio' AND program_audio_id IS NOT NULL AND song_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_program_items_program ON public.program_items(program_id);
CREATE INDEX IF NOT EXISTS idx_program_items_position ON public.program_items(program_id, position);
CREATE INDEX IF NOT EXISTS idx_program_items_song ON public.program_items(song_id);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Rule: Every APPROVED user (Teacher Mam Veda and all approved students) has
-- identical permissions for program management. Unauthenticated or unapproved users
-- are strictly denied access.

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_audio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_items ENABLE ROW LEVEL SECURITY;

-- PROGRAMS Policies
DROP POLICY IF EXISTS "programs_select_policy" ON public.programs;
DROP POLICY IF EXISTS "programs_insert_policy" ON public.programs;
DROP POLICY IF EXISTS "programs_update_policy" ON public.programs;
DROP POLICY IF EXISTS "programs_delete_policy" ON public.programs;

CREATE POLICY "programs_select_policy" ON public.programs
  FOR SELECT TO authenticated
  USING (public.is_approved());

CREATE POLICY "programs_insert_policy" ON public.programs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved());

CREATE POLICY "programs_update_policy" ON public.programs
  FOR UPDATE TO authenticated
  USING (public.is_approved())
  WITH CHECK (public.is_approved());

CREATE POLICY "programs_delete_policy" ON public.programs
  FOR DELETE TO authenticated
  USING (public.is_approved());

-- PROGRAM AUDIO Policies
DROP POLICY IF EXISTS "program_audio_select_policy" ON public.program_audio;
DROP POLICY IF EXISTS "program_audio_insert_policy" ON public.program_audio;
DROP POLICY IF EXISTS "program_audio_update_policy" ON public.program_audio;
DROP POLICY IF EXISTS "program_audio_delete_policy" ON public.program_audio;

CREATE POLICY "program_audio_select_policy" ON public.program_audio
  FOR SELECT TO authenticated
  USING (public.is_approved());

CREATE POLICY "program_audio_insert_policy" ON public.program_audio
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved());

CREATE POLICY "program_audio_update_policy" ON public.program_audio
  FOR UPDATE TO authenticated
  USING (public.is_approved())
  WITH CHECK (public.is_approved());

CREATE POLICY "program_audio_delete_policy" ON public.program_audio
  FOR DELETE TO authenticated
  USING (public.is_approved());

-- PROGRAM ITEMS Policies
DROP POLICY IF EXISTS "program_items_select_policy" ON public.program_items;
DROP POLICY IF EXISTS "program_items_insert_policy" ON public.program_items;
DROP POLICY IF EXISTS "program_items_update_policy" ON public.program_items;
DROP POLICY IF EXISTS "program_items_delete_policy" ON public.program_items;

CREATE POLICY "program_items_select_policy" ON public.program_items
  FOR SELECT TO authenticated
  USING (public.is_approved());

CREATE POLICY "program_items_insert_policy" ON public.program_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved());

CREATE POLICY "program_items_update_policy" ON public.program_items
  FOR UPDATE TO authenticated
  USING (public.is_approved())
  WITH CHECK (public.is_approved());

CREATE POLICY "program_items_delete_policy" ON public.program_items
  FOR DELETE TO authenticated
  USING (public.is_approved());

-- ==============================================================================
-- 5. STORAGE BUCKET CONFIGURATION FOR PROGRAM AUDIO
-- ==============================================================================

-- Create 'program-audio' storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'program-audio',
  'program-audio',
  false,
  104857600, -- 100MB limit per audio file
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/opus']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 104857600;

-- Storage RLS: Approved members can download and stream audio
DROP POLICY IF EXISTS "program_audio_storage_select" ON storage.objects;
CREATE POLICY "program_audio_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'program-audio' AND public.is_approved());

-- Storage RLS: Approved members can upload program-specific audio
DROP POLICY IF EXISTS "program_audio_storage_insert" ON storage.objects;
CREATE POLICY "program_audio_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'program-audio' AND public.is_approved());

-- Storage RLS: Approved members can update/delete program-specific audio
DROP POLICY IF EXISTS "program_audio_storage_delete" ON storage.objects;
CREATE POLICY "program_audio_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'program-audio' AND public.is_approved());

-- ==============================================================================
-- 6. RPC HELPER FUNCTIONS
-- ==============================================================================

-- 6.1 Duplicate Program (Clones program and item references without duplicating audio)
CREATE OR REPLACE FUNCTION public.duplicate_program(
  p_program_id UUID,
  p_new_title TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_source_program RECORD;
  v_new_program_id UUID;
  v_title TEXT;
  v_item RECORD;
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Unauthorized: Only approved school members can duplicate programs.';
  END IF;

  SELECT * INTO v_source_program
  FROM public.programs
  WHERE id = p_program_id AND is_deleted = false;

  IF v_source_program.id IS NULL THEN
    RAISE EXCEPTION 'Source program not found.';
  END IF;

  v_title := COALESCE(p_new_title, v_source_program.title || ' (Copy)');
  v_new_program_id := gen_random_uuid();

  -- 1. Insert new cloned program
  INSERT INTO public.programs (
    id,
    title,
    description,
    event_date,
    created_by,
    created_at,
    updated_at,
    is_deleted
  ) VALUES (
    v_new_program_id,
    v_title,
    v_source_program.description,
    v_source_program.event_date,
    auth.uid(),
    now(),
    now(),
    false
  );

  -- 2. Clone program items with exact positions and audio references
  FOR v_item IN
    SELECT * FROM public.program_items
    WHERE program_id = p_program_id
    ORDER BY position ASC
  LOOP
    INSERT INTO public.program_items (
      program_id,
      source_type,
      song_id,
      program_audio_id,
      position,
      display_title_override,
      created_at,
      updated_at
    ) VALUES (
      v_new_program_id,
      v_item.source_type,
      v_item.song_id,
      v_item.program_audio_id,
      v_item.position,
      v_item.display_title_override,
      now(),
      now()
    );
  END LOOP;

  -- 3. Audit log
  INSERT INTO public.audit_logs (
    action,
    performed_by,
    details
  ) VALUES (
    'PROGRAM_DUPLICATED',
    auth.uid(),
    jsonb_build_object(
      'source_program_id', p_program_id,
      'new_program_id', v_new_program_id,
      'title', v_title
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_program_id', v_new_program_id,
    'title', v_title
  );
END;
$$;

-- 6.2 Atomic Drag-and-Drop Reorder Program Items
CREATE OR REPLACE FUNCTION public.reorder_program_items(
  p_program_id UUID,
  p_item_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_idx INT;
  v_item_id UUID;
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Unauthorized: Only approved school members can reorder programs.';
  END IF;

  FOR v_idx IN 1 .. array_length(p_item_ids, 1) LOOP
    v_item_id := p_item_ids[v_idx];
    UPDATE public.program_items
    SET position = v_idx - 1, updated_at = now()
    WHERE id = v_item_id AND program_id = p_program_id;
  END LOOP;

  UPDATE public.programs
  SET updated_at = now()
  WHERE id = p_program_id;

  RETURN jsonb_build_object('success', true, 'item_count', array_length(p_item_ids, 1));
END;
$$;

-- 6.3 Soft Delete Program
CREATE OR REPLACE FUNCTION public.soft_delete_program(p_program_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Unauthorized: Only approved school members can delete programs.';
  END IF;

  UPDATE public.programs
  SET is_deleted = true, deleted_at = now(), updated_at = now()
  WHERE id = p_program_id;

  INSERT INTO public.audit_logs (
    action,
    performed_by,
    details
  ) VALUES (
    'PROGRAM_DELETED',
    auth.uid(),
    jsonb_build_object('program_id', p_program_id)
  );

  RETURN jsonb_build_object('success', true, 'program_id', p_program_id);
END;
$$;

-- 6.4 Restore Program from Trash
CREATE OR REPLACE FUNCTION public.restore_program(p_program_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Unauthorized: Only approved school members can restore programs.';
  END IF;

  UPDATE public.programs
  SET is_deleted = false, deleted_at = NULL, updated_at = now()
  WHERE id = p_program_id;

  INSERT INTO public.audit_logs (
    action,
    performed_by,
    details
  ) VALUES (
    'PROGRAM_RESTORED',
    auth.uid(),
    jsonb_build_object('program_id', p_program_id)
  );

  RETURN jsonb_build_object('success', true, 'program_id', p_program_id);
END;
$$;

-- Grant permissions to authenticated API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

