import { supabase } from '../lib/supabaseClient';

const modal = document.getElementById('configModal');
const form = document.getElementById('configForm') as HTMLFormElement;
const modalTitle = document.getElementById('modalTitle');
const configIdInput = document.getElementById('configId') as HTMLInputElement;
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const submitButton = document.getElementById('submitButton');
const loadingSpinner = document.getElementById('loadingSpinner');
const debugLog = document.getElementById('debugLog');

let editMode = false;

// Add debug log entry
function addLog(message: string, type: 'info' | 'error' = 'info') {
  if (!debugLog) return;

  debugLog.classList.remove('hidden');
  const logContainer = debugLog.querySelector('div');
  if (!logContainer) return;

  const entry = document.createElement('div');
  entry.className = `text-${type === 'error' ? 'red' : 'gray'}-600`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// Show error message
function showError(message: string) {
  if (errorMessage && errorText) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    addLog(`Error: ${message}`, 'error');
  }
}

// Hide error message
function hideError() {
  if (errorMessage) {
    errorMessage.classList.add('hidden');
  }
}

// Toggle loading state
function setLoading(isLoading: boolean) {
  if (submitButton && loadingSpinner) {
    submitButton.disabled = isLoading;
    loadingSpinner.classList.toggle('hidden', !isLoading);
    const buttonText = submitButton.querySelector('span');
    if (buttonText) {
      buttonText.textContent = isLoading ? 'Bezig met opslaan...' : 'Opslaan';
    }
  }
}

// Show modal
window.showConfigModal = function() {
  editMode = false;
  modalTitle!.textContent = 'Nieuwe Configuratie';
  form?.reset();
  hideError();
  debugLog?.classList.add('hidden');
  modal?.classList.remove('hidden');
};

// Hide modal
window.hideModal = function() {
  modal?.classList.add('hidden');
  form?.reset();
  hideError();
  debugLog?.classList.add('hidden');
  setLoading(false);
};

// Close on outside click
modal?.addEventListener('click', (e) => {
  if (e.target === modal) hideModal();
});

// Handle form submission
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  
  try {
    setLoading(true);
    const formData = new FormData(form);
    
    // Get form values with validation
    const name = formData.get('name')?.toString().trim();
    const type = formData.get('type')?.toString().trim();
    const username = formData.get('username')?.toString().trim();
    const password = formData.get('password')?.toString().trim();
    const isActive = formData.get('isActive') === 'on';

    // Validate required fields
    if (!name) throw new Error('Naam is verplicht');
    if (!type) throw new Error('Type is verplicht');
    if (!username) throw new Error('Gebruikersnaam is verplicht');
    if (!password) throw new Error('Wachtwoord is verplicht');

    // Test credentials first
    addLog('🔍 Testing credentials via /api/scraper/test');
    const response = await fetch('/api/scraper/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error("❌ Login test error:", result);
      throw new Error(result.error || 'Login test failed');
    }

    addLog('✅ Credentials test successful');

    // Create config data object
    const configData = {
      name,
      type,
      credentials: {
        username,
        password
      },
      is_active: isActive,
      settings: {}
    };

    // Save configuration
    let result;
    if (editMode) {
      const configId = formData.get('configId')?.toString();
      if (!configId) throw new Error('Config ID ontbreekt');

      result = await supabase
        .from('scraper_configs')
        .update(configData)
        .eq('id', configId)
        .select()
        .single();
    } else {
      result = await supabase
        .from('scraper_configs')
        .insert([configData])
        .select()
        .single();
    }

    if (result.error) {
      throw new Error(result.error.message);
    }

    addLog('✅ Configuration saved successfully');
    hideModal();
    window.location.reload();
  } catch (error: any) {
    console.error('Error saving config:', error);
    showError(error.message);
  } finally {
    setLoading(false);
  }
});

// Edit config
window.editConfig = async function(id: string) {
  editMode = true;
  modalTitle!.textContent = 'Configuratie Bewerken';
  hideError();
  debugLog?.classList.add('hidden');
  
  try {
    const { data: config, error } = await supabase
      .from('scraper_configs')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) {
      throw error;
    }
      
    if (!config) {
      throw new Error('Configuratie niet gevonden');
    }

    configIdInput.value = config.id;
    (form!.elements.namedItem('name') as HTMLInputElement).value = config.name;
    (form!.elements.namedItem('type') as HTMLSelectElement).value = config.type;
    (form!.elements.namedItem('username') as HTMLInputElement).value = config.credentials?.username || '';
    (form!.elements.namedItem('password') as HTMLInputElement).value = config.credentials?.password || '';
    (form!.elements.namedItem('isActive') as HTMLInputElement).checked = config.is_active;
    
    modal?.classList.remove('hidden');
  } catch (error: any) {
    console.error('Error loading config:', error);
    showError(error.message);
  }
};