// Get API base URL 
const apiBase = "https://scraper-ekwu.onrender.com";

interface TestCredentials {
  username: string;
  password: string;
}

export async function testScraperCredentials(credentials: TestCredentials) {
  try {
    const response = await fetch(`${apiBase}/api/scraper/test`, {
      method: "POST",
      body: JSON.stringify(credentials),
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to test credentials');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error testing scraper credentials:', error);
    throw error;
  }
}