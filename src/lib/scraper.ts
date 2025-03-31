import { PUBLIC_API_BASE } from '../env';

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
  const timeout = createTimeoutPromise(30000);

  try {
    const apiBase = PUBLIC_API_BASE || "https://scraper-73dv.onrender.com";
    
    // Race between fetch and timeout
    const response = await Promise.race([
      fetch(`${apiBase}/api/scraper/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(credentials)
      }),
      timeout.promise
    ]);

    // Clear timeout since request completed
    timeout.clear();

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Fout bij verbinden met scraper");
    }
    return data;
  } catch (error: any) {
    console.error('Error testing scraper credentials:', error);
    throw new Error(error.message || 'Onverwachte fout bij testen van inloggegevens');
  }
}
