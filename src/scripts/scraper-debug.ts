import { supabase } from '../lib/supabaseClient';

// Get DOM elements
const configSelect = document.getElementById('configSelect') as HTMLSelectElement;
const startDebugButton = document.getElementById('startDebug') as HTMLButtonElement;
const terminal = document.getElementById('terminal');

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Enable/disable start button based on selection
  configSelect?.addEventListener('change', () => {
    startDebugButton.disabled = !configSelect.value;
  });

  // Start debug run
  startDebugButton?.addEventListener('click', startDebugRun);
});

// Add log to terminal
function log(message: string) {
  if (!terminal) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.innerHTML = `<span class="text-gray-400">[${timestamp}]</span> ${message}`;
  terminal.appendChild(logEntry);
  
  // Auto-scroll to bottom
  terminal.scrollTop = terminal.scrollHeight;
}

// Start debug run
async function startDebugRun() {
  const configId = configSelect.value;
  if (!configId) return;
  
  // Clear terminal
  if (terminal) terminal.innerHTML = '';
  
  // Disable button during run
  startDebugButton.disabled = true;
  startDebugButton.innerHTML = `
    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Running...
  `;
  
  try {
    log('Starting debug run...');
    
    // Get config details
    const { data: config, error: configError } = await supabase
      .from('scraper_configs')
      .select('*')
      .eq('id', configId)
      .single();
    
    if (configError) throw configError;
    
    log(`Using config: ${config.name} (${config.type})`);
    
    // Create run record
    const { data: run, error: runError } = await supabase
      .from('scraper_runs')
      .insert({
        config_id: configId,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (runError) throw runError;
    
    log(`Created run with ID: ${run.id}`);
    
    // Set up real-time subscription for logs
    const channel = supabase.channel(`scraper_debug_${run.id}`);
    
    channel
      .on('broadcast', { event: 'log' }, (payload) => {
        log(payload.payload.message);
      })
      .on('broadcast', { event: 'screenshot' }, (payload) => {
        log(`Screenshot taken: ${payload.payload.screenshots.length} total`);
      })
      .subscribe();
    
    // Start the debug run via API
    log('Calling debug API...');
    
    const response = await fetch('/api/scraper/debug', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ configId })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Unknown error');
    }
    
    log('Debug run started successfully');
    log('Waiting for results...');
    
    // Poll for run status
    const checkStatus = async () => {
      const { data: updatedRun, error: statusError } = await supabase
        .from('scraper_runs')
        .select('*')
        .eq('id', run.id)
        .single();
      
      if (statusError) {
        log(`Error checking status: ${statusError.message}`);
        return;
      }
      
      if (updatedRun.status === 'completed') {
        log('✅ Debug run completed successfully');
        channel.unsubscribe();
        return;
      } else if (updatedRun.status === 'failed') {
        log(`❌ Debug run failed: ${updatedRun.error}`);
        channel.unsubscribe();
        return;
      }
      
      // Continue polling
      setTimeout(checkStatus, 5000);
    };
    
    // Start polling
    setTimeout(checkStatus, 5000);
    
  } catch (error: any) {
    log(`❌ Error: ${error.message}`);
    console.error('Debug run error:', error);
  } finally {
    // Re-enable button
    startDebugButton.disabled = false;
    startDebugButton.innerHTML = 'Start Debug Run';
  }
}

// Edit config function for global access
window.editConfig = async function(id: string) {
  // This function is defined in scraper-config.ts
  // We're just making sure it's accessible globally
  if (typeof window.editConfig === 'function') {
    return window.editConfig(id);
  }
};