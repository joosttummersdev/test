// API base URL from environment variables
const apiBase = import.meta.env.PUBLIC_API_BASE || "https://scraper-ekwu.onrender.com";

interface TestCredentials {
  username: string;
  password: string;
}

export async function testScraperCredentials(credentials: TestCredentials) {
  try {
    const response = await fetch(`${apiBase}/api/scraper/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(credentials)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Fout bij verbinden met scraper");
    }
    return data;
  } catch (error: any) {
    console.error('Error testing scraper credentials:', error);
    throw error;
  }
}