import { supabase, redirectBasedOnRole } from '../lib/supabaseClient';

const form = document.getElementById('login-form');
const errorBox = document.getElementById('error-message');
const errorText = errorBox?.querySelector('h3');
const debugLog = document.getElementById('debug-log');

// Helper function to add debug messages
function addDebugMessage(message, type = 'info') {
  if (!debugLog) return;
  
  const entry = document.createElement('div');
  entry.className = `py-1 ${
    type === 'error' ? 'text-red-600' :
    type === 'success' ? 'text-green-600' :
    type === 'warning' ? 'text-yellow-600' :
    'text-gray-600'
  }`;
  
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  
  debugLog.appendChild(entry);
  debugLog.scrollTop = debugLog.scrollHeight;
  
  // Also log to console for debugging
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// Debug: Log when script loads
addDebugMessage('Login script initialized');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  addDebugMessage('Form submitted');

  const email = form.email.value;
  const password = form.password.value;

  try {
    addDebugMessage('Attempting login...');
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    });

    if (error) {
      addDebugMessage(`Login error: ${error.message}`, 'error');
      throw error;
    }

    if (!data.user) {
      addDebugMessage('No user data received', 'error');
      throw new Error('No user data received');
    }

    addDebugMessage('Login successful', 'success');
    addDebugMessage(`User ID: ${data.user.id}`, 'success');

    // Get profile data
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      addDebugMessage(`Profile error: ${profileError.message}`, 'error');
      throw profileError;
    }

    addDebugMessage(`Profile data received: ${JSON.stringify(profileData)}`, 'success');
    addDebugMessage(`User role: ${profileData?.role}`, 'success');

    // Use the helper function to handle redirection
    await redirectBasedOnRole();

  } catch (err) {
    addDebugMessage(`Error: ${err.message}`, 'error');
    if (errorBox && errorText) {
      errorText.textContent = err.message || 'Inloggen mislukt';
      errorBox.classList.remove('hidden');
    }
  }
});

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  addDebugMessage(`Auth state changed: ${event}`);
  if (session?.user) {
    addDebugMessage(`Session user: ${session.user.email}`);
  }
});