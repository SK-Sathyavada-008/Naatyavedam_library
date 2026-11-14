import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UserProfile, PasswordResetRequest } from '../types/index.ts';

const USERNAME_REGEX = /^[a-z0-9_]{2,20}$/;
const INTERNAL_DOMAIN = '@naatyavedam.com';

/**
 * Maps a clean username to an internal email address for Supabase Auth.
 */
export function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim()}${INTERNAL_DOMAIN}`;
}

/**
 * Validate username formatting:
 * - 2 to 20 characters
 * - Lowercase alphanumeric and underscores only
 */
export function validateUsername(username: string): { isValid: boolean; error?: string } {
  const clean = username.toLowerCase().trim();
  if (!clean) {
    return { isValid: false, error: 'Username is required.' };
  }
  if (clean.length < 2) {
    return { isValid: false, error: 'Username must be at least 2 characters long.' };
  }
  if (clean.length > 20) {
    return { isValid: false, error: 'Username cannot exceed 20 characters.' };
  }
  if (!USERNAME_REGEX.test(clean)) {
    return {
      isValid: false,
      error: 'Username can only contain lowercase letters, numbers, and underscores (no spaces or symbols).',
    };
  }
  return { isValid: true };
}

/**
 * Validate password strength:
 * - Minimum 6 characters
 */
export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password) {
    return { isValid: false, error: 'Password is required.' };
  }
  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters long.' };
  }
  return { isValid: true };
}

/**
 * Register a new Student account.
 * Creates an entry in auth.users and triggers a profile with role='STUDENT' and status='PENDING'.
 */
export async function registerStudent(
  fullName: string,
  username: string,
  password: string
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  const userValidation = validateUsername(username);
  if (!userValidation.isValid) {
    return { success: false, error: userValidation.error };
  }

  const passValidation = validatePassword(password);
  if (!passValidation.isValid) {
    return { success: false, error: passValidation.error };
  }

  const cleanUsername = username.toLowerCase().trim();
  const cleanFullName = fullName.trim();
  if (!cleanFullName) {
    return { success: false, error: 'Please provide your full name.' };
  }

  if (!isSupabaseConfigured()) {
    // Local / Offline fallback registration
    const mockProfile: UserProfile = {
      id: `student_${Date.now()}`,
      username: cleanUsername,
      fullName: cleanFullName,
      role: 'STUDENT',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    return { success: true, profile: mockProfile };
  }

  try {
    // 1. Check if username is already taken in profiles
    const { data: existingUser, error: checkError } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // Table might not exist yet or connection error
      console.warn('[Auth] Check username warning:', checkError.message);
    } else if (existingUser) {
      return { success: false, error: 'This username is already taken. Please choose another.' };
    }

    // 2. Call Supabase Auth signUp
    const email = usernameToEmail(cleanUsername);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: cleanUsername,
          full_name: cleanFullName,
        },
      },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return { success: false, error: 'This username is already registered. Please sign in.' };
      }
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create student account.' };
    }

    // Return pending profile
    const profile: UserProfile = {
      id: authData.user.id,
      username: cleanUsername,
      fullName: cleanFullName,
      role: 'STUDENT',
      status: 'PENDING',
      createdAt: authData.user.created_at || new Date().toISOString(),
    };

    return { success: true, profile };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected registration error occurred.',
    };
  }
}

/**
 * Sign in with Username and Password.
 * Revalidates status with backend. Only APPROVED members get full library access.
 */
export async function signIn(
  username: string,
  password: string
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  const cleanUsername = username.toLowerCase().trim();
  if (!cleanUsername) {
    return { success: false, error: 'Please enter your username.' };
  }
  if (!password) {
    return { success: false, error: 'Please enter your password.' };
  }

  if (!isSupabaseConfigured()) {
    // Offline / Demo fallback sign-in
    const isTeacher = cleanUsername === 'veda' || cleanUsername.includes('guru') || cleanUsername.includes('teacher');
    const profile: UserProfile = {
      id: isTeacher ? 'teacher-001' : 'student-001',
      username: cleanUsername,
      fullName: isTeacher
        ? 'Guru Veda'
        : cleanUsername === 'sk'
        ? 'SK'
        : `${cleanUsername} (Student)`,
      role: isTeacher ? 'TEACHER' : 'STUDENT',
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
    };
    return { success: true, profile };
  }

  try {
    const email = usernameToEmail(cleanUsername);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Incorrect username or password.' };
      }
      if (authError.message.includes('Email not confirmed')) {
        return {
          success: false,
          error: 'Your account is pending database email confirmation. Please run the setup SQL.',
        };
      }
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'User session not found.' };
    }

    // 2. Fetch User Profile to check Role & Approval Status
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError || !profileData) {
      // Fallback profile if table is still synchronizing
      const fallbackProfile: UserProfile = {
        id: authData.user.id,
        username: cleanUsername,
        fullName: authData.user.user_metadata?.full_name || cleanUsername,
        role: authData.user.user_metadata?.role || (cleanUsername === 'veda' ? 'TEACHER' : 'STUDENT'),
        status: cleanUsername === 'veda' ? 'APPROVED' : 'PENDING',
        createdAt: authData.user.created_at,
      };
      return { success: true, profile: fallbackProfile };
    }

    const profile: UserProfile = {
      id: profileData.id,
      username: profileData.username,
      fullName: profileData.full_name,
      role: profileData.role,
      status: profileData.status,
      createdAt: profileData.created_at,
      approvedAt: profileData.approved_at,
      approvedBy: profileData.approved_by,
      removedAt: profileData.removed_at,
    };

    // 3. Security verification: Check account status
    if (profile.status === 'REMOVED') {
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Your account access has been revoked by the dance teacher.',
      };
    }

    if (profile.status === 'REJECTED') {
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Your registration request was not approved by the dance teacher.',
      };
    }

    return { success: true, profile };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Login failed. Please check your credentials.',
    };
  }
}

/**
 * Revalidate active session on app load or screen change.
 * Prevents removed/revoked students from accessing data with an old JWT.
 */
export async function revalidateSession(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session?.user) {
      return null;
    }

    const userId = sessionData.session.user.id;

    // Fetch live profile from DB
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profileData) {
      return null;
    }

    // If account was removed or rejected by teacher, revoke session immediately
    if (profileData.status === 'REMOVED' || profileData.status === 'REJECTED') {
      await supabase.auth.signOut();
      return null;
    }

    return {
      id: profileData.id,
      username: profileData.username,
      fullName: profileData.full_name,
      role: profileData.role,
      status: profileData.status,
      createdAt: profileData.created_at,
      approvedAt: profileData.approved_at,
      approvedBy: profileData.approved_by,
      removedAt: profileData.removed_at,
    };
  } catch {
    return null;
  }
}

/**
 * Sign out cleanly and destroy session.
 */
export async function signOutUser(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[Auth] Sign out error:', e);
    }
  }
}

/**
 * Teacher Management: Fetch all pending student registration requests.
 */
export async function fetchPendingStudents(): Promise<UserProfile[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((d) => ({
    id: d.id,
    username: d.username,
    fullName: d.full_name,
    role: d.role,
    status: d.status,
    createdAt: d.created_at,
  }));
}

/**
 * Teacher Management: Fetch all active approved student accounts.
 */
export async function fetchActiveStudents(): Promise<UserProfile[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'STUDENT')
    .eq('status', 'APPROVED')
    .order('full_name', { ascending: true });

  if (error || !data) return [];
  return data.map((d) => ({
    id: d.id,
    username: d.username,
    fullName: d.full_name,
    role: d.role,
    status: d.status,
    createdAt: d.created_at,
    approvedAt: d.approved_at,
  }));
}

/**
 * Teacher Management: Approve a pending student registration.
 */
export async function approveStudent(
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: true };

  const { error } = await supabase.rpc('approve_student', {
    p_student_id: studentId,
  });

  if (error) {
    // Direct table fallback if RPC not installed yet
    const { error: directError } = await supabase
      .from('profiles')
      .update({
        status: 'APPROVED',
        approved_at: new Date().toISOString(),
      })
      .eq('id', studentId);

    if (directError) return { success: false, error: directError.message };
  }

  return { success: true };
}

/**
 * Teacher Management: Reject a pending student registration.
 */
export async function rejectStudent(
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: true };

  const { error } = await supabase.rpc('reject_student', {
    p_student_id: studentId,
  });

  if (error) {
    const { error: directError } = await supabase
      .from('profiles')
      .update({ status: 'REJECTED' })
      .eq('id', studentId);

    if (directError) return { success: false, error: directError.message };
  }

  return { success: true };
}

/**
 * Teacher Management: Remove an active student account.
 * Revokes access and marks status as REMOVED.
 */
export async function removeStudent(
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: true };

  const { error } = await supabase.rpc('remove_student', {
    p_student_id: studentId,
  });

  if (error) {
    const { error: directError } = await supabase
      .from('profiles')
      .update({
        status: 'REMOVED',
        removed_at: new Date().toISOString(),
      })
      .eq('id', studentId);

    if (directError) return { success: false, error: directError.message };
  }

  return { success: true };
}

/**
 * Student: Request Password Reset.
 */
export async function requestPasswordReset(
  username: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const cleanUsername = username.toLowerCase().trim();
  if (!cleanUsername) {
    return { success: false, message: '', error: 'Please enter your username.' };
  }

  if (!isSupabaseConfigured()) {
    return {
      success: true,
      message: 'Your reset request has been logged. The dance teacher will approve it.',
    };
  }

  const { data, error } = await supabase.rpc('request_password_reset', {
    p_username: cleanUsername,
  });

  if (error) {
    return { success: false, message: '', error: error.message };
  }

  return {
    success: data?.success ?? true,
    message: data?.message || 'Password reset request submitted for teacher approval.',
  };
}

/**
 * Teacher: Fetch all pending password reset requests.
 */
export async function fetchPasswordResetRequests(): Promise<PasswordResetRequest[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('password_reset_requests')
    .select('*')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((d) => ({
    id: d.id,
    userId: d.user_id,
    username: d.username,
    status: d.status,
    resetCode: d.reset_code,
    expiresAt: d.expires_at,
    createdAt: d.created_at,
    reviewedAt: d.reviewed_at,
  }));
}

/**
 * Teacher: Approve a password reset request and generate time-limited reset code.
 */
export async function approvePasswordReset(
  requestId: string
): Promise<{ success: boolean; resetCode?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: true, resetCode: 'NAATYA' };
  }

  const { data, error } = await supabase.rpc('approve_password_reset', {
    p_request_id: requestId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: data?.success ?? true,
    resetCode: data?.reset_code,
  };
}

/**
 * Student: Complete Password Reset using approved 6-character code.
 */
export async function completePasswordReset(
  username: string,
  resetCode: string,
  newPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanUsername = username.toLowerCase().trim();
  const cleanCode = resetCode.toUpperCase().trim();

  const passValidation = validatePassword(newPassword);
  if (!passValidation.isValid) {
    return { success: false, error: passValidation.error };
  }

  if (!isSupabaseConfigured()) {
    return {
      success: true,
      message: 'Password reset completed successfully. You can now sign in with your new password.',
    };
  }

  const { data, error } = await supabase.rpc('complete_password_reset', {
    p_username: cleanUsername,
    p_reset_code: cleanCode,
    p_new_password: newPassword,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data?.success === false) {
    return { success: false, error: data?.error || 'Invalid or expired reset code.' };
  }

  return {
    success: true,
    message: data?.message || 'Password reset successfully! You can now sign in.',
  };
}

/**
 * Check if the Teacher account has been initialized in the system.
 */
export async function checkTeacherInitialized(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  try {
    const { data } = await supabase.from('profiles').select('id').eq('role', 'TEACHER').limit(1);
    return Boolean(data && data.length > 0);
  } catch {
    return true;
  }
}

/**
 * Teacher Setup: One-time initialization.
 */
export async function initializeTeacher(
  username: string,
  password: string,
  fullName = 'Guru Veda'
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: true };

  const { data, error } = await supabase.rpc('initialize_teacher_account', {
    p_username: username,
    p_password: password,
    p_full_name: fullName,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data?.success === false) {
    return { success: false, error: data?.error || 'Failed to initialize teacher account.' };
  }

  return { success: true };
}

/**
 * Student Setup: Create initial student account (sk).
 */
export async function createInitialStudent(
  username: string,
  password: string,
  fullName = 'SK'
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: true };

  const { data, error } = await supabase.rpc('create_initial_student_account', {
    p_username: username,
    p_password: password,
    p_full_name: fullName,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data?.success === false) {
    return { success: false, error: data?.error || 'Failed to create student account.' };
  }

  return { success: true };
}

