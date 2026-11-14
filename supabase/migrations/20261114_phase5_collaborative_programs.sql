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

