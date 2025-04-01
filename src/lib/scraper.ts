import nodeFetch from 'node-fetch';

interface TestCredentials {
  username: string;
  password: string;
}

// Helper function to create a timeout promise
function createTimeoutPromise(ms: number) {
  let timeoutId: NodeJS.Timeout;
  return {
    promise: new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Request timed out after ${ms}ms`));
      }, ms);
    }),
    clear: () => clearTimeout(timeoutId)
  };
}

export async function testScraperCredentials(credentials: TestCredentials) {
  const timeout = createTimeoutPromise(60000); // Increased to 60 seconds
  const fetch = globalThis.fetch || nodeFetch;

  console.log('🔄 Starting scraper test...');
  console.log('🎯 Target URL:', 'https://scraper-73dv.onrender.com/api/scraper/test');

  try {
    const apiBase = 'https://scraper-73dv.onrender.com';
    
    // Race between fetch and timeout
    console.log('📡 Sending request...');
    const response = await Promise.race([
      fetch(`${apiBase}/api/scraper/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(credentials)
      }),
      timeout.promise
    ]);

    // Clear timeout since request completed
    timeout.clear();
    console.log('⏱️ Request completed within timeout');

    if (!response) {
      console.error('❌ No response received from server');
      throw new Error('No response received from server');
    }

    console.log('📥 Response received, status:', response.status);
    const data = await response.json();
    console.log('📦 Response data:', data);
    
    if (!response.ok) {
      console.error("❌ Backend error details:", {
        status: response.status,
        statusText: response.statusText,
        error: data.error,
        details: data.details
      });
      throw new Error(`Login test failed: ${data.error}\nDetails: ${data.details}`);
    }
    
    console.log('✅ Test completed successfully');
    return data;
  } catch (error: any) {
    console.error('❌ Error testing scraper credentials:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      console.error('⏱️ Request timed out');
      throw new Error('De verbinding met de scraper is verlopen. Probeer het opnieuw.');
    }

    // Enhance error message with any available details
    const errorMessage = error.message || 'Onverwachte fout bij testen van inloggegevens';
    console.error('📝 Final error message:', errorMessage);
    throw new Error(errorMessage);
  }
}
