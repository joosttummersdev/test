import { createClient } from '@supabase/supabase-js';

// Get environment variables with fallbacks
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('Missing required Supabase environment variables');
}

// Create the Supabase client with explicit options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'crm-system@0.1.0'
    }
  }
});

// Create admin client with service role key
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper function to get user profile
export async function getUserProfile() {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return null;
    }

    if (!session?.user) {
      console.log('No active session');
      return null;
    }

    // Get profile data with role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        role,
        first_name,
        last_name,
        email,
        created_at,
        updated_at
      `)
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return null;
    }

    return { profile, session };
  } catch (error) {
    console.error('Unexpected error in getUserProfile:', error);
    return null;
  }
}

// Helper function to get user role
export async function getUserRole() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      console.log('No active session in getUserRole');
      return null;
    }

    // Get role from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching role:', profileError);
      return null;
    }

    return profile?.role || null;
  } catch (error) {
    console.error('Error in getUserRole:', error);
    return null;
  }
}

// Helper function to verify admin status
export async function isAdmin() {
  const role = await getUserRole();
  return role === 'admin';
}

// Helper function to verify agent status
export async function isAgent() {
  const role = await getUserRole();
  return role === 'agent';
}

// Helper function to check if user has specific role
export async function hasRole(requiredRole: 'admin' | 'agent') {
  const role = await getUserRole();
  return role === requiredRole;
}

// Helper function to redirect based on role
export async function redirectBasedOnRole() {
  const role = await getUserRole();
  
  if (!role) {
    window.location.href = '/';
    return;
  }
  
  if (role === 'admin') {
    window.location.href = '/admin';
  } else if (role === 'agent') {
    window.location.href = '/agent';
  } else {
    window.location.href = '/';
  }
}