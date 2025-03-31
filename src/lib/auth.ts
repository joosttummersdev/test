import { supabase } from './supabaseClient';

// Centralized authentication function
export async function signIn(email: string, password: string) {
  try {
    console.log('Starting login process for:', email);
    
    // Step 1: Attempt login
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (loginError) {
      console.error('Login error:', loginError.message);
      return { error: loginError };
    }

    if (!data.user) {
      console.error('No user data received');
      return { error: new Error('No user data received') };
    }

    console.log('Login successful, getting profile data...');

    // Step 2: Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, first_name, last_name')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError.message);
      return { error: profileError };
    }

    console.log('Profile data received:', profile);

    // Step 3: Return complete user data
    return {
      data: {
        user: data.user,
        profile,
        session: data.session
      }
    };
  } catch (error: any) {
    console.error('Unexpected error during sign in:', error);
    return { error };
  }
}

// Role-based authorization check
export async function checkAuthorization(requiredRole: 'admin' | 'agent') {
  try {
    console.log('Checking authorization for role:', requiredRole);
    
    // Step 1: Check session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      console.log('No active session');
      return { authorized: false, reason: 'no_session' };
    }

    // Step 2: Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError.message);
      return { authorized: false, reason: 'profile_error' };
    }

    // Step 3: Check role
    if (profile?.role !== requiredRole) {
      console.log(`Role mismatch: expected ${requiredRole}, got ${profile?.role}`);
      return { authorized: false, reason: 'wrong_role' };
    }

    console.log('Authorization successful');
    return { authorized: true, session, profile };
  } catch (error) {
    console.error('Authorization check error:', error);
    return { authorized: false, reason: 'unexpected_error' };
  }
}

// Get redirect path based on user role
export function getRedirectPath(role: string): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'agent':
      return '/agent';
    default:
      return '/login';
  }
}

// Handle unauthorized access
export function handleUnauthorized(reason: string = 'no_session'): string {
  switch (reason) {
    case 'no_session':
      return '/login';
    case 'wrong_role':
      return '/unauthorized';
    default:
      return '/login';
  }
}