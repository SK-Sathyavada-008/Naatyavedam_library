-- ==============================================================================
-- NAATYAVEDAM LIBRARY: PHASE 4 — AUTHENTICATION AND ROLE-BASED ACCESS
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop existing triggers if updating
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;

-- 3. Create PROFILES table
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

-- Index for fast lookup by username and status
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 4. Create PASSWORD RESET REQUESTS table
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

-- 5. Create AUDIT LOGS table
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- 6. SECURITY HELPER FUNCTIONS
-- ==============================================================================

-- Check if authenticated caller is an approved Teacher
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

-- Check if authenticated caller is an approved Member (Teacher or Student)
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

-- Get current authenticated user profile
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM public.profiles
  WHERE id = auth.uid();
$$;

-- Check if teacher has been initialized
CREATE OR REPLACE FUNCTION public.get_teacher_initialization_status()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'is_initialized',
    EXISTS (SELECT 1 FROM public.profiles WHERE role = 'TEACHER')
  );
$$;

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if updating
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_teacher_manage_policy" ON public.profiles;
DROP POLICY IF EXISTS "resets_teacher_policy" ON public.password_reset_requests;
DROP POLICY IF EXISTS "resets_user_select_policy" ON public.password_reset_requests;
DROP POLICY IF EXISTS "audit_teacher_policy" ON public.audit_logs;

-- PROFILES SELECT:
-- 1. Teachers can view all profiles
-- 2. Approved members can view approved profiles (for shared library members list)
-- 3. Any authenticated user can view their own profile (even if pending or rejected)
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.is_teacher()
    OR id = auth.uid()
    OR (public.is_approved() AND status = 'APPROVED')
  );

-- PROFILES UPDATE:
-- Students may only update their own full_name. They can NEVER modify role or status.
CREATE POLICY "profiles_update_self_policy" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Ensure role and status are untouched by non-teachers
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())
  );

-- PROFILES TEACHER MANAGE:
-- Teachers have full update and management access
CREATE POLICY "profiles_teacher_manage_policy" ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

-- PASSWORD RESETS POLICIES:
CREATE POLICY "resets_teacher_policy" ON public.password_reset_requests
  FOR ALL
  TO authenticated
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

CREATE POLICY "resets_user_select_policy" ON public.password_reset_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- AUDIT LOGS POLICIES:
CREATE POLICY "audit_teacher_policy" ON public.audit_logs
  FOR ALL
  TO authenticated
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

-- ==============================================================================
-- 8. AUTH TRIGGERS
-- ==============================================================================

-- Auto-confirm user emails for internal username domain
CREATE OR REPLACE FUNCTION public.handle_auth_user_auto_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Mark email as confirmed automatically so username-based login works without mail server
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());

  -- Supabase GoTrue requires non-null string values for token and change fields.
  -- NULL values cause GoTrue to crash with: "converting NULL to string is unsupported" (Database error querying schema).
  NEW.confirmation_token := COALESCE(NEW.confirmation_token, '');
  NEW.recovery_token := COALESCE(NEW.recovery_token, '');
  NEW.email_change := COALESCE(NEW.email_change, '');
  NEW.email_change_token_new := COALESCE(NEW.email_change_token_new, '');
  NEW.email_change_token_current := COALESCE(NEW.email_change_token_current, '');
  NEW.phone_change := COALESCE(NEW.phone_change, '');
  NEW.phone_change_token := COALESCE(NEW.phone_change_token, '');
  NEW.reauthentication_token := COALESCE(NEW.reauthentication_token, '');
  NEW.aud := COALESCE(NEW.aud, 'authenticated');
  NEW.role := COALESCE(NEW.role, 'authenticated');
  NEW.is_super_admin := COALESCE(NEW.is_super_admin, false);
  NEW.is_sso_user := COALESCE(NEW.is_sso_user, false);
  NEW.is_anonymous := COALESCE(NEW.is_anonymous, false);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_auto_confirm();

-- Automatically create profile on student registration
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_raw_username TEXT;
  v_clean_username TEXT;
  v_full_name TEXT;
  v_teacher_count INT;
BEGIN
  v_raw_username := NEW.raw_user_meta_data->>'username';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Student');

  -- If no username provided, extract from email prefix
  IF v_raw_username IS NULL OR trim(v_raw_username) = '' THEN
    v_clean_username := lower(split_part(NEW.email, '@', 1));
  ELSE
    v_clean_username := lower(trim(v_raw_username));
  END IF;

  -- Security check: check if any teacher exists
  SELECT count(*) INTO v_teacher_count FROM public.profiles WHERE role = 'TEACHER';

  -- If no teacher exists and metadata requested teacher initialization, allow first teacher
  IF v_teacher_count = 0 AND (NEW.raw_user_meta_data->>'is_first_teacher')::boolean = true THEN
    INSERT INTO public.profiles (
      id,
      username,
      full_name,
      role,
      status,
      approved_at
    ) VALUES (
      NEW.id,
      v_clean_username,
      v_full_name,
      'TEACHER',
      'APPROVED',
      now()
    );
  ELSE
    -- Every regular signup is ALWAYS strictly forced to STUDENT and PENDING
    INSERT INTO public.profiles (
      id,
      username,
      full_name,
      role,
      status
    ) VALUES (
      NEW.id,
      v_clean_username,
      v_full_name,
      'STUDENT',
      'PENDING'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ==============================================================================
-- 9. SECURE RPC MANAGEMENT FUNCTIONS
-- ==============================================================================

-- 9.1 Teacher Initialization RPC
CREATE OR REPLACE FUNCTION public.initialize_teacher_account(
  p_username TEXT,
  p_password TEXT,
  p_full_name TEXT DEFAULT 'Guru Veda'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_teacher_count INT;
  v_user_id UUID;
  v_email TEXT;
  v_encrypted_pw TEXT;
  v_clean_username TEXT;
BEGIN
  v_clean_username := lower(trim(p_username));
  v_email := v_clean_username || '@naatyavedam.com';
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  -- Allow re-initializing default teacher 'veda', but prevent public from creating additional teachers
  IF v_clean_username != 'veda' THEN
    SELECT count(*) INTO v_teacher_count FROM public.profiles WHERE role = 'TEACHER';
    IF v_teacher_count > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'A Teacher account is already initialized for this school.'
      );
    END IF;
  END IF;

  v_user_id := gen_random_uuid();

  -- Clean up any existing auth user and profile for this email/username to ensure clean re-initialization
  DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = v_email);
  DELETE FROM public.profiles WHERE username = v_clean_username;
  DELETE FROM auth.users WHERE email = v_email;

  -- Insert into auth.users with pre-confirmed email and safe empty string tokens
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token,
    is_super_admin,
    is_sso_user,
    is_anonymous
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_encrypted_pw,
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('username', v_clean_username, 'full_name', p_full_name, 'is_first_teacher', true),
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    false,
    false,
    false
  );

  -- Insert identity with provider_id matching user UUID text (required by Supabase GoTrue)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    format('{"sub":"%s","email":"%s"}', v_user_id::text, v_email)::jsonb,
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  -- Ensure profile is created as approved TEACHER
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    role,
    status,
    created_at,
    updated_at,
    approved_at
  ) VALUES (
    v_user_id,
    v_clean_username,
    p_full_name,
    'TEACHER',
    'APPROVED',
    now(),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'TEACHER',
    status = 'APPROVED',
    full_name = p_full_name,
    approved_at = now();

  -- Audit log
  INSERT INTO public.audit_logs (
    action,
    target_user_id,
    target_username,
    performed_by,
    performed_by_name,
    details
  ) VALUES (
    'TEACHER_INITIALIZED',
    v_user_id,
    v_clean_username,
    v_user_id,
    p_full_name,
    jsonb_build_object('username', v_clean_username)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Teacher account initialized successfully.',
    'username', v_clean_username
  );
END;
$$;

-- 9.2 Teacher Approve Student
CREATE OR REPLACE FUNCTION public.approve_student(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_is_teacher BOOLEAN;
  v_student_username TEXT;
  v_caller_name TEXT;
BEGIN
  -- Authorization guard
  v_caller_is_teacher := public.is_teacher();
  IF NOT v_caller_is_teacher THEN
    RAISE EXCEPTION 'Unauthorized: Only the dance teacher can approve student registrations.';
  END IF;

  SELECT username INTO v_student_username FROM public.profiles WHERE id = p_student_id;
  IF v_student_username IS NULL THEN
    RAISE EXCEPTION 'Student profile not found.';
  END IF;

  SELECT full_name INTO v_caller_name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.profiles
  SET
    status = 'APPROVED',
    approved_at = now(),
    approved_by = auth.uid(),
    updated_at = now()
  WHERE id = p_student_id;

  -- Audit log
  INSERT INTO public.audit_logs (
    action,
    target_user_id,
    target_username,
    performed_by,
    performed_by_name,
    details
  ) VALUES (
    'STUDENT_APPROVED',
    p_student_id,
    v_student_username,
    auth.uid(),
    v_caller_name,
    jsonb_build_object('approved_by', auth.uid())
  );

  RETURN jsonb_build_object('success', true, 'username', v_student_username);
END;
$$;

-- 9.3 Teacher Reject Student
CREATE OR REPLACE FUNCTION public.reject_student(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_student_username TEXT;
  v_caller_name TEXT;
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Unauthorized: Only the dance teacher can reject registrations.';
  END IF;

  SELECT username INTO v_student_username FROM public.profiles WHERE id = p_student_id;
  SELECT full_name INTO v_caller_name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.profiles
  SET
    status = 'REJECTED',
    updated_at = now()
  WHERE id = p_student_id;

  INSERT INTO public.audit_logs (
    action,
    target_user_id,
    target_username,
    performed_by,
    performed_by_name,
    details
  ) VALUES (
    'STUDENT_REJECTED',
    p_student_id,
    v_student_username,
    auth.uid(),
    v_caller_name,
    jsonb_build_object('rejected_by', auth.uid())
  );

  RETURN jsonb_build_object('success', true, 'username', v_student_username);
END;
$$;

-- 9.4 Teacher Remove Student
CREATE OR REPLACE FUNCTION public.remove_student(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_student_username TEXT;
  v_caller_name TEXT;
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Unauthorized: Only the dance teacher can remove students.';
  END IF;

  -- Prevent removing another teacher or yourself
  IF p_student_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove your own teacher account.';
  END IF;

  SELECT username INTO v_student_username FROM public.profiles WHERE id = p_student_id;
  SELECT full_name INTO v_caller_name FROM public.profiles WHERE id = auth.uid();

  -- Mark profile as REMOVED (RLS will immediately deny all queries)
  UPDATE public.profiles
  SET
    status = 'REMOVED',
    removed_at = now(),
    updated_at = now()
  WHERE id = p_student_id;

  -- Invalidate auth user's sessions by updating updated_at / banned
  UPDATE auth.users
  SET banned_until = '2099-01-01 00:00:00Z', updated_at = now()
  WHERE id = p_student_id;

  INSERT INTO public.audit_logs (
    action,
    target_user_id,
    target_username,
    performed_by,
    performed_by_name,
    details
  ) VALUES (
    'STUDENT_REMOVED',
    p_student_id,
    v_student_username,
    auth.uid(),
    v_caller_name,
    jsonb_build_object('removed_by', auth.uid())
  );

  RETURN jsonb_build_object('success', true, 'username', v_student_username);
END;
$$;

-- 9.5 Student Request Password Reset
CREATE OR REPLACE FUNCTION public.request_password_reset(p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_clean_username TEXT;
  v_status TEXT;
  v_existing_id UUID;
BEGIN
  v_clean_username := lower(trim(p_username));

  SELECT id, status INTO v_user_id, v_status
  FROM public.profiles
  WHERE username = v_clean_username;

  IF v_user_id IS NULL THEN
    -- Return success anyway to avoid user enumeration attacks
    RETURN jsonb_build_object(
      'success', true,
      'message', 'If this username exists, your reset request has been sent to the teacher.'
    );
  END IF;

  IF v_status != 'APPROVED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Password reset is only available for approved members.'
    );
  END IF;

  -- Check for existing pending request
  SELECT id INTO v_existing_id
  FROM public.password_reset_requests
  WHERE user_id = v_user_id AND status = 'PENDING';

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'A reset request is already pending teacher review.'
    );
  END IF;

  INSERT INTO public.password_reset_requests (
    user_id,
    username,
    status
  ) VALUES (
    v_user_id,
    v_clean_username,
    'PENDING'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Password reset request submitted. Please notify your dance teacher to approve it.'
  );
END;
$$;

-- 9.6 Teacher Approve Password Reset (Generates 6-character reset code)
CREATE OR REPLACE FUNCTION public.approve_password_reset(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_code TEXT;
  v_username TEXT;
  v_user_id UUID;
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Unauthorized: Only the dance teacher can approve password reset requests.';
  END IF;

  -- Generate secure random 6-character uppercase alphanumeric code
  v_code := upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));

  SELECT user_id, username INTO v_user_id, v_username
  FROM public.password_reset_requests
  WHERE id = p_request_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Reset request not found.';
  END IF;

  UPDATE public.password_reset_requests
  SET
    status = 'APPROVED',
    reset_code = v_code,
    expires_at = now() + INTERVAL '24 hours',
    reviewed_at = now(),
    reviewed_by = auth.uid()
  WHERE id = p_request_id;

  INSERT INTO public.audit_logs (
    action,
    target_user_id,
    target_username,
    performed_by,
    details
  ) VALUES (
    'PASSWORD_RESET_APPROVED',
    v_user_id,
    v_username,
    auth.uid(),
    jsonb_build_object('request_id', p_request_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'reset_code', v_code,
    'username', v_username,
    'expires_in', '24 hours'
  );
END;
$$;

-- 9.7 Complete Password Reset (Student sets new password with reset code)
CREATE OR REPLACE FUNCTION public.complete_password_reset(
  p_username TEXT,
  p_reset_code TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_username TEXT;
  v_clean_code TEXT;
  v_user_id UUID;
  v_request_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  v_clean_username := lower(trim(p_username));
  v_clean_code := upper(trim(p_reset_code));

  IF length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters.');
  END IF;

  -- Find matching approved reset request that has not expired
  SELECT r.id, r.user_id INTO v_request_id, v_user_id
  FROM public.password_reset_requests r
  JOIN public.profiles p ON p.id = r.user_id
  WHERE p.username = v_clean_username
    AND r.reset_code = v_clean_code
    AND r.status = 'APPROVED'
    AND r.expires_at > now()
  LIMIT 1;

  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired reset code. Please check the code with your teacher.'
    );
  END IF;

  -- Hash new password and update in auth.users
  v_encrypted_pw := crypt(p_new_password, gen_salt('bf'));

  UPDATE auth.users
  SET
    encrypted_password = v_encrypted_pw,
    updated_at = now()
  WHERE id = v_user_id;

  -- Mark reset request as COMPLETED
  UPDATE public.password_reset_requests
  SET
    status = 'COMPLETED',
    reset_code = NULL
  WHERE id = v_request_id;

  INSERT INTO public.audit_logs (
    action,
    target_user_id,
    target_username,
    details
  ) VALUES (
    'PASSWORD_RESET_COMPLETED',
    v_user_id,
    v_clean_username,
    jsonb_build_object('request_id', v_request_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your password has been successfully reset! You can now sign in.'
  );
END;
$$;

-- 9.8 Student Account Creation / Seed RPC (for initial student SK)
CREATE OR REPLACE FUNCTION public.create_initial_student_account(
  p_username TEXT,
  p_password TEXT,
  p_full_name TEXT DEFAULT 'SK'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_encrypted_pw TEXT;
  v_clean_username TEXT;
BEGIN
  v_clean_username := lower(trim(p_username));
  v_email := v_clean_username || '@naatyavedam.com';
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));
  v_user_id := gen_random_uuid();

  -- Clean up existing student record to ensure clean re-initialization
  DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = v_email);
  DELETE FROM public.profiles WHERE username = v_clean_username;
  DELETE FROM auth.users WHERE email = v_email;

  -- Insert into auth.users with pre-confirmed email and safe empty string tokens
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token,
    is_super_admin,
    is_sso_user,
    is_anonymous
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_encrypted_pw,
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('username', v_clean_username, 'full_name', p_full_name),
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    false,
    false,
    false
  );

  -- Insert identity with provider_id matching user UUID text (required by Supabase GoTrue)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    format('{"sub":"%s","email":"%s"}', v_user_id::text, v_email)::jsonb,
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  -- Ensure profile is created as approved STUDENT
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    role,
    status,
    created_at,
    updated_at,
    approved_at
  ) VALUES (
    v_user_id,
    v_clean_username,
    p_full_name,
    'STUDENT',
    'APPROVED',
    now(),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'STUDENT',
    status = 'APPROVED',
    full_name = p_full_name,
    approved_at = now();

  -- Audit log
  INSERT INTO public.audit_logs (
    action,
    target_user_id,
    target_username,
    details
  ) VALUES (
    'STUDENT_INITIALIZED',
    v_user_id,
    v_clean_username,
    jsonb_build_object('username', v_clean_username, 'full_name', p_full_name)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Student account created successfully.',
    'username', v_clean_username
  );
END;
$$;

-- ==============================================================================
-- 10. REPAIR EXISTING TOKENS & GRANT SCHEMA PERMISSIONS
-- ==============================================================================

-- Fix any NULL token columns in auth.users that cause GoTrue schema query errors
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE 
  confirmation_token IS NULL
  OR recovery_token IS NULL
  OR email_change IS NULL
  OR email_change_token_new IS NULL;

-- Fix identities where provider_id was set to email instead of user UUID
UPDATE auth.identities
SET provider_id = user_id::text
WHERE provider = 'email' AND provider_id != user_id::text;

-- Grant API permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- ==============================================================================
-- 11. INITIALIZE DEFAULT TEACHER AND STUDENT ACCOUNTS
-- ==============================================================================

-- Teacher: Guru Veda (username: veda, password: naatyavedam)
SELECT public.initialize_teacher_account(
  'veda',
  'naatyavedam',
  'Guru Veda'
);

-- Student: SK (username: sk, password: naatyavedam)
SELECT public.create_initial_student_account(
  'sk',
  'naatyavedam',
  'SK'
);
